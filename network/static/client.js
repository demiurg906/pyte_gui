var socket = new WebSocket('ws://0.0.0.0:8080/ws');

const WIDTH = 80;
const HEIGHT = 24;
var cursor = {'x': 0, 'y': 0};

prepareTable = function() {
    var table = document.getElementById('screen');
    for (var i = 0; i < HEIGHT; i++) {
        var row = table.insertRow(i);
        for (var j = 0; j < WIDTH; j++) {
            var cell = row.insertCell(j);
            cell.setAttribute('id', 'cell_' + i + '_' + j);
            cell.innerText = ' ';
        }
    }
};

prepareTable();

function sendMessage(message, type) {
    socket.send(message);
    // socket.send(JSON.stringify({'message': message, 'type': type}));
}

document.getElementById('terminal').onkeydown = function(e) {
    console.log(e.keyCode);
    var message = null;
    if (e.which == 8) { // backspace
        message = ctrl.BS;
    } else if (e.which == 9) { // tab
        message = ctrl.CSI + esc.HTS;
    } else if (e.which == 13) { // enter
        message = ctrl.LF;
    } else if (e.which == 20) { // caps lock

    } else if (e.which == 27) { // esc
        message = ctrl.ESC;
    } else if (e.which == 33) { // page up

    } else if (e.which == 34) { // page down

    } else if (e.which == 35) { // end

    } else if (e.which == 36) { // home

    } else if (e.which == 37) { // left arrow
        message = ctrl.CSI + esc.CUB;
    } else if (e.which == 38) { // up arrow
        message = ctrl.CSI + esc.CUU;
    } else if (e.which == 39) { // right arrow
        message = ctrl.CSI + esc.CUF;
    } else if (e.which == 40) { // down arrow
        message = ctrl.CSI + esc.CUD;
    } else if (e.which == 45) { // insert

    } else if (e.which == 46) { // delete
        message = ctrl.DEL;
    }
    // TODO: add support for ctrl+ combinations
    if (message) {
        sendMessage(message, msgType.CONTROL);
    }
};

// event.type должен быть keypress
function getChar(event) {
  if (event.which == null) { // IE
    if (event.keyCode < 32) return null; // спец. символ
    return String.fromCharCode(event.keyCode)
  }

  if (event.which != 0 && event.charCode != 0) { // все кроме IE
    if (event.which < 32) return null; // спец. символ
    return String.fromCharCode(event.which); // остальные
  }

  return null; // спец. символ
}

document.getElementById('terminal').onkeypress = function (e) {
    var message = getChar(e);
    if (e.ctrlKey && message == 'c') {
        message = ctrl.CAN;
        sendMessage(message, msgType.CONTROL);
        return;
    }
    if (message) {
        sendMessage(message, msgType.COMAND);
    }
};

// обработчик входящих сообщений
socket.onmessage = function(event) {
    var answer = event.data;
    var screen = JSON.parse(answer);
    var display = screen['screen'];
    cursor = screen['cursor'];
    if (cursor['x'] == WIDTH) {
        cursor['x'] = 0;
        cursor['y']++;
    }

    showMessage(display);
};

function getCurrentCell() {
    return getCell(cursor['y'], cursor['x']);
}

function getCell(i, j) {
    var cellName = 'cell_' + i + '_' + j;
    return document.getElementById(cellName);
}

function checkCursor(i, j) {
    return i == cursor['y'] && j == cursor['x']
}

// показать сообщение в div#screen
function showMessage(screen) {
    // getCurrentCell().className = 'cursor';
    for (var i = 0; i < HEIGHT; i++) {
        for (var j = 0; j < WIDTH; j++) {
            var cell = getCell(i, j);
            var ch = screen[i][j][0];
            var fg = screen[i][j][1];
            var bg = screen[i][j][2];
            var reverse = screen[i][j][7];
            if (reverse || checkCursor(i, j))
                cell.className = 'cursor';
            else
                cell.className = '';
            if (fg != 'default')
                cell.color = fg;
            if (bg != 'default')
                cell.backgroundColor = bg;
            cell.innerText = ch;
        }
    }
}

const msgType = {
    COMAND: 'comand',
    CONTROL: 'control'
};

