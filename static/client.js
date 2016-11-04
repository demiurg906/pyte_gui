window.onload = function() {
    const terminal = new Terminal('screen', 80, 24);

    const serverUrl = 'ws://0.0.0.0:8080/ws';
    var socket;

    const element = document.getElementById('terminal');
    element.focus();

    function start() {
        socket = new WebSocket(serverUrl);
        socket.onmessage = e => terminal.render(JSON.parse(e.data));
        socket.onclose = () => {setTimeout(() => {start()}, 5000)}
    }

    start();

    function send(message, type) {
        socket.send(message);
    }

    element.onkeydown = e => {
        const message = keyToMessage(e);
        if (message) {
            send(message, 'control');
            e.preventDefault();
            return false;
        }
    };

    element.onkeypress = e => {
        var message = keyToMessage(e);
        if (message) {
            send(message, 'command');
        }
    };
};

class Terminal {
    constructor(id, width, height) {
        this.width = width;
        this.height = height;
        this.screen = new Array(height);
        this.cursor = {'x': 0, 'y': 0};

        const table = document.getElementById(id);
        for (let i = 0; i < height; i++) {
            this.screen[i] = new Array(width);
            const row = table.insertRow(i);
            for (let j = 0; j < width; j++) {
                const cell = row.insertCell(j);
                cell.className = 'fg-default bg-default';
                cell.innerText = ' ';
                this.screen[i][j] = cell;
            }
        }
    }

    setColor(cell, color, type) {
        const className = type + '-' + color;
        let regexp;
        if (type === 'fg')
            regexp = /fg-\w*/;
        else
            regexp = /bg-\w*/;
        cell.className = cell.className.replace(regexp, className);
    }

    setFgColor(cell, color) {
        this.setColor(cell, color, 'fg')
    }

    setBgColor(cell, color) {
        this.setColor(cell, color, 'bg')
    }

    setReverse(cell) {
        this.setColor(cell, 'reverse', 'fg');
        this.setColor(cell, 'reverse', 'bg');
    }

    setDefault(cell) {
        this.setFgColor(cell, 'default');
        this.setBgColor(cell, 'default');
    }

    render(message) {
        let {cursor: {x: cx, y: cy}, screen, dirty} = message;
        if (cx == this.width) {
            cx = 0;
            cy++;
        }

        this.updateCursor(true);
        this.cursor = {x: cx, y: cy};
        // console.log('-----------------------------------');

        for (let i of dirty) {
            // console.log('dirty line: ' + i);
            for (let j = 0; j < this.width; j++) {
                const cell = this.screen[i][j];
                let [data, fg, bg,
                       bold, italics, underscore, strikethrough,
                       reverse] = screen[i][j];

                cell.innerText = data;

                this.setFgColor(cell, fg);
                this.setBgColor(cell, bg);

                if (reverse)
                    this.setReverse();
            }
        }
        this.updateCursor();
    }

    updateCursor(erase=false) {
        if (this.cursor.y < this.height && this.cursor.x < this.width) {
            let cell = this.screen[this.cursor.y][this.cursor.x];
            if (erase)
                this.setDefault(cell);
            else
                this.setReverse(cell);
        }
    }
}

