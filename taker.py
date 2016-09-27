import sys


if __name__ == '__main__':
    with open('test.txt', 'w') as f:
        for i in range(10):
            for line in sys.stdin:
                f.write(str(line))