const esc = {
    //: *Reset*.
    RIS: 'c',

    //: *Index*: Move cursor down one line in same column. If the cursor is
    //: at the bottom margin, the screen performs a scroll-up.
    IND: 'D',

    //: *Next line*: Same as :data:`pyte.control.LF`.
    NEL: 'E',

    //: Tabulation set: Set a horizontal tab stop at cursor position.
    HTS: 'H',

    //: *Reverse index*: Move cursor up one line in same column. If the
    //: cursor is at the top margin, the screen performs a scroll-down.
    RI: 'M',

    //: Save cursor: Save cursor position, character attribute (graphic
    //: rendition), character set, and origin mode selection (see
    //: :data:`DECRC`).
    DECSC: '7',

    //: *Restore cursor*: Restore previously saved cursor position, character
    //: attribute (graphic rendition), character set, and origin mode
    //: selection. If none were saved, move cursor to home position.
    DECRC: '8',


    // 'Percent' escape sequences.
    // ---------------------------

    //: *Select default (ISO 646 / ISO 8859-1)*.
    DEFAULT: '@',

    //: *Select UTF-8*.
    UTF8: 'G',

    //: *Select UTF-8 (obsolete)*.
    UTF8_OBSOLETE: '8',


    // 'Sharp' escape sequences.
    // -------------------------

    //: *Alignment display*: Fill screen with uppercase E's for testing
    //: screen focus and alignment.
    DECALN: '8',


    // ECMA-48 CSI sequences.
    // ---------------------

    //: *Insert character*: Insert the indicated // of blank characters.
    ICH: '@',

    //: *Cursor up*: Move cursor up the indicated // of lines in same column.
    //: Cursor stops at top margin.
    CUU: 'A',

    //: *Cursor down*: Move cursor down the indicated // of lines in same
    //: column. Cursor stops at bottom margin.
    CUD: 'B',

    //: *Cursor forward*: Move cursor right the indicated // of columns.
    //: Cursor stops at right margin.
    CUF: 'C',

    //: *Cursor back*: Move cursor left the indicated // of columns. Cursor
    //: stops at left margin.
    CUB: 'D',

    //: *Cursor next line*: Move cursor down the indicated // of lines to
    //: column 1.
    CNL: 'E',

    //: *Cursor previous line*: Move cursor up the indicated // of lines to
    //: column 1.
    CPL: 'F',

    //: *Cursor horizontal align*: Move cursor to the indicated column in
    //: current line.
    CHA: 'G',

    //: *Cursor position*: Move cursor to the indicated line, column (origin
    //: at ``1, 1``).
    CUP: 'H',

    //: *Erase data* (default: from cursor to end of line).
    ED: 'J',

    //: *Erase in line* (default: from cursor to end of line).
    EL: 'K',

    //: *Insert line*: Insert the indicated // of blank lines, starting from
    //: the current line. Lines displayed below cursor move down. Lines moved
    //: past the bottom margin are lost.
    IL: 'L',

    //: *Delete line*: Delete the indicated // of lines, starting from the
    //: current line. As lines are deleted, lines displayed below cursor
    //: move up. Lines added to bottom of screen have spaces with same
    //: character attributes as last line move up.
    DL: 'M',

    //: *Delete character*: Delete the indicated // of characters on the
    //: current line. When character is deleted, all characters to the right
    //: of cursor move left.
    DCH: 'P',

    //: *Erase character*: Erase the indicated // of characters on the
    //: current line.
    ECH: 'X',

    //: *Horizontal position relative*: Same as :data:`CUF`.
    HPR: 'a',

    //: *Device Attributes*.
    DA: 'c',

    //: *Vertical position adjust*: Move cursor to the indicated line,
    //: current column.
    VPA: 'd',

    //: *Vertical position relative*: Same as :data:`CUD`.
    VPR: 'e',

    //: *Horizontal / Vertical position*: Same as :data:`CUP`.
    HVP: 'f',

    //: *Tabulation clear*: Clears a horizontal tab stop at cursor position.
    TBC: 'g',

    //: *Set mode*.
    SM: 'h',

    //: *Reset mode*.
    RM: 'l',

    //: *Select graphics rendition*: The terminal can display the following
    //: character attributes that change the character display without
    //: changing the character (see :mod:`pyte.graphics`).
    SGR: 'm',

    //: *Device status report*.
    DSR: 'n',

    //: *Select top and bottom margins*: Selects margins, defining the
    //: scrolling region; parameters are top and bottom line. If called
    //: without any arguments, whole screen is used.
    DECSTBM: 'r',

    //: *Horizontal position adjust*: Same as :data:`CHA`.
    HPA: '\''
};

const ctrl = {
    //: *Space*: Not suprisingly -- ``' '``.
    SP: ' ',
    
    //: *Null*: Does nothing.
    NUL: '\u0000',
    
    //: *Bell*: Beeps.
    BEL: '\u0007',
    
    //: *Backspace*: Backspace one column, but not past the begining of the
    //: line.
    BS: '\u0008',
    
    //: *Horizontal tab*: Move cursor to the next tab stop, or to the end
    //: of the line if there is no earlier tab stop.
    HT: '\u0009',
    
    //: *Linefeed*: Give a line feed, and, if :data:`pyte.modes.LNM` (new
    //: line mode) is set also a carriage return.
    LF: '\n',
    //: *Vertical tab*: Same as :data:`LF`.
    VT: '\u000b',
    //: *Form feed*: Same as :data:`LF`.
    FF: '\u000c',
    
    //: *Carriage return*: Move cursor to left margin on current line.
    CR: '\r',
    
    //: *Shift out*: Activate G1 character set.
    SO: '\u000e',
    
    //: *Shift in*: Activate G0 character set.
    SI: '\u000f',
    
    //: *Cancel*: Interrupt escape sequence. If received during an escape or
    //: control sequence, cancels the sequence and displays substitution
    //: character.
    CAN: '\u0018',
    //: *Substitute*: Same as :data:`CAN`.
    SUB: '\u001a',
    
    //: *Escape*: Starts an escape sequence.
    ESC: '\u001b',
    
    //: *Delete*: Is ignored.
    DEL: '\u007f',
    
    //: *Control sequence introducer*: An equivalent for ``ESC [``.
    // CSI: '\u009b'
    CSI: '\u001b['
};