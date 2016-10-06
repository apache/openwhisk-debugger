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

var fs = require('fs'),
    ok_ = require('./repl-messages').ok_,
    tmp = require('tmp'),
    open = require('open'),
    path = require('path'),
    spawn = require('child_process').spawn;

exports.debug = function debugNodeJS(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    try {
	exports._debug(message, ws, echoChamberNames, done, commandLineOptions, eventBus);
    } catch (e) {
	console.error(e);
    }
};
exports._debug = function debugNodeJS(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    var code = message.action.exec.code;

    var r = new RegExp(/main[\s]*\([^\)]*\)/);
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

    code += '\n\n//\n';
    code += '// Welcome to the OpenWhisk debugger.\n';
    code += '//\n';
    code += '// To proceed with debugging, press the continue => button.\n';
    code += '// The first breakpoint will be in your main method\n';
    code += '//\n';
    code += '\n\nvar bootstrap = require(\'debug-bootstrap\')(\'' + message.key + '\', \'' + message.action.namespace + '\', \'' + echoChamberNames.trigger + '\');\nbootstrap(main, ' + JSON.stringify(message.actualParameters || {}) + ');';
    
    tmp.file(function onTempFileCreation(err, tmpFilePath, fd, tmpfileCleanupCallback) {
	// console.log('TMP ' + tmpFilePath);
	try {
	fs.write(fd, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {

            // we need to update the NODE_PATH env var, to add our local modules
	    var env = Object.assign({}, process.env);
	    env.NODE_PATH = path.join(process.cwd(), 'node_modules')
		+ ':' + path.join(process.cwd(), 'lib')
		+ ':' + path.join(process.cwd(), 'deps', 'nodejs6', 'node_modules');

	    function trySpawnWithBrowser(webPort, debugPort) {
		var spawnOpts = {
		    cwd: process.cwd(),
		    // stdio: ['inherit', 'inherit', 'inherit'], // for debugging
		    env: env
		};
		var child = spawn(path.join('node_modules', '.bin', 'node-debug'),
				  ['--cli', '--debug-port', debugPort, '--web-port', webPort, tmpFilePath],
				  spawnOpts);
		var child2;
		var addrInUse = false;
		
		child.stdout.on('data', function(data) {
		    if (!child2) {
			var url = 'http://127.0.0.1:' + webPort + '/?port=' + debugPort;
			child2 = open(url, 'Google Chrome');

			console.log('');
			console.log('');
			console.log('\tVisit ' + url.underline.blue + ' in the ' + 'Chrome'.red + ' browser that just popped up');
			console.log('\tClose that browser tab to complete your debugging session'.bold);
			console.log('');
			console.log('');
		    }
		});

		// for debugging the child invocation:
		child.stderr.on('data', (message) => {
		    message = message.toString();
		    if (message.indexOf('EADDRINUSE') >= 0) {
			//
			// oops, we'll need to try another pair of
			// ports. we'll do son in the on('exit')
			// handler below
			//
			addrInUse = true;
		    } else if (message.indexOf('ResourceTree') < 0
			       && message.indexOf('Assertion failed') < 0) {
			//
			// ignore some internal errors in node-inspector
			//
			console.error('stderr: ' + message);
		    }
		});

	    /*var child = spawn('node', ['--debug', '--debug-brk', tmpFilePath], spawnOpts);
	      console.log('SPAWN2');
	      var child2 = spawn(path.join('node_modules', '.bin', 'node-inspector'), spawnOpts);
	      console.log('OPEN');
	      var child3 = open('http://127.0.0.1:8080/?port=5858', 'Google Chrome');*/

		function cleanUpSubprocesses(err, stdout, stderr) {
		    if (err) {
			if (addrInUse) {
			    trySpawnWithBrowser(webPort + 1, debugPort + 1);
			} else {
			    console.log('Error launching debugger', err);
			}
		    }
		    if (!addrInUse) {
			try { tmpfileCleanupCallback(); } catch (e) { }
			ok_(done);
		    }
		}
		child.on('close', cleanUpSubprocesses);
	    } /* end of trySpawnWithBrowser */

	    function spawnWithCLI() {
		var spawnOpts = {
		    cwd: process.cwd(),
		    stdio: ['inherit', 'inherit', 'inherit'],
		    env: env
		};
		try {
		    var child = spawn('node',
				      ['debug', tmpFilePath],
				      spawnOpts);
		    child.on('exit', (code) => {
			if (code !== 0) {
			    console.error('The debugger exited abnormally with code ' + code);
			}
		    });

		    eventBus.on('invocation-done', () => child.kill());

		    child.on('close', () => {
			try { tmpfileCleanupCallback(); } catch (e) { }
			done(); // we don't need to "ok" here, as the invoker will do that for us
		    });
		} catch (e) {
		    console.error('Error spawning debugger', e);
		    console.error(e.stack);
		    done();
		}
	    }

	    if (commandLineOptions['use-cli-debugger']) {
		spawnWithCLI();
	    } else {
		trySpawnWithBrowser(8080, 5858);
	    }
	});
	} catch (e) {
	    console.error(e);
	    console.error(e.stack);
	}
    });
};
