var prog = require('./programator.js');
var menu = require('node-menu');
var figlet = require('figlet');
var Can = prog.Can;
var SerialPortStream = require('serial-port-stream');
var http = require('http').Server();
//var io = require('socket.io')(http);

//http.listen(3000);

var port = new SerialPortStream('/dev/ttyACM0');

var can = new Can(port, 2);

port.on('error', function(){
    port = new SerialPortStream('COM6');
    can = new Can(port, 2);
    
    can.on('data', function(msg){
        console.log(msg);
        if(msg.state === 1){
            togglePin(msg.addr, (msg.pin+5)%10);
        }
    });
    can.resume();
})

var pins = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

var togglePin = function(addr, pin){
    pins[pin] = 1 - pins[pin];
    can.write({ addr: addr, op:'setPin', pin: pin, state: pins[pin]});
}

var writePin = function(addr, pin, state){
    pins[pin] = state;
    can.write({ addr: addr, op:'setPin', pin: pin, state: pins[pin]});
}

can.on('data', function(msg){
    console.log(msg);
    if(msg.state === 1){
        togglePin(msg.addr, (msg.pin+5)%10);
    }
});
can.resume();

figlet('Manual CAN control v0.1', function(err, data) {
    if (err) {
        console.log('Something went wrong...');
        console.dir(err);
        return;
    }
    
    menu.addDelimiter('-', 40, 'Main Menu')
        .addItem(
            'Toggle pin', 
            function(addr, pin) {
                togglePin(addr, pin);
            },
            null, 
            [{'name': 'addr', 'type': 'numeric'}, {'name': 'pin', 'type': 'numeric'}])
        .addItem(
            'Set pin', 
            function(addr, pin) {
                writePin(addr, pin, 1);
            },
            null, 
            [{'name': 'addr', 'type': 'numeric'}, {'name': 'pin', 'type': 'numeric'}])
        .addItem(
            'Reset pin',
            function(addr, pin) {
                writePin(addr, pin, 0);
            },
            null, 
            [{'name': 'addr', 'type': 'numeric'}, {'name': 'pin', 'type': 'numeric'}])
        .addItem(
            'Reset',
            function() {
                //can.write({});
            },
            null, 
            [{'name': 'addr', 'type': 'numeric'}])
        .addDelimiter('*', 40)
        .customHeader(function() { 
            process.stdout.write(data+'\n');
        }) 
        .disableDefaultHeader() 
        .start();
});
