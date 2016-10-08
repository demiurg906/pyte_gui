var socket = new WebSocket('ws://0.0.0.0:8080/ws');
var command = '';

const WIDTH = 80;
const HEIGHT = 24;
var cursor = {'x': 0, 'y': 0};

prepare_table = function() {
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

prepare_table();

document.getElementById('terminal').onkeydown = function(event) {
    console.log(event.keyCode)
    // if (event.keyCode == 13) {
    //     console.log('command = ' + command);
    //     socket.send(command);
    //     if (command == '')
    //         cursor++;
    //     command = '';
    //     return
    // } else if (event.keyCode == 8) {
    //     if (command != '') {
    //         command = command.substr(0, command.length - 1);
    //     }
    // } else {
    //     var ch = String.fromCharCode(event.keyCode)
    //     command += ch;
    // }
    var ch = String.fromCharCode(event.which);
    getCurrentCell().className = '';
    socket.send(ch);
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

// показать сообщение в div#screen
function showMessage(screen) {
    // console.log(screen.length);
    getCurrentCell().className = 'cursor'
    for (var i = 0; i < HEIGHT; i++) {
        for (var j = 0; j < WIDTH; j++) {
            var cell = getCell(i, j);
            // if (j == cursor['x'] && i == cursor['y']) {
            //     cell.className = 'cursor';
            // } else {
            //     cell.className = '';
            // }
            cell.innerText = screen[i].charAt(j);
        }
    }
}