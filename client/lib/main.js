/*
 * Copyright 2015-2016 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var argv = require('argv'),
    repl = require('./repl').repl,
    colors = require('colors'),
    events = require('events'),
    package = require('../package.json'),
    eventBus = new events.EventEmitter(),
    WebSocket = require('ws'),
    debugNodeJS = require('./debug-nodejs').debug,
    debugSwift = require('./debug-swift').debug,
    debugPython = require('./debug-python').debug,
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

exports.main = function() {

var commandLineOptionsConfig = [
    {name: 'use-cli-debugger', short: 'c', type: 'string', description: 'Favor the CLI for debug sessions over a GUI'},
    {name: 'no-color', type: 'string', description: 'Avoid using console colors'} // this comes from the colors module
];
argv.info('Usage: wskdb [attachTo] [options...]'.red + '\n\nWhere each option is one of the following:');
argv.version(package.version);
var commandLineOptions = argv
    .option(commandLineOptionsConfig)
    .run()
    .options;

var ws = new WebSocket(broker.host + broker.path);

ws.on('open', function open() {
    console.log('Welcome to the OpenWhisk Debugger'.red);

    if (commandLineOptions) {
	for (var x in commandLineOptions) {
	    if (commandLineOptions.hasOwnProperty(x)) {
		console.log(('    + ' + commandLineOptionsConfig.find((o) => o.name === x).description).dim);
	    }
	}
    }
    console.log();

    var wskprops = propertiesParser.read(expandHomeDir('~/.wskprops'));
    var key = wskprops.AUTH;
    ws.send(JSON.stringify({
	type: 'init',
	key: key
    }));

    var keepAlive = setInterval(function poke() {
	try {
	    ws.send(JSON.stringify({
		type: 'keep-alive'
	    }));
	} catch (e) {
	    console.error();
	    console.error('It looks like your network went offline. Please restart wskdb when your network is live.');
	    process.exit(1);
	}
    }, 5000);

    process.on('exit', function onExit() {
	try {
	    console.log('Goodbye!'.red);
	    clearInterval(keepAlive);
	    
	    ws.send(JSON.stringify({
		type: 'disconnect'
	    }, function ack() {
		ws.close();
	    }));
	} catch (e) {
	}
    });

    //
    // does the user want to attach to an action right up front?
    //
    var attachTo;
    try {
	attachTo = process.argv.slice(2).find(arg => {
	    arg = arg.replace(/-/g, '');
	    return !commandLineOptions.hasOwnProperty(arg) // not a long option
		&& !commandLineOptionsConfig.find(opt => opt.short === arg); // and not a short option
	});
    } catch (e) {
	// uncomment this for debugging:
	// console.error('error',e);
    }

    repl(wskprops, eventBus, attachTo);
});

ws.on('close', function() {
    //console.log('Remote connection closed');
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

	    var done = function done(err, result) {
		// console.log('Finishing up this debug session');

		ws.send(JSON.stringify({
		    type: err ? 'circuit-breaker' : 'end',
		    key: message.key,
		    activationId: message.activationId,
		    result: result
		}));

		//ws.close();
	    };
	    var circuitBreaker = function circuitBreaker() {
		ws.send(JSON.stringify({
			type: 'circuit-breaker',
			key: message.key,
			activationId: message.activationId,
		}));
	    };

	    if (message.onDone_trigger) {
		if (message.action && message.action.exec) {
		    var kind = message.action.exec.kind;
		    var debugHandler;
		    
		    if (!kind || kind.indexOf('nodejs') >= 0) {
			// !kind because nodejs is the default
			debugHandler = debugNodeJS;
		    } else if (kind.indexOf('swift') >= 0) {
			debugHandler = debugSwift;
		    } else if (kind.indexOf('python') >= 0) {
			debugHandler = debugPython;
		    }

		    if (debugHandler) {
			debugHandler(message, ws, { trigger: message.onDone_trigger }, done, commandLineOptions, eventBus);
		    } else {
			console.error('Unable to complete invocation, because this action\'s kind is not yet handled: ' + kind);
			circuitBreaker();
		    }

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

};
