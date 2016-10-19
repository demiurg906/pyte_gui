import os
import pty
import shlex
import subprocess
from collections import namedtuple

import aiohttp
import asyncio

from aiohttp import WSCloseCode
from aiohttp import web

from .terminal import Terminal

Size = namedtuple('Size', ['width', 'height'])
DEFAULT_SIZE = Size(80, 24)
size = DEFAULT_SIZE
exe = 'bash -i'
exe = shlex.split(exe)

# exe = ['bash', '-i', '--login']

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    request.app['websockets'].append(ws)

    terminal = Terminal()
    ws.send_str(terminal.get_json_screen())

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True,
                         env={'TERM': 'vt220', 'COLUMNS': str(size.width), 'LINES': str(size.height)})
    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    def read_char(stream, buffsize=8):
        try:
            b_data = stream.read(buffsize)
            while True:
                try:
                    data = b_data.decode('utf-8')
                    return data
                except UnicodeDecodeError:
                    b_data += stream.read(buffsize)
        except OSError as e:
            if e.errno == 5:
                return ''
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


def start_server():
    server_folder = os.path.dirname(__file__)
    app = web.Application()
    app['websockets'] = []
    app.router.add_get('/ws', websocket_handler)
    # app.router.add_get('/ws', ws_command_line_handler)
    app.router.add_static('/', server_folder + '/static', show_index=True)
    app.on_shutdown.append(on_shutdown)

    web.run_app(app)