function keyToMessage(e) {
    // console.log(e.keyCode);

    function ctrlKey(x) {
        console.log(x - 65 + 1);
        return String.fromCharCode(x - 65 + 1);
        // if (x >= 'a' && x <= 'z')
        //     return ((x) - 'a' + 1);
        // else
        //     return ((x) - 'A' + 1) & 0x7f;
    }

    if (e.type === "keypress") {
        if (e.which == null) { // IE
            return (e.keyCode < 32)
                ? null // спец. символ
                : String.fromCharCode(e.keyCode);
        }

        if (e.which != 0 && e.charCode != 0) { // все кроме IE
            return (e.which < 32)
                ? null // спец. символ
                : String.fromCharCode(e.which); // остальные
        }

        return null; // спец. символ
    }

    console.log(e.which);
    var message = null;
    if (e.which == 8) { // backspace
        message = ctrl.BACKSPACE;
    } else if (e.which == 9) { // tab
        message = ctrl.TAB;
    } else if (e.which == 13) { // enter
        message = ctrl.LF;
    } else if (e.which == 20) { // caps lock

    } else if (e.which == 27) { // esc
        message = ctrl.ESC;
    } else if (e.which == 33) { // page up
        message = ctrl.PAGE_UP;
    } else if (e.which == 34) { // page down
        message = ctrl.PAGE_DOWN;
    } else if (e.which == 35) { // end
        message = ctrl.END;
    } else if (e.which == 36) { // home
        message = ctrl.HOME;
    } else if (e.which == 37) { // left arrow
        message = ctrl.LEFT_ARROW;
    } else if (e.which == 38) { // up arrow
        message = ctrl.UP_ARROW;
    } else if (e.which == 39) { // right arrow
        message = ctrl.RIGHT_ARROW;
    } else if (e.which == 40) { // down arrow
        message = ctrl.DOWN_ARROW;
    } else if (e.which == 45) { // insert
        message = ctrl.INSERT;
    } else if (e.which == 46) { // delete
        message = ctrl.DEL;
    } else if (e.which >= 112 && e.which <= 123) { // F1 -- F12
        var number = e.which - 111;
        message = fKeys[number];
    } else if (e.ctrlKey) { // ctrl+...
        if (e.keyCode >= 65 && e.keyCode <= 90) { // keycode in ['A'..'Z']
            message = ctrlKey(e.keyCode);
        }
        else if (e.which >= 48 && e.which <= 57) { //keycode in ['0'..'9']
            message = controlNumberKeys[e.which - 48];
        }
    }

    return message;
}

const ctrl = {
    LF: '\n',
    BACKSPACE: '\u0008',
    ESC: '\u001b',
    CSI: '\u001b[',
    TAB: '\u0009',
    HOME: '\u001b[1~',
    INSERT: '\u001b[2~',
    // DEL: '\u007f', it's for VT100
    DEL: '\u001b[3~',
    END: '\u001b[4~',
    PAGE_UP: '\u001b[5~',
    PAGE_DOWN: '\u001b[6~',
    UP_ARROW: '\u001b[A',
    DOWN_ARROW: '\u001b[B',
    RIGHT_ARROW: '\u001b[C',
    LEFT_ARROW: '\u001b[D',
};

// *F keys* for linux terminal
const fKeys = {
    1: ctrl.CSI + '[A',
    2: ctrl.CSI + '[B',
    3: ctrl.CSI + '[C',
    4: ctrl.CSI + '[D',
    5: ctrl.CSI + '[E',
    6: ctrl.CSI + '17~',
    7: ctrl.CSI + '18~',
    8: ctrl.CSI + '19~',
    9: ctrl.CSI + '20~',
    10: ctrl.CSI + '21~',
    11: ctrl.CSI + '23~',
    12: ctrl.CSI + '24~'
};


// *F keys* for vt220 terminal
// const fKeys = {
//     1: ctrl.ESC + 'OP',
//     2: ctrl.ESC + 'OQ',
//     3: ctrl.ESC + 'OR',
//     4: ctrl.ESC + 'OS',
//     5: ctrl.CSI + '15~',
//     6: ctrl.CSI + '17~',
//     7: ctrl.CSI + '18~',
//     8: ctrl.CSI + '19~',
//     9: ctrl.CSI + '20~',
//     10: ctrl.CSI + '21~',
//     11: ctrl.CSI + '23~',
//     12: ctrl.CSI + '24~'
// };

const controlNumberKeys = {
    0: '\u0030',
    1: '\u0031',
    2: '\u0000',
    3: '\u001b',
    4: '\u001c',
    5: '\u001d',
    6: '\u001e',
    7: '\u001f',
    8: '\u007f',
    9: '\u0039',
};