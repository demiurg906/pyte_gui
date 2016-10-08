import json
import os
import pty
import sys

import aiohttp
import subprocess

import select
from aiohttp import web

import pyte
import shlex

from collections import namedtuple
from network.server import async_connector

Size = namedtuple('Size', ['width', 'height'])
DEFAULT_SIZE = Size(80, 24)
size = DEFAULT_SIZE

async def websocket_handler(request):

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                answer = display(msg.data)
                # answer = async_connector.run(msg.data)
                ws.send_str(answer)
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
    # screen.set_mode(pyte.screens.mo.LNM)
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


def display(data):
    exe = shlex.split(data)
    screen = pyte.Screen(*size)
    screen.set_mode(pyte.screens.mo.LNM)
    stream = pyte.Stream()
    stream.attach(screen)

    result_display = None

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True)
    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    works = True

    while works:
        rs, ws, es = select.select([sys.stdin, p_out], [], [])
        for r in rs:
            if r is p_out:
                try:
                    line = p_out.read(1000)
                    stream.feed(line.decode())
                    result_display = screen.display
                except OSError as e:
                    if e.errno == 5:
                        works = False
                    else:
                        raise e
            if r is sys.stdin:
                line = sys.stdin.readline()
                p_out.write(line.encode())

        if p.poll():
            break

    def format_display():
        if result_display is None:
            return None
        res = ''
        for i, line in enumerate(result_display):
            res += '{}: {}\n'.format(i, line)
        return res

    return format_display()

if __name__ == '__main__':
    app = web.Application()
    # app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/ws', ws_command_line_handler)
    app.router.add_static('/', '../client', show_index=True)

    web.run_app(app)
