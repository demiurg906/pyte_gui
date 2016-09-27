import pty
import select
import shlex
import subprocess
import sys
import os


def connect(exe=None, in_stream=sys.stdin, out_stream=sys.stdout):
    if exe is None:
        exe = ['python3']
    if isinstance(exe, str):
        exe = shlex.split(exe)
    master, slave = pty.openpty()
    p = subprocess.Popen(exe, stdin=slave, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    pin = os.fdopen(master, 'w')

    msg = ''
    errmsg = ''

    while True:
        rs, ws, es = select.select([in_stream, p.stdout, p.stderr], [], [])
        if in_stream in rs:
            c = in_stream.read(1)
            if c == '':
                msg = msg[:-1]
            elif c == '\n':
                pin.write(msg + '\n')
                # out_stream.write('{}\n'.format(msg))
                msg = ''
            else:
                msg += c
                # out_stream.flush()
        if p.stdout in rs:
            out_stream.write(p.stdout.readline().decode())
            # sys.stderr.flush()
        if p.stderr in rs:
            errmsg += p.stderr.read(1).decode()
            if errmsg.endswith('>>> '):
                errmsg = errmsg[:-4]
            if errmsg.endswith('\n'):
                out_stream.write('{}\n'.format(errmsg))
                errmsg = ''

if __name__ == '__main__':
    connect('python3 pyte_wrapper.py 20 5')
