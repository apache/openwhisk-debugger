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

function compileIt(sourcePath, tmpDirPath, actionName) {
    // console.log("COMPILEIT", sourcePath);
    return new Promise((resolve, reject) => {
	var spawnOpts = {
	    cwd: tmpDirPath,
	    stdio: ['inherit', 'inherit', 'inherit'],
	    env: process.env
	};
	try {
	    var executablePath = path.join(tmpDirPath, actionName);
	    var child = spawn('swiftc',
			      ['-o', executablePath,
			       '-g',
			       sourcePath],
			      spawnOpts);
	    child.on('exit', (code) => {
		if (code !== 0) {
		    reject(code);
		} else {
		    resolve(executablePath);
		}
	    });
	} catch (err) {
	    console.error(err);
	    reject(err);
	}
    });
}

function debugIt(eventBus, executablePath) {
    // console.log("DEBUGIT", executablePath);
    return new Promise((resolve, reject) => {
	try {
	    var spawnOpts = {
		cwd: process.cwd(),
		stdio: ['inherit', 'inherit', 'inherit'],
		env: process.env
	    };
	    try {
		var child = spawn('lldb',
				  ['-s', path.join(process.cwd(), 'lib', 'helpers', 'lldb.run'),
				   executablePath],
				  spawnOpts);
		child.on('exit', (code) => {
		    if (code !== 0 && code !== null) {
			console.error('The Swift debugger exited abnormally with code ' + code + ' ' + (code === 'null'));
			reject(code);
		    } else {
			//executableCleanup();
			resolve();
		    }
		});
		
		eventBus.on('invocation-done', () => child.kill());
		
	    } catch (e) {
		console.error('Error spawning debugger', e);
		console.error(e.stack);
		reject(e);
	    }
	} catch (e) {
	    console.error('Error spawning debugger', e);
	    console.error(e.stack);
	    reject(e);
	}
    });
}

/**
 * Format a Swift Dictionary from a javascript struct
*
*/
function jsonToSwiftDictionary(params) {
    var s = JSON.stringify(params)
	.replace(/{/g, '[')
	.replace(/}/g, ']');

    if (s === '[]') {
	return '[:]';
    } else {
	return s;
    }
}
    
exports.debug = function debugSwift(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    try {
	exports._debug(message, ws, echoChamberNames, done, commandLineOptions, eventBus);
    } catch (e) {
	console.error(e);
    }
};
exports._debug = function debugSwift(message, ws, echoChamberNames, done, commandLineOptions, eventBus) {
    var code = message.action.exec.code;

    //
    // we need to mark the parameters as "inout" so that they are modifiable in lldb
    //
    var r2 = new RegExp(/\[[\s]*String[\s]*:[\s]*Any[\s]*\]/);
    var paramType = code.search(r2, startOfMethodBody);
    code = code.substring(0, paramType) + ' inout ' + code.substring(paramType);

    //
    // let's add a little comment at the top of the method body to welcome the users
    //
    var r = new RegExp(/func main[\s]*\([^\)]*\)/);
    var startOfMethodBody = code.search(r);
    if (startOfMethodBody >= 0) {
	var paren = code.indexOf('{', startOfMethodBody);
	code = code.substring(0, paren + 1) + '\n    // Hello from the OpenWhisk debugger. Welcome to your main method\n' + code.substring(paren + 1);
    }

    fs.readFile(path.join('lib', 'debug-bootstrap.swift'), (err, codeBuffer) => {
	//
	// inline the bootstrapping logic into the file to be debugged
	//
	code += codeBuffer.toString('utf8');

	//
	// lastly, invoke the bootstrap method
	//
	code += '\nvar params: [String:Any] = ' + jsonToSwiftDictionary(message.actualParameters);
	code += '\nbootstrap(key: "' + message.key + '", namespace: "' + message.action.namespace + '", triggerName: "' + echoChamberNames.trigger + '", main: main, actualParameters: &params);';

	//
	// we will store the temporary files in a temporary directory
	//
	tmp.dir({ prefix: 'wskdb-', unsafeCleanup: true }, function onTempDirCreation(err, tmpDirPath, fd, tmpdirCleanupCallback) {
	    //
	    // this is the source file path that we'll use
	    //
	    var tmpFilePath = path.join(tmpDirPath, message.action.name + '.swift');

	    try {
		//
		// write it out, compile it, then launch the debugger
		//
		fs.writeFile(tmpFilePath, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {

		    compileIt(tmpFilePath, tmpDirPath, message.action.name)
			.then(debugIt.bind(undefined, eventBus))
			.then(() => {
			    try { tmpdirCleanupCallback(); } catch (e) { }
			    done(); // we don't need to "ok" here, as the invoker will do that for us
			});
		});
	    } catch (err) {
		console.error(err);
		console.error(err.stack);
		try { tmpdirCleanupCallback(); } catch (e) { }
		done();
	    }
	});
    });
};
