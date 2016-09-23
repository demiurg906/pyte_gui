import sys
import time


def getlines(fd=sys.stdin):
    output = []
    while True:
        line = fd.readline()
        if line == '':  # EOF
            break
        output.append(line)
    return output

if __name__ == '__main__':
    with open('test.txt', 'w') as f:
        for i in range(10):
            lines = getlines()
            time.sleep(1)

            for line in lines:
                f.write(str(line))
