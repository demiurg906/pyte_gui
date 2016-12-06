const $ = require('jquery');
const React = require('react');
const Ranger = require('../lib');

const ProtoBuf = require("protobufjs");


const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;
const DEFAULT_CSS = "css/xcolors.net/dkeg-panels.css";

const serverUrl = 'ws://' + window.location.host + '/ws';

// protocol initialization
const ScreenState = ProtoBuf.loadProtoFile('screen-message.proto').build("ScreenState");

$(function () {
    let store = Ranger.createStore(null, function (item) {
        console.log('opening', item);
    });

    let ItemView = React.createClass({
        render: function () {
            function getJson(jsonPath) {
                let result = null;

                $.ajax({
                    url: jsonPath,
                    async: false,
                    dataType: "json",
                    success: function (data) {
                        result = data;
                    }
                });
                return result;
            }

            let colors = new Array(18);
            let jsonPath = 'schemes' + this.props.item.path + '.json';
            let {name, author, color, foreground, background} = getJson(jsonPath);
            colors[0] = <div key="0" className="color" style={{color: background, background: foreground}}>
                <div className="text">FG</div>
                <div className="helper"></div>
            </div>;
            colors[1] = <div key="1" className="color" style={{color: foreground, background: background}}>
                <div className="text">BG</div>
                <div className="helper"></div>
            </div>;
            for (let i = 2; i < 18; i += 2) {
                colors[i] = <div className="color" key={i} style={{background: color[i / 2 - 1]}}/>;
                colors[i + 1] = <div className="color" key={i + 1} style={{background: color[i / 2 + 7]}}/>
            }
            return (
                <div className="schemes">
                    <p><strong>Name:</strong> {name}</p>
                    <p><strong>Author:</strong> {author}</p>
                    <button onClick={() => {
                        let pathToCss = 'css' + this.props.item.path + '.css';
                        updateCss(pathToCss.replace(/ /g, '-').replace(/---/g, '-'));
                    }}>Apply Scheme
                    </button>
                    <div className="colors">
                        {colors}
                    </div>
                </div>
            );
        }
    });

    React.render(
        <div>
            <Terminal/>
            <Ranger store={store} view={ItemView} />
        </div>, document.body);

    $.get('schemes/index.json').then(function (content) {
        store.setRootDir(Ranger.parseList(content));
    });
    updateCss(DEFAULT_CSS);
    $("#terminal").focus()
});

function updateCss(css) {
    $("<link/>", {
        rel: "stylesheet",
    }).remove();
    $("<link/>", {
        rel: "stylesheet",
        href: css
    }).appendTo("head");
}

let Cell = React.createClass({
    getInitialState: function () {
        return {
            symbol: ' ',
            fg: 'fg-default',
            bg: 'bg-default'
        };
    },

    setFgColor: function (color) {
        this.setState({
            fg: 'fg-' + color
        });
    },

    setBgColor: function (color) {
        this.setState({
            bg: 'bg-' + color
        });
    },

    setDefaultColor: function () {
        this.setState({
            fg: 'fg-default',
            bg: 'bg-default'
        });
    },

    setReverseColor: function () {
        this.setState({
            fg: 'fg-reverse',
            bg: 'bg-reverse'
        });
    },

    setSymbol: function (sym) {
        this.setState({
            symbol: sym
        });
    },

    render: function () {
        return (
            <td className={this.state.fg + ' ' + this.state.bg}>{this.state.symbol}</td>
        );
    }

});

let Terminal = React.createClass({

    getInitialState() {
        return {
            cursor: {'x': 0, 'y': 0},
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT
        };
    },

    componentDidMount() {
        this.start();
    },

    start() {
        let socket = new WebSocket(serverUrl);
        socket.binaryType = 'arraybuffer';

        socket.onmessage = (e) => this.receiveMessage(ScreenState.decode(e.data));

        socket.onclose = () => {
            setTimeout(() => {
                this.start()
            }, 5000)
        };
        this.setState({socket: socket});
    },

    send(message, type) {
        this.state.socket.send(message);
    },

    getCell(i, j) {
        return this.refs['cell_' + i + '_' + j]
    },

    receiveMessage(message) {
        let cx =  message.cursor_x;
        let cy = message.cursor_y;
        if (cx == this.state.width) {
            cx = 0;
            cy++;
        }
        this.eraseCursor();
        for (let screenLine of message.lines) {
            let i = screenLine.i;
            let cells = screenLine.cells;
            for (let j = 0; j < this.state.width; j++) {
                // const cell = this.screen[i][j];
                const cell = this.getCell(i, j);
                let {character: data,
                    reversed: reversed,
                    fg_color: fg,
                    bg_color: bg } = cells[j];

                fg = protocolColors[fg];
                bg = protocolColors[bg];

                cell.setSymbol(data);

                cell.setFgColor(fg);
                cell.setBgColor(bg);

                if (reversed) {
                    cell.setReverseColor();
                }
            }
        }
        this.updateCursor(cx, cy);
    },

    updateCursor(x, y) {
        this.setState({
            cursor: {x: x, y: y}
        });
        if (y < this.state.height && x < this.state.width) {
            this.getCell(y, x).setReverseColor();
        }
    },

    eraseCursor() {
        let {x, y} = this.state.cursor;
        if (y < this.state.height && x < this.state.width) {
            this.getCell(y, x).setDefaultColor();
        }
    },

    onKeyDown(e) {
        const message = keyToMessage(e);
        if (message) {
            this.send(message, 'control');
            e.preventDefault();
            return false;
        }
    },

    onKeyPress(e) {
        let message = keyToMessage(e);
        if (message) {
            this.send(message, 'command');
        }
    },

    render: function () {
        let rows = [];
        for (let i = 0; i < this.state.height; i++) {
            let row = [];
            for (let j = 0; j < this.state.width; j++) {
                row.push(<Cell
                    key={'(' + i + ',' + j + ')'}
                    x={i}
                    y={j}
                    ref={'cell_' + i + '_' + j}

                />);
            }
            rows.push(<tr key={'row ' + i}>{row}</tr>);
        }
        return (
            <div id="terminal"
                 tabIndex="1"
                 onKeyDown={this.onKeyDown}
                 onKeyPress={this.onKeyPress}
            >
                <table id="screen" frame="border">
                    {rows}
                </table>
            </div>
        );
    }
});

function keyToMessage(e) {
    // console.log(e.keyCode);

    function ctrlKey(x) {
        return String.fromCharCode(x - 65 + 1);
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

    console.log('pressed key ' + e.which);
    let message = null;
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

const сolorStyles = {
    0: '#screen td.fg-black',
    1: '#screen td.fg-red',
    2: '#screen td.fg-green',
    3: '#screen td.fg-brown',
    4: '#screen td.fg-blue',
    5: '#screen td.fg-magenta',
    6: '#screen td.fg-cyan',
    7: '#screen td.fg-white',
    8: '#screen td.bg-black',
    9: '#screen td.bg-red',
    10: '#screen td.bg-green',
    11: '#screen td.bg-brown',
    12: '#screen td.bg-blue',
    13: '#screen td.bg-magenta',
    14: '#screen td.bg-cyan',
    15: '#screen td.bg-white'
};

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