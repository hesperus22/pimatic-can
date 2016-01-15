var Can =  require('./programator.js').Can;
var SerialPortStream = require('serial-port-stream');
var Babysitter = require('babysitter');
	
var sitter = Babysitter.watch( function( options, done ){
    var connection = net.createConnection( options.port, options.host );
    done( null, connection );
}), {
    // Options to be passed to the connect function 
    host: 'localhost',
    port: '8000'
});

sitter.on( 'connect', function(){
    console.log('connect!');
});

sitter.on( 'close', function(){
    console.log('close!');
});