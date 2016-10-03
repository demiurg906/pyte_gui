var socket = new WebSocket('ws://0.0.0.0:8080/ws');
var command = '';

const WIDTH = 500;
const HEIGHT = 24;
var cursor = 0;

prepare_table = function() {
    var table = document.getElementById('screen');
    for (var i = 0; i < HEIGHT; i++) {
        var cell = table.insertRow(i).insertCell(0);
        cell.setAttribute('id', 'line_' + i);
        cell.setAttribute('width', String(WIDTH));
    }
};

prepare_table();

document.getElementById('terminal').onkeydown = function(event) {
    console.log(event.keyCode)
    if (event.keyCode == 13) {
        console.log('command = ' + command);
        socket.send(command);
        if (command == '')
            cursor++;
        command = '';
        return
    } else if (event.keyCode == 8) {
        if (command != '') {
            command = command.substr(0, command.length - 1);
        }
    } else {
        var ch = String.fromCharCode(event.keyCode)
        command += ch;
    }
    var line = document.getElementById('line_' + cursor);
    //TODO: change to formatted String
    var content = (cursor + 1) + ': ' + command;
    line.innerHTML = '<span style="color: white;">' + content + '</span>';
};

// обработчик входящих сообщений
socket.onmessage = function(event) {
    var incomingMessage = event.data;
    var screen = incomingMessage.split('\n');
    showMessage(screen);
};

// показать сообщение в div#screen
function showMessage(screen) {
    function find_cursor() {
        for (var i = screen.length - 2; i >= 0; i--) {
            var s = screen[i];
            var ss = s.substr(4).trim();
            if (screen[i].substr(4).trim() != '')
                return i + 1;
        }
        return 0;
    }
    // console.log(screen.length);
    var new_cursor = find_cursor();
    if (new_cursor > cursor)
        cursor = new_cursor;
    screen.forEach(function (screen_line, i, screen) {
        if (i == HEIGHT)
            return;
        var line = document.getElementById('line_' + i);

        if (i == cursor) {
            line.setAttribute('bgcolor', 'black');
            line.innerHTML = '<span style="color: white; ">' + screen_line + '</span>';
        } else {
            line.setAttribute('bgcolor', 'white');
            line.innerHTML = '<span style="color: black;">' + screen_line + '</span>';
        }
        // console.log(screen_line);
    });
}