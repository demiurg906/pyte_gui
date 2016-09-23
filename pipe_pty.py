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
        p = subprocess.Popen(exe, stdin=slave,
                             stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE)
        self.to_child = os.fdopen(master, 'w')
        self.from_child = p.stdout
        self.err_from_child = p.stderr

    def _getlines(self, fd):
        output = []
        while True:
            line = fd.readline()
            if line == b'':  # EOF
                break
            output.append(line.decode())
        return output

    def getlines(self):
        return self._getlines(self.from_child)

    def get_error_lines(self):
        return self._getlines(self.err_from_child)

    def send(self, msg):
        self.to_child.write(str(msg) + '\n')


def test_taker():
    connector = Connector(['python3', 'taker.py'])
    for i in range(10):
        connector.send(i)
    time.sleep(10)


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
