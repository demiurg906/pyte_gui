import json

import pyte
from collections import namedtuple

Size = namedtuple('Size', ['width', 'height'])
DEFAULT_SIZE = Size(80, 24)


class Terminal:
    def __init__(self, size=None):
        if size is None:
            size = DEFAULT_SIZE
        self.screen = pyte.Screen(*size)
        self.screen.set_mode(pyte.screens.mo.LNM)
        self.stream = pyte.Stream()
        self.stream.attach(self.screen)

    def feed(self, data):
        self.stream.feed(data)

    def get_screen(self):
        screen = ''
        for i, line in enumerate(self.screen.display):
            screen += '{:2d}: {}\n'.format(i, line)
        return screen

    def get_json_screen(self):
        return json.dumps({
            'screen': self.screen.buffer,
            'cursor': {'x': self.screen.cursor.x, 'y': self.screen.cursor.y}
        })
