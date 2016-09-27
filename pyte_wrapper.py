import pyte
import sys

DEFAULT_SIZE = (80, 24)

if __name__ == '__main__':
    size = DEFAULT_SIZE
    if len(sys.argv) > 2:
        size = (int(sys.argv[1]), int(sys.argv[2]))
    screen = pyte.Screen(*size)
    stream = pyte.Stream()
    stream.attach(screen)
    while True:
        command = sys.stdin.readline()
        stream.feed(command)
        sys.stdout.write('Screen begins\n')
        for line in screen.display:
            sys.stdout.write('{}\n'.format(line))
        sys.stdout.write('Screen ends\n\n')


