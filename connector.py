import select
import shlex
import subprocess
import sys

import pyte

STOP_SIGNAL = '@'


def connect(exe=None, size=(80, 24)):
    if exe is None:
        exe = ['python3']
    if isinstance(exe, str):
        exe = shlex.split(exe)

    p = subprocess.Popen(exe, stdout=subprocess.PIPE)

    screen = pyte.Screen(*size)
    screen.set_mode(pyte.screens.mo.LNM)
    stream = pyte.Stream()
    stream.attach(screen)

    def print_display():
        sys.stdout.write('Screen starts\n')
        for lineno, line in enumerate(screen.display):
            sys.stdout.write('{:2d}: {}\n'.format(lineno, line))
        sys.stdout.write('Screen ends\n\n')

    msg = ''
    while True:
        rs, ws, es = select.select([p.stdout], [], [])
        if p.stdout in rs:
            c = p.stdout.read(1).decode()
            if c == STOP_SIGNAL:
                break
            if c == '':
                msg = msg[:-1]
            elif c == '\n':
                stream.feed(msg + '\n')
                msg = ''
                print_display()
            else:
                msg += c

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('there must be executable path')
        exit(0)
    connect(sys.argv[1:], (20, 20))
