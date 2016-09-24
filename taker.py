import sys
import time


def getlines(fd=sys.stdin):
    output = []
    while True:
        line = fd.readline()
        if line == b'':  # EOF
            break
        output.append(line.decode())
    return output

if __name__ == '__main__':
    with open('test.txt', 'w') as f:
        for i in range(10):
            time.sleep(5)
            lines = getlines()

            for line in lines:
                f.write(line)
