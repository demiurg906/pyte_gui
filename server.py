import errno
import json
import os
import pty
import random
import shelve
import shlex
import subprocess

import aiohttp
import asyncio
import pyte
import sys
from aiohttp import web

import screen_message_pb2

DEFAULT_SIZE = (80, 24)

exe = shlex.split('bash -i')
# exe = shlex.split('sudo -H -u guest bash -i')

users_screens = shelve.open('usersScreens.db')

shutting_down = False


class Terminal:
    def __init__(self, size):
        self.size = size
        self.screen = pyte.DiffScreen(*size)
        self.stream = pyte.Stream()
        self.stream.attach(self.screen)
        self.saved_state_exist = False

    def feed(self, data):
        self.stream.feed(data)

    def get_screen(self):
        screen = ''
        for i, line in enumerate(self.screen.display):
            screen += '{:2d}: {}\n'.format(i, line)
        return screen

    def get_json_screen(self, dirty=False):
        res = {
            'screen': self.screen.buffer,
            'cursor': {'x': self.screen.cursor.x, 'y': self.screen.cursor.y},
        }
        if not dirty:
            res['dirty'] = list(self.screen.dirty)
        else:
            res['dirty'] = list(range(self.size[1]))
        # self.screen.dirty.clear()
        return json.dumps(res)

    def get_screen_message(self, dirty=False):
        screen_state = screen_message_pb2.ScreenState()

        # cursor
        screen_state.cursor_x = self.screen.cursor.x
        screen_state.cursor_y = self.screen.cursor.y

        # dirty lines
        if not dirty:
            dirty_lines = list(self.screen.dirty)
        else:
            dirty_lines = list(range(self.size[1]))

        for line in dirty_lines:
            screen_line = screen_state.lines.add()
            screen_line.i = line
            for cell in self.screen.buffer[line]:
                screen_cell = screen_line.cells.add()
                screen_cell.character = cell.data
                screen_cell.reversed = cell.reverse
                screen_cell.fg_color = proto_colors[cell.fg]
                screen_cell.bg_color = proto_colors[cell.bg]
        self.screen.dirty.clear()
        # print(screen_state)
        return screen_state.SerializeToString()


async def websocket_handler(request):
    ws = web.WebSocketResponse()
    if 'id' in request.cookies:
        ws_id = request.cookies['id']
    else:
        ws_id = generate_id()
        ws.set_cookie(name='id', value=ws_id)
    print('client id = {}'.format(ws_id))
    await ws.prepare(request)
    request.app['websockets'].add(asyncio.Task.current_task())

    width, height = size = DEFAULT_SIZE
    if ws_id in users_screens:
        terminal = Terminal(size)
        terminal.screen = users_screens[ws_id]
        terminal.stream.attach(terminal.screen)
        terminal.saved_state_exist = True
    else:
        terminal = Terminal(size)

    ws.send_bytes(terminal.get_screen_message())

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True,
                         env={
                             'TERM': 'linux',
                             'LC_ALL': 'en_GB.UTF-8',
                             'COLUMNS': str(width),
                             'LINES': str(height)})

    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    def read_char(stream, buffsize=65536):
        try:
            return stream.read(buffsize)
        except OSError as e:
            if e.errno == errno.EIO:
                return b''
            else:
                raise e

    def process_out_handler():
        data = read_char(p_out)
        terminal.feed(data)
        answer = terminal.get_screen_message()
        print(terminal.get_screen_message(), end='\n\n')
        ws.send_bytes(answer)

    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                p_out.write(msg.data.encode())
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception %s' %
                      ws.exception())
    except asyncio.CancelledError:
        print('websocket cancelled')
    finally:
        loop.remove_reader(p_out)
        p.kill()
        p_out.close()
        if not shutting_down:
            request.app['websockets'].remove(asyncio.Task.current_task())
        users_screens[ws_id] = terminal.screen
        print('websocket connection closed')
    await ws.close()

    return ws


async def on_shutdown(app: web.Application):
    global shutting_down
    shutting_down = True
    for task in app['websockets']:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    users_screens.close()


def generate_id():
    return str(random.randint(1, 10000000))


def start_server(host='0.0.0.0'):
    app = web.Application()
    app['websockets'] = set()
    app.router.add_get('/ws', websocket_handler)
    app.router.add_static('/', './client/static', show_index=True)
    app.on_shutdown.append(on_shutdown)

    web.run_app(app, host=host)


proto_colors = {
    "black": screen_message_pb2.BLACK,
    "red": screen_message_pb2.RED,
    "green": screen_message_pb2.GREEN,
    "brown": screen_message_pb2.BROWN,
    "blue": screen_message_pb2.BLUE,
    "magenta": screen_message_pb2.MAGNETA,
    "cyan": screen_message_pb2.CYAN,
    "white": screen_message_pb2.WHITE,
    "default": screen_message_pb2.DEFAULT
}

if __name__ == '__main__':
    if len(sys.argv) > 1:
        start_server(sys.argv[1])
    start_server()
