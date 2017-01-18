// const $ = require('jquery');
// const React = require('react');

const ProtoBuf = require("protobufjs");

// default sizes of the terminal screen
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;

// name of default palette
const DEFAULT_PALETTE = "xcolors.net/dkeg-panels";

// address of server
const serverUrl = 'ws://' + window.location.host + '/ws';

// protocol initialization
const ScreenState = ProtoBuf.loadProtoFile('screen-message.proto').build("ScreenState");

// list of all available palettes
const paletteList = getJson('schemes.json');

// main function that initialize all elements on the client page
$(function () {
    let terminal = new Terminal('screen', DEFAULT_WIDTH, DEFAULT_HEIGHT);
    const paletteSwitcher = new PaletteSwitcher();
    let socket;
    function connect() {
        socket = new WebSocket(serverUrl);
        // Type of information received by websocket
        socket.binaryType = 'arraybuffer';

        // register handler of the incoming messages
        socket.onmessage = (e) => terminal.receiveMessage(ScreenState.decode(e.data));

        // register reconnect
        socket.onclose = () => {
            setTimeout(() => { connect() }, 5000)
        };
    }
    connect();

    updateCss(DEFAULT_PALETTE);

    const element = document.getElementById('terminal');
    element.onkeydown = e => {
        let message = keyToMessage(e);
        if (message) {
            socket.send(message);
            e.preventDefault();
            return false;
        }
    };
    element.onkeypress = e => {
        let message = keyToMessage(e);
        if (message) {
            socket.send(message);
        }
    };
    element.focus()
});

/**
 * Function that change color scheme according to the chosen palette
 * @param {string} palette - Name of chosen palette
 */
function updateCss(palette) {
    let css = 'css/' + palette + '.css';
    // remove old css
    $("<link/>", {
        rel: "stylesheet",
    }).remove();

    // add new css
    $("<link/>", {
        rel: "stylesheet",
        href: css
    }).appendTo("head");
}

/**
 * Class that represents palette switcher list
 */
class PaletteSwitcher {
    constructor() {
        for (let palette of paletteList) {
            $('#palette-list').append('<li id="{0}">{0}</li>'.format(palette));
            let element = document.getElementById(palette);
            element.onclick = function () {
                updateCss(element.id);
            }
        }
    }
}

/**
 * Class represents terminal screen
 */
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
                cell.id = this.getCellId(i, j);
                cell.className = 'fg-default bg-default';
                cell.innerText = ' ';
                this.screen[i][j] = cell;
            }
        }
    }

    /**
     * returns id of cell on (i, j) position
     * @param {number} i
     * @param {number} j
     */
    getCellId(i, j) {
        return 'cell_{0}_{1}'.format(i, j);
    }

    /**
     * returns cell on (i, j) position
     * @param {number} i
     * @param {number} j
     */
    getCell(i, j) {
        return document.getElementById(this.getCellId(i, j));
    }

    /**
     * Sets color to cell
     */
    setColor(cell, color, type) {
        const className = type + '-' + color;
        let regexp;
        if (type === 'fg')
            regexp = /fg-\w*/;
        else
            regexp = /bg-\w*/;
        cell.className = cell.className.replace(regexp, className);
    }

    /**
     * Sets foreground color.
     * @param {string} color
     */
    setFgColor(cell, color) {
        this.setColor(cell, color, 'fg')
    }

    /**
     * Sets background color.
     * @param {string} color
     */
    setBgColor(cell, color) {
        this.setColor(cell, color, 'bg')
    }

    /**
     * Sets reversed colors.
     */
    setReverseColor(cell) {
        this.setFgColor(cell, 'reverse');
        this.setBgColor(cell, 'reverse');
    }

    /**
     * Sets default colors.
     */
    setDefaultColor(cell) {
        this.setFgColor(cell, 'default');
        this.setBgColor(cell, 'default');
    }

    /**
     * Sets symbol in cell.
     * @param {string} sym
     */
    setSymbol(cell, symbol) {
        cell.innerText = symbol;
    }

    /**
     * Handler of the incoming message
     * @param message -- decoded protobuf message
     */
    receiveMessage(message) {
        // new cursor position
        let cx = message.cursor_x;
        let cy = message.cursor_y;

        // little line feed hack
        if (cx == this.width) {
            cx = 0;
            cy++;
        }

        this.eraseCursor();

        // update lines from message
        for (let screenLine of message.lines) {
            let i = screenLine.i;
            let cells = screenLine.cells;
            for (let j = 0; j < this.width; j++) {
                const cell = this.getCell(i, j);
                let {
                    character: data,
                    reversed: reversed,
                    fg_color: fg,
                    bg_color: bg
                } = cells[j];

                fg = protocolColors[fg];
                bg = protocolColors[bg];

                this.setSymbol(cell, data);

                this.setFgColor(cell, fg);
                this.setBgColor(cell, bg);

                if (reversed) {
                    this.setReverseColor(cell);
                }
            }
        }
        this.updateCursor(cx, cy);
    }

    /**
     * Updates coordinates of cursor and set to the cursor cell reversed colors
     * @param {number} x
     * @param {number} y
     */
    updateCursor(x, y) {
        this.cursor = {x: x, y: y};
        if (y < this.height && x < this.width) {
            this.setReverseColor(this.getCell(y, x));
        }
    }

    /**
     * Reset colors of the cursor cell to defaults
     */
    eraseCursor() {
        let {x, y} = this.cursor;
        if (y < this.height && x < this.width) {
            this.setDefaultColor(this.getCell(y, x));
        }
    }
}

/**
 * Function that transform keyDown or keyPress event to
 *   the char or escape or control symbol/sequence
 * @param e -- keyDown/keyPress event
 * @returns {string} -- string corresponding pressed keys
 */
function keyToMessage(e) {
    /**
     * @param {number} x -- key number
     * @returns {string} -- symbol corresponds Ctrl+key combination
     */
    function ctrlKey(x) {
        return String.fromCharCode(x - 65 + 1);
    }

    // key press event
    if (e.type === "keypress") {
        if (e.which == null) { // IE
            return (e.keyCode < 32)
                ? null // special symbol
                : String.fromCharCode(e.keyCode);
        }

        if (e.which != 0 && e.charCode != 0) { // all browses except IE
            return (e.which < 32)
                ? null // special symbol
                : String.fromCharCode(e.which); // остальные
        }

        return null; // special symbol
    }

    // keyDown event
    let message = null;
    if (e.which == 8) { // backspace
        message = ctrl.BACKSPACE;
    } else if (e.which == 9) { // tab
        message = ctrl.TAB;
    } else if (e.which == 13) { // enter
        message = ctrl.LF;
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
        let number = e.which - 111;
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

/**
 * Function that synchronously reads json file
 * @param jsonPath -- path to file
 * @returns -- content of file
 */
function getJson (jsonPath){
    let result = null;

    $.ajax({
        url: jsonPath,
        async: false,
        dataType: "json",
        success: function(data){
            result = data;
        }});
    return result;
}

// String format function definition
if (!String.prototype.format) {
    String.prototype.format = function() {
        let args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}

// map represents the string color names through the protobuf color types
const protocolColors = {
    0: 'black',
    1: 'red',
    2: 'green',
    3: 'brown',
    4: 'blue',
    5: 'magneta',
    6: 'cyan',
    7: 'white',
    8: 'default'
};

// control symbols
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

// symbols for Ctrl+number combinations
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