import errno
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

# size of the terminal
DEFAULT_SIZE = (80, 24)

# command to run a bash
exe = shlex.split('bash -i')  # run from current user
# exe = shlex.split('sudo -H -u guest bash -i')  # run from guest user

# database with screen states of clients
users_screens = shelve.open('usersScreens.db')

shutting_down = False


class Terminal:
    """
    This class is wrapper over pyte emulator
    """

    def __init__(self, size):
        """
        Initialize pyte's screen and stream.
        :param (int, int) size: size of the terminal screen
        """
        self.size = size
        self.screen = pyte.DiffScreen(*size)
        self.stream = pyte.Stream()
        self.stream.attach(self.screen)
        self.saved_state_exist = False

    def feed(self, data):
        """
        Feeds data to pyte stream.
        :param bytes data: data to feed
        """
        self.stream.feed(data)

    def get_screen_message(self):
        """
        Generates message with screen state to send it to client.
        :return: message to send
        :rtype: bytes
        """
        screen_state = screen_message_pb2.ScreenState()

        # cursor
        screen_state.cursor_x = self.screen.cursor.x
        screen_state.cursor_y = self.screen.cursor.y

        # dirty lines
        dirty_lines = list(self.screen.dirty)

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
        return screen_state.SerializeToString()


async def websocket_handler(request):
    """
    Handler of websocket connections to server.
    It's the main operating function, contains launching bash process,
    connection it to the pyte terminal, receiving signals from client to bash
    and screen state to client.
    :param web.Request request:
    :return: response to the connected webscoket
    :rtype: aiohttp.web.WebSocketResponse
    """
    ws = web.WebSocketResponse()

    # generate id for new clients
    if 'id' in request.cookies:
        ws_id = request.cookies['id']
    else:
        ws_id = generate_id()
        ws.set_cookie(name='id', value=ws_id)
    print('client id = {}'.format(ws_id))

    await ws.prepare(request)
    request.app['websockets'].add(asyncio.Task.current_task())

    # initialize terminal for client
    width, height = size = DEFAULT_SIZE
    terminal = Terminal(size)
    # if client connected before, restore his screen from shelve
    if ws_id in users_screens:
        terminal.screen = users_screens[ws_id]
        terminal.stream.attach(terminal.screen)
        terminal.saved_state_exist = True

    # send saved (or empty) screen to client
    ws.send_bytes(terminal.get_screen_message())

    # initialize bash process via pty
    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True,
                         env={
                             'TERM': 'linux',
                             'LC_ALL': 'en_GB.UTF-8',
                             'COLUMNS': str(width),
                             'LINES': str(height)})

    os.close(slave_fd)

    # fd for read-write to the bash
    p_out = os.fdopen(master_fd, 'w+b', 0)

    def read_char(stream, buffsize=65536):
        """
        Function that reads chars from fd.
        :param stream: file descriptor of which reads
        :param int buffsize: number of bytes reads once
        :return: read byte string
        :rtype: bytes
        """
        try:
            return stream.read(buffsize)
        except OSError as e:
            if e.errno == errno.EIO:
                return b''
            else:
                raise e

    def process_out_handler():
        """
        Function that handles changes in the bash screen.
        When bash has something on its stdout that function reads it,
        sends to the pyte and sends new terminal screen state to client.
        """
        data = read_char(p_out)
        terminal.feed(data)
        answer = terminal.get_screen_message()
        ws.send_bytes(answer)

    # register process_out_handler as reader of the p_out fd
    loop = asyncio.get_event_loop()
    loop.add_reader(p_out, process_out_handler)

    # main cycle that reads messages from the client
    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                print(msg.data.encode())
                p_out.write(msg.data.encode())
            elif msg.type == aiohttp.WSMsgType.ERROR:
                print('ws connection closed with exception {}'.
                      format(ws.exception()))
    except asyncio.CancelledError:
        print('websocket cancelled')
    finally:
        # resource release after websocket is closed
        loop.remove_reader(p_out)
        p.kill()
        p_out.close()
        if not shutting_down:
            request.app['websockets'].remove(asyncio.Task.current_task())

        # saving clients screen state to the shelve
        users_screens[ws_id] = terminal.screen
        print('websocket connection closed')
    await ws.close()

    return ws


async def on_shutdown(app):
    """
    Function that called when the server receives turned off signal.
    It closes all websocket connections and shelve.
    :type app: aiohttp.web.Application app
    """
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
    """
    It generates id for new client.
    Generation algorithm is dummy, but for very small server, that it is,
    it's well.
    :return: id for new client
    :rtype: int
    """
    return str(random.randint(1, 10000000))


def start_server(host='0.0.0.0'):
    """
    Main function that starts a server.
    :param str host: adress of the server
    """
    app = web.Application()
    app['websockets'] = set()
    app.router.add_get('/ws', websocket_handler)
    app.router.add_static('/', './client/static', show_index=True)
    app.on_shutdown.append(on_shutdown)

    web.run_app(app, host=host)


# dict represents the protobuf color types through the string color names
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

# connect server
if __name__ == '__main__':
    if len(sys.argv) > 1:
        start_server(sys.argv[1])
    start_server()
