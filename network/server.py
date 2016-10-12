import json
import os
import pty
import subprocess
import select
import shlex
import sys
from collections import namedtuple

import aiohttp
import asyncio
import pyte
from aiohttp import web


Size = namedtuple('Size', ['width', 'height'])
DEFAULT_SIZE = Size(80, 24)
size = DEFAULT_SIZE
exe = ['bash']

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    screen = pyte.Screen(*DEFAULT_SIZE)
    screen.set_mode(pyte.screens.mo.LNM)
    stream = pyte.Stream()
    stream.attach(screen)

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True)
    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    def process_out_handler():
        b_data = p_out.read(32)
        data = b_data.decode()
        stream.feed(data)
        answer = prepare_screen(screen)
        ws.send_str(answer)

    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)
    # loop.run_forever()

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

    stream = pyte.Stream()
    screen = pyte.Screen(*DEFAULT_SIZE)
    stream.attach(screen)
    ws.send_str(prepare_screen(screen))

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                stream.feed(msg.data)
                answer = prepare_screen(screen)
                ws.send_str(answer)
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws connection closed with exception %s' %
                  ws.exception())
    print('websocket connection closed')
    return ws


def prepare_screen(screen):
    return json.dumps({'screen': screen.display, 'cursor': {'x': screen.cursor.x, 'y': screen.cursor.y}})


def start_server():
    server_folder = os.path.dirname(__file__)
    app = web.Application()
    app.router.add_get('/ws', websocket_handler)
    # app.router.add_get('/ws', ws_command_line_handler)
    app.router.add_static('/', server_folder + '/static', show_index=True)

    web.run_app(app)
