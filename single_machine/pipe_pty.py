import io
import os
import pty
import select
import subprocess
import sys
import tty

import pyte
import time


class Connector:
    def __init__(self, exe):
        master, slave = pty.openpty()
        self.p = subprocess.Popen(exe, stdin=slave,
                                  stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE)
        self.to_child = os.fdopen(master, 'wb')
        self.from_child = self.p.stdout
        self.err_from_child = self.p.stderr

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.to_child.flush()
        if self.p.wait():
            print('Exception in child!')
            print(self.err_from_child.read().decode())

    def getlines(self):
        return iter_lines(self.from_child)

    def get_error_lines(self):
        return iter_lines(self.err_from_child)

    def send(self, msg):
        self.to_child.write(msg + b'\n')


def iter_lines(handle):
    return iter(handle.readline, b'')


def test_taker():
    with Connector(['python3', 'taker.py']) as c:
        for i in range(10):
            c.send(str(i).encode())


def test_sender():
    connector = Connector(['python3', 'sender.py'])
    while True:
        out = connector.getlines()
        out_err = connector.get_error_lines()
        print(out)
        print(out_err)
        print()
        if not out:
            break

if __name__ == "__main__":
    # test_sender()
    test_taker()
