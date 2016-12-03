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
from aiohttp import WSCloseCode
from aiohttp import web

DEFAULT_SIZE = (80, 24)

exe = shlex.split('bash -i')
# exe = shlex.split('sudo -H -u guest bash -i')

pyte.Stream.escape[b'P'] = 'prev_page'
pyte.Stream.escape[b'N'] = 'next_page'

users_screens = shelve.open('usersScreens.db')


class Terminal:
    def __init__(self, size, history_lines=0):
        self.size = size
        self.screen = pyte.HistoryScreen(*size, history_lines, ratio=history_lines)
        # self.screen.set_mode(pyte.screens.mo.LNM)
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
        self.screen.dirty.clear()
        return json.dumps(res)


async def websocket_handler(request):
    ws = web.WebSocketResponse()
    if 'id' in request.cookies:
        ws_id = request.cookies['id']
    else:
        ws_id = generate_id()
        ws.set_cookie(name='id', value=ws_id)
    print('client id = {}'.format(ws_id))
    await ws.prepare(request)
    request.app['websockets'].append(ws)

    width, height = size = DEFAULT_SIZE
    if ws_id in users_screens:
        terminal = Terminal(size, height * 2)
        old_buffer = users_screens[ws_id]
        for line in old_buffer:
            terminal.screen.history.top.append(line)
        terminal.saved_state_exist = True
        terminal.stream.feed(pyte.screens.ctrl.ESC + b'P')
    else:
        terminal = Terminal(size)

    ws.send_str(terminal.get_json_screen())

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

    # cd  to the guest home location
    # p_out.write('cd ~\n'.encode() + b'\x0c')

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
        # if terminal.saved_state_exist:
        #     data = data.strip() + b'\n'
        #     terminal.saved_state_exist = False
        terminal.feed(data)
        answer = terminal.get_json_screen()
        ws.send_str(answer)

    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                # print('char: {}, byte: {}'.format(msg.data, msg.data.encode()))
                # print(msg.data)
                p_out.write(msg.data.encode())
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception %s' %
                      ws.exception())
    finally:
        loop.remove_reader(p_out)
        p.kill()
        p_out.close()
        request.app['websockets'].remove(ws)
        # users_screens[ws_id] = terminal.screen.buffer
        print('websocket connection closed')

    return ws


async def on_shutdown(app):
    for ws in app['websockets']:
        await ws.close(code=WSCloseCode.GOING_AWAY, message='Server shutdown')
    users_screens.close()


def generate_id():
    # TODO: make better id choosing
    return random.randint(1, 1000)


def start_server():
    app = web.Application()
    app['websockets'] = []
    app.router.add_get('/ws', websocket_handler)
    app.router.add_static('/', './client/static', show_index=True)
    app.on_shutdown.append(on_shutdown)

    web.run_app(app)


if __name__ == '__main__':
    start_server()
