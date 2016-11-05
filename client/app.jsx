var $ = require('jquery');
var React = require('react');

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;
const serverUrl = 'ws://0.0.0.0:8080/ws';

$(function () {
    // const terminal = Terminal();
    // terminal.render();
    React.render(<Terminal/>, document.body);
    // $("#terminal").focus()

});

var Cell = React.createClass({
    getInitialState: function () {
        return {
            symbol: ' ',
            fg: 'fg-default',
            bg: 'bg-default'
        };
    },

    setFgColor: function(color) {
        this.setState({
            fg: color
        });
    },

    setBgColor: function(color) {
        this.setState({
            bg: color
        });
    },

    setDefaultColor: function() {
        this.setState({
            fg: 'fg-default',
            bg: 'bg-default'
        });
    },

    setReverseColor: function() {
        this.setState({
            fg: 'fg-reverse',
            bg: 'bg-reverse'
        });
    },

    setSymbol: function(sym) {
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

var Terminal = React.createClass({

    getInitialState() {
        let width = DEFAULT_WIDTH;
        let height = DEFAULT_HEIGHT;
        this.screen = new Array(height);
        for (let i = 0; i < DEFAULT_HEIGHT; i++) {
            this.screen[i] = new Array(width);
            for (let j = 0; j < width; j++) {
                this.screen[i][j] = null;
            }
        }
        return {
            cursor: {'x': 0, 'y': 0},
            width: width,
            height: height,
        };
    },

    componentDidMount() {
        this.start();
    },

    start() {
        let socket = new WebSocket(serverUrl);
        socket.onmessage = (e) => this.receiveMessage(JSON.parse(e.data));
        socket.onclose = () => {setTimeout(() => {this.start()}, 5000)};
        this.setState({socket: socket});
    },

    send(message, type) {
        this.socket.send(message);
    },

    eraseCursor() {
        let {x, y} = this.state.cursor;
        if (y < this.state.height && x < this.state.width) {
            this.state.screen[y][x].setDefaultColor();
        }
    },

    receiveMessage(message) {
        let {cursor: {x: cx, y: cy}, screen, dirty} = message;
        if (cx == this.width) {
            cx = 0;
            cy++;
        }

        this.eraseCursor();
        for (let i of dirty) {
            for (let j = 0; j < this.state.width; j++) {
                const cell = this.screen[i][j];
                let [data, fg, bg,
                    bold, italics, underscore, strikethrough,
                    reverse] = screen[i][j];

                // console.log(data);
                cell.setSymbol(data);

                cell.setFgColor(fg);
                cell.setBgColor(bg);

                if (reverse)
                    cell.setReverse();
            }
        }
        this.updateCursor();
    },

    updateCursor(x, y) {
        this.setState({
            cursor: {x: x, y: y}
        });
        if (y < this.state.height && x < this.state.width) {
            this.state.screen[y][x].setReverseColor();
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

    render: function () {
        let rows = [];
        for (let i = 0; i < this.state.height; i++) {
            let row = [];
            for (let j = 0; j < this.state.width; j++) {
                row.push(<Cell
                    key={'(' + i + ',' + j + ')'}
                    x={i}
                    y={j}
                    ref={(cell) => {
                        console.log(cell.props.x);
                        this.screen[cell.props.x][cell.props.y] = cell;
                    }}
                />);
            }
            rows.push(<tr key={'row ' + i}>{row}</tr>);
        }
        return (
            <div id="terminal" tabIndex="1">
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
