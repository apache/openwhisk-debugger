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
    diff = require('./diff'),
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

    //
    // since we've modified the code, we need to remember the diffs *we* are responsible for,
    // so that we can ignore them when determining whether the user has modified the file
    //
    var removeBootstrapPatch = diff.createPatch(code, message.action.exec.code);
    
    tmp.dir({ prefix: 'wskdb-', unsafeCleanup: true}, function onTempDirCreation(err, tmpDirPath, tmpdirCleanupCallback) {
	// console.log('TMP ' + tmpdirPath);
	var tmpFilePath = path.join(tmpDirPath, message.action.name + '.js');

	try {
	    fs.writeFile(tmpFilePath, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {

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
				  ['--cli',
				   '--debug-port', debugPort,
				   '--web-port', webPort,
				   '--save-live-edit',
				   tmpFilePath],
				  spawnOpts);
		var child2;
		var addrInUse = false;

		//
		// a bit of a hack here: wait a bit to see if we get an EADDRINUSE on stderr
		//
		setTimeout(() => child.stdout.on('data', function(data) {
		    if (!child2 && !addrInUse) {
			var url = 'http://127.0.0.1:' + webPort + '/?port=' + debugPort;
			child2 = open(url, 'Google Chrome');

			console.log('');
			console.log('');
			console.log('\tVisit ' + url.underline.blue + ' in the ' + 'Chrome'.red + ' browser that just popped up');
			console.log('\tClose that browser tab to complete your debugging session'.bold);
			console.log('');
			console.log('');
		    }
		}), 500);

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
			       && message.indexOf('Assertion failed') < 0
			       && message.indexOf('listening on port') < 0
			       && message.indexOf('another process already listening') < 0
			       && message.indexOf('use a different port') < 0) {
			//
			// ignore some internal errors in node-inspector
			//
			console.error('stderr: ' + message);
		    }
		});

		function cleanUpSubprocesses(err, stdout, stderr) {
		    if (err) {
			if (addrInUse) {
			    trySpawnWithBrowser(webPort + 1, debugPort + 1);
			} else {
			    console.log('Error launching debugger', err);
			}
		    }
		    if (!addrInUse) {
			diff.rememberIfChanged(message.action, tmpFilePath, tmpdirCleanupCallback, removeBootstrapPatch);

			if (!child.__killedByWSKDBInvocationDone) {
			    // if we were killed by an invocation-done event, then the ok was already issued elsewhere
			    ok_(done);
			} else {
			    done();
			}
		    }
		}
		child.on('exit', cleanUpSubprocesses);

		//
		// the activation that we are debugging has
		// finished. kill the child debugger process
		//
		eventBus.on('invocation-done', () => {
		    try {
			child.__killedByWSKDBInvocationDone = true;
			child.kill();
			child.kill('SIGKILL');
		    } catch (err) {
			console.error('Error cleaning up after activation completion', err);
		    }
		});

	    } /* end of trySpawnWithBrowser */

	    function spawnWithCLI() {
		try {
		    var spawnOpts = {
			cwd: process.cwd(),
			stdio: ['inherit', 'inherit', 'inherit'],
			env: env
		    };
		    var child = spawn('node',
				      ['debug', tmpFilePath],
				      spawnOpts);

		    //
		    // the activation that we are debugging has
		    // finished. kill the child debugger process
		    //
		    eventBus.on('invocation-done', () => child.kill());

		    //
		    // the child debugger process has terminated, clean things up
		    //
		    child.on('exit', (code) => {
			if (code !== 0) {
			    console.error('The NodeJS debugger exited abnormally with code ' + code);
			}

			diff.rememberIfChanged(message.action, tmpFilePath, tmpdirCleanupCallback, removeBootstrapPatch);
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
	    try { tmpdirCleanupCallback(); } catch (e) { }
	    done();
	}
    });
};
