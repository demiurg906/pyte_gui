import os
import pty
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

    master_fd, slave_fd = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave_fd, stdout=slave_fd,
                         stderr=subprocess.STDOUT, close_fds=True)
    os.close(slave_fd)
    p_out = os.fdopen(master_fd, 'w+b', 0)

    screen = pyte.Screen(*size)
    screen.set_mode(pyte.screens.mo.LNM)
    stream = pyte.Stream()
    stream.attach(screen)

    def print_display():
        sys.stdout.write("\x1b[2J")  # erase_in_display
        for i, line in enumerate(screen.display):
            print('{0:2d}: {1}'.format(i, line))
        # sys.stdout.write("\n".join(screen.display))
        sys.stdout.write('----------------------------\n')

    works = True

    while works:
        rs, ws, es = select.select([sys.stdin, p_out], [], [])
        for r in rs:
            if r is p_out:
                try:
                    line = p_out.read(1000)
                    stream.feed(line.decode())
                    print_display()
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


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('there must be executable path')
        exit(0)
    connect(sys.argv[1:], (120, 8))
