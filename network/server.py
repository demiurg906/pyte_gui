import os
import pty
import subprocess
from collections import namedtuple

import aiohttp
import asyncio
from aiohttp import web

from .terminal import Terminal

Size = namedtuple('Size', ['width', 'height'])
DEFAULT_SIZE = Size(80, 24)
size = DEFAULT_SIZE
exe = ['bash']

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    terminal = Terminal()
    ws.send_str(terminal.get_json_screen())

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True)
    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    def process_out_handler():
        b_data = p_out.read(32)
        data = b_data.decode()
        terminal.feed(data)
        answer = terminal.get_json_screen()
        ws.send_str(answer)

    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                p_out.write(msg.data.encode())
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())
    print('websocket connection closed')

    return ws


async def ws_command_line_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

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


def start_server():
    server_folder = os.path.dirname(__file__)
    app = web.Application()
    app.router.add_get('/ws', websocket_handler)
    # app.router.add_get('/ws', ws_command_line_handler)
    app.router.add_static('/', server_folder + '/static', show_index=True)

    web.run_app(app)
