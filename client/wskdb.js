var repl = require('./lib/repl').repl,
    colors = require('colors'),
    WebSocket = require('ws'),
    debugNodeJS = require('./lib/debug-nodejs').debug,
    expandHomeDir = require('expand-home-dir'),
    propertiesParser = require('properties-parser'),

    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    },
    broker = {
	host: 'https://owdbg-broker.mybluemix.net',
	path: '/ws/client/register'
    };

var ws = new WebSocket(broker.host + broker.path);

ws.on('open', function open() {
    console.log('Welcome to the OpenWhisk Debugger'.red);
    console.log();

    var wskprops = propertiesParser.read(expandHomeDir('~/.wskprops'));
    var key = wskprops['AUTH'];
    ws.send(JSON.stringify({
	type: 'init',
	key: key
    }));

    var keepAlive = setInterval(function poke() {
	ws.send(JSON.stringify({
	    type: 'keep-alive'
	}));
    }, 5000);

    process.on('exit', function onExit() {
    try {
	console.log('Goodbye!'.red);
	clearTimer(keepAlive);

	ws.send(JSON.stringify({
	    type: 'disconnect'
	}, function ack() {
	    ws.close();
	}));
    } catch (e) {
    }
});


    repl(wskprops);
});

ws.on('close', function() {
    console.log('Remote connection closed');
});
 
ws.on('message', function(data, flags) {
    //console.log('MESSAGE ' + data + ' ||| ' + JSON.stringify(flags));
    
    //
    // flags.binary will be set if a binary data is received. 
    // flags.masked will be set if the data was masked.
    //
    try {
	var message = JSON.parse(data);
	switch (message.type) {
	case 'invoke':
	    console.log('Debug session requested');
	    //console.log(JSON.stringify(message, undefined, 4));

	    function done(err, result) {
		// console.log('Finishing up this debug session');

		ws.send(JSON.stringify({
		    type: err ? 'circuit-breaker' : 'end',
		    key: message.key,
		    activationId: message.activationId,
		    result: result
		}));

		//ws.close();
	    }
	    function circuitBreaker() {
		ws.send(JSON.stringify({
			type: 'circuit-breaker',
			key: message.key,
			activationId: message.activationId,
		}));
	    }
	    function next(echoChamberNames) {
	    }
	    var nextOnErr = done.bind(undefined, true);

	    if (message.onDone_trigger) {
		if (message.action && message.action.exec && message.action.exec.kind.indexOf('nodejs') >= 0) {
		    debugNodeJS(message, ws, { trigger: message.onDone_trigger }, done);
		} else {
		    console.error('Unable to complete invocation: no action code to debug');
		    circuitBreaker();
		}
	    } else {
		console.error('Unable to complete invocation: no onDone_trigger specified');
		circuitBreaker();
	    }

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

