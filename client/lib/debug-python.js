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
    kill = require('tree-kill'),
    open = require('open'),
    path = require('path'),
    spawn = require('child_process').spawn,
    options = require('./options').options;

exports.debug = function debug(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    try {
	exports._debug(message, ws, echoChamberNames, done, commandLineOptions, eventBus);
    } catch (e) {
	console.error(e);
    }
};
exports._debug = function debug(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    var code = message.action.exec.code;

    var r = new RegExp(/def main[\s]*\([^\)]*\):/);
    var startOfMethodBody = code.search(r);
    if (startOfMethodBody >= 0) {
	var colon = code.indexOf(':', startOfMethodBody);
	code =
	    code.substring(0, colon + 1)
	    + '\n    # Welcome to your main method\n'
	    + '    from pdb import set_trace as debugger\n'
	    + '    debugger()\n'
	    + code.substring(colon + 1);
    }

    code += '\n\n\nfrom bootstrap import bootstrap\n';
    code += 'try:\n';
    code += '    bootstrap(\'' + message.key + '\', \'' + message.action.namespace + '\', \'' + echoChamberNames.trigger + '\', main, ' + JSON.stringify(message.actualParameters || {}) + ');\n';
    code += 'except:\n';
    code += '    pass\n';
    code += 'finally:\n';
    code += '    sys.exit(0)\n';

    tmp.dir({ prefix: 'wskdb-', unsafeCleanup: true}, function onTempDirCreation(err, tmpDirPath, tmpdirCleanupCallback) {
	var tmpdirPathRegExp = new RegExp(tmpDirPath + '/');
	var tmpFilePath = path.join(tmpDirPath, message.action.name + '.py');

	try {
	    fs.writeFile(tmpFilePath, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {

		// we need to update the NODE_PATH env var, to add our local modules
		var env = Object.assign({}, process.env);
		env.PYTHONPATH = path.join(process.cwd(), 'lib', 'debug-bootstrap', 'python');
		env.PYTHONUNBUFFERED = '1';

		function spawnWithCLI() {
		    try {
			var spawnOpts = {
			    cwd: process.cwd(),
			    stdio: ['inherit', 'pipe', 'pipe'],
			    env: env
			};
			var child = spawn('python',
					  ['-u',
					   '-m', 'pdb',
					   tmpFilePath],
					  spawnOpts);
			
			//
			// the activation that we are debugging has
			// finished. kill the child debugger process
			//   SIGKILL is required to avoid killing wskdb, too
			eventBus.on('invocation-done', () => child.kill('SIGKILL'));
			
			child.stderr.on('data', message => console.error(message.toString().red));

			var baked = false, raw = true, first = true;
			child.stdout.on('data', function(message) {
			    try {
				if (raw) {
				    raw = false;
				    console.log();
				    console.log('Hello from the Python debugger. Enter '
						+ 'c'.red + ' or ' + 'continue'.red + ' to enter your main method.');
				    console.log('Hint: enter ' + 'l'.red + ' or ' + 'list'.red + ' to see a longer program listing');
				    console.log();
				}

				if (!baked) {
				    if (message.indexOf('The program exited via sys.exit') >= 0) {
					baked = true;
				    } else {
					process.stdout.write(message.toString().replace(tmpdirPathRegExp, '').blue.dim);
				    }
				}
			    } catch (err) {
				console.error(err);
			    }
			});
			
			//
			// the child debugger process has terminated, clean things up
			//
			child.on('exit', code => {
			    //if (code !== 0) {
			    //console.error('The Python debugger exited abnormally with code ' + code);
			    //}
			    
			    //try { tmpdirCleanupCallback(); } catch (e) { }
			    done(); // we don't need to "ok" here, as the invoker will do that for us
			});
		    } catch (e) {
			console.error('Error spawning debugger', e);
			console.error(e.stack);
			done();
		    }
		}
		
		spawnWithCLI();
	    });
	} catch (e) {
	    console.error(e);
	    console.error(e.stack);
	    //try { tmpdirCleanupCallback(); } catch (e) { }
	    done();
	}
    });
};
