import errno
import json
import os
import pty
import random
import shlex
import subprocess

import aiohttp
import asyncio
import pyte
from aiohttp import WSCloseCode
from aiohttp import web

DEFAULT_SIZE = (80, 24)
size = DEFAULT_SIZE

exe = shlex.split('bash -i')


class Terminal:
    def __init__(self, size):
        self.screen = pyte.DiffScreen(*size)
        self.screen.set_mode(pyte.screens.mo.LNM)
        self.stream = pyte.Stream()
        self.stream.attach(self.screen)

    def feed(self, data):
        # self.screen.dirty.clear()
        self.stream.feed(data)

    def get_screen(self):
        screen = ''
        for i, line in enumerate(self.screen.display):
            screen += '{:2d}: {}\n'.format(i, line)
        return screen

    def get_json_screen(self):
        res = json.dumps({
            'screen': self.screen.buffer,
            'cursor': {'x': self.screen.cursor.x, 'y': self.screen.cursor.y},
            'dirty': list(self.screen.dirty)
        })
        self.screen.dirty.clear()
        return res


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
    terminal = Terminal(size)
    ws.send_str(terminal.get_json_screen())

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True,
                         env={'TERM': 'vt220',
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
        answer = terminal.get_json_screen()
        ws.send_str(answer)

    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                print('char: {}, byte: {}'.format(msg.data, msg.data.encode()))
                p_out.write(msg.data.encode())
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception %s' %
                      ws.exception())
    finally:
        loop.remove_reader(p_out)
        p.kill()
        p_out.close()
        request.app['websockets'].remove(ws)
        print('websocket connection closed')

    return ws


async def ws_command_line_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    request.app['websockets'].append(ws)

    terminal = Terminal()
    ws.send_str(terminal.get_json_screen())

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                terminal.feed(msg.data)
                answer = terminal.get_json_screen()
                ws.send_str(answer)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())
    print('websocket connection closed')
    return ws


async def on_shutdown(app):
    for ws in app['websockets']:
        await ws.close(code=WSCloseCode.GOING_AWAY, message='Server shutdown')


def generate_id():
    # TODO: make better id choosing
    return random.randint(1, 1000)


def start_server():
    app = web.Application()
    app['websockets'] = []
    app.router.add_get('/ws', websocket_handler)
    # app.router.add_get('/ws', ws_command_line_handler)
    app.router.add_static('/', './static', show_index=True)
    app.on_shutdown.append(on_shutdown)

    web.run_app(app)


if __name__ == "__main__":
    start_server()
