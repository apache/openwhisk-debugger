var WebSocket = require('ws'),
    expandHomeDir = require('expand-home-dir'),
    prompt = require('prompt');

var host = 'https://owdbg.mybluemix.net';
var path = '/ws/client/register';

var uri = host + path;
var ws = new WebSocket(uri);
var key = require('properties-parser').read(expandHomeDir('~/.wskprops'))['AUTH'];

console.log(uri);
console.log(key);
 
ws.on('open', function open() {
    console.log('CONNECTION OPEN');
    ws.send(JSON.stringify({
	type: 'init',
	key: key
    }));
});

ws.on('close', function() {
    console.log('CONNECTION CLOSED ' + JSON.stringify(arguments));
});
 
ws.on('message', function(data, flags) {
    console.log('MESSAGE ' + data + ' ||| ' + JSON.stringify(flags));
    //
    // flags.binary will be set if a binary data is received. 
    // flags.masked will be set if the data was masked.
    //
    try {
	var message = JSON.parse(data);
	switch (message.type) {
	case 'invoke':
	    console.log('INVOKE');
	    console.log(JSON.stringify(message, undefined, 4));

	    prompt.start();
	    prompt.get({
		name: "result", description: "Return value",
		conform: function(result) {
		    try {
			JSON.parse(result);
			return true;
		    } catch (e) {
			console.log("NOPE " + result);
			return false;
		    }
		}
	    }, function(err, values) {
		ws.send(JSON.stringify({
		    type: 'end',
		    key: message.key,
		    activationId: message.activationId,
		    result: values.result
		}));
	    });
	    
	    break;
	}
    } catch (e) {
	console.log(e);
    }
});
 
/*
sending binary data 
ws.on('open', function open() {
  var array = new Float32Array(5);
 
  for (var i = 0; i < array.length; ++i) {
    array[i] = i / 2;
  }
 
  ws.send(array, { binary: true, mask: true });
});
*/
