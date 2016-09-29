var fs = require('fs'),
    tmp = require('tmp'),
    open = require('open'),
    path = require('path'),
    repl = require('./lib/repl').repl,
    spawn = require('child_process').spawn,
    colors = require('colors'),
    columnify = require('columnify'),
    WebSocket = require('ws'),
    expandHomeDir = require('expand-home-dir'),
    propertiesParser = require('properties-parser'),

    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    },
    broker = {
	host: 'https://owdbg-broker.mybluemix.net',
	path: '/ws/client/register'
    },
    continuations = require('./lib/continuations')(api);

var ws = new WebSocket(broker.host + broker.path);

ws.on('open', function open() {
    console.log('Welcome to the OpenWhisk Debugger');
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
		console.log('Finishing up this debug session');

		ws.send(JSON.stringify({
		    type: err ? 'circuit-breaker' : 'end',
		    key: message.key,
		    activationId: message.activationId,
		    result: result
		}));

		//ws.close();
	    }
	    function next(echoChamberNames) {
		if (message.action && message.action.exec && message.action.exec.kind.indexOf('nodejs') >= 0) {
		    debugNodeJS(message, ws, echoChamberNames, done);
		} else {
		    ws.send(JSON.stringify({
			type: 'circuit-breaker',
			key: message.key,
			activationId: message.activationId,
		    }));
		}
	    }
	    var nextOnErr = done.bind(undefined, true);

	    // console.log("OOOOOOOOOOOOOOOOOO " + message.onDone_trigger + " " + JSON.stringify(message, undefined, 4))
	    if (message.onDone_trigger) {
		next({ trigger: message.onDone_trigger });
	    } else {
		continuations.makeEchoChamber(message.key, message.action.namespace, next, nextOnErr);
	    }

	    break;
	}
    } catch (e) {
	console.log(e);
    }
});

function debugDebug(message, ws, done) {
    prompt.get({
	name: 'result', description: 'Return value',
	conform: function(result) {
	    try {
		JSON.parse(result);
		return true;
	    } catch (e) {
		console.log('NOPE ' + result);
		return false;
	    }
	}
    }, function(err, values) {
	done(values.result);
    });
}

function debugNodeJS(message, ws, echoChamberNames, done) {
    var code = message.action.exec.code;

    var r = new RegExp(/main[\s]*\([^\)]*\)/)
    var startOfMethodBody = code.search(r);
    if (startOfMethodBody >= 0) {
	var paren = code.indexOf('{', startOfMethodBody);
	code = code.substring(0, paren + 1) + '\n    // This is your main method\n    // Click continue, and you will stop here\n    debugger;\n' + code.substring(paren + 1);
    }

/*    var bootstrap = '\n\n\nvar result = main.apply(undefined, ' + JSON.stringify([message.actualParameters || {}]) + ');';

    // fire our echo chamber trigger when the code is done
    bootstrap += '\n\nvar openwhisk = require(\'openwhisk\');\n';
    bootstrap += 'ow = openwhisk({api: \'' + api.host + api.path + '\', api_key: \'' + message.key + '\', namespace: \'' + message.action.namespace + '\' });\n';
    bootstrap += 'ow.triggers.invoke({ triggerName: \'' + echoChamberNames.trigger + '\', params: result });\n';*/

    code += '\n\n//\n'
    code += '// Welcome to the OpenWhisk debugger.\n';
    code += '//\n';
    code += '// To proceed with debugging, press the continue => button.\n';
    code += '// The first breakpoint will be in your main method\n';
    code += '//\n';
    code += '\n\nvar bootstrap = require(\'debug-bootstrap\')(\'' + message.key + '\', \'' + message.action.namespace + '\', \'' + echoChamberNames.trigger + '\');\nbootstrap(main, ' + JSON.stringify(message.actualParameters || {}) + ');';
    
    tmp.file(function onTempFileCreation(err, tmpFilePath, fd, tmpfileCleanupCallback) {
	// console.log('TMP ' + tmpFilePath);

	fs.write(fd, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {
	    var env = Object.assign({}, process.env);
	    env['NODE_PATH'] = path.join(process.cwd(), 'node_modules')
		+ ':' + path.join(process.cwd(), 'lib');

	    var spawnOpts = {
		cwd: process.cwd(),
		//stdio: ['inherit', 'pipe', 'pipe'],
		env: env
	    };
	    //console.log('SPAWN ' + JSON.stringify(spawnOpts, undefined, 4));
	    //var child = spawn('node', ['debug', tmpFilePath], spawnOpts);
	    var child = spawn(path.join('node_modules', '.bin', 'node-debug'), [tmpFilePath], spawnOpts);
	    /*var child = spawn('node', ['--debug', '--debug-brk', tmpFilePath], spawnOpts);
	      console.log('SPAWN2');
	      var child2 = spawn(path.join('node_modules', '.bin', 'node-inspector'), spawnOpts);
	      console.log('OPEN');
	      var child3 = open('http://127.0.0.1:8080/?port=5858', 'Google Chrome');*/

	    /*child.stderr.on('data', function(data) {
	      console.log(data);
	      });*/
	    console.log("");
	    console.log("");
	    console.log("\tVisit " + "http://127.0.0.1:8080/?port=5858".underline.blue + " in the " + "Chrome".red + " browser that just popped up");
	    console.log("\tClose that browser tab to complete your debugging session".bold);
	    console.log("");
	    console.log("");
	    function cleanUpSubprocesses(err, stdout, stderr) {
		/*console.log('ERR: ' + err);
		  console.log('stdout: ' + stdout);
		  console.log('stderr: ' + stderr);*/
		tmpfileCleanupCallback();
		done();
	    }
	    child.on('close', cleanUpSubprocesses);
	});
    });
    
}

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

process.on('exit', function onExit() {
    try {
	console.log("Goodbye!".red);

	ws.send(JSON.stringify({
	    type: 'disconnect'
	}, function ack() {
	    ws.close();
	}));
    } catch (e) {
    }
});
