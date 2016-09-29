var fs = require('fs'),
    tmp = require('tmp'),
    path = require('path'),
    spawn = require('child_process').spawn;

exports.debug = function debugNodeJS(message, ws, echoChamberNames, done) {
    try {
	exports._debug(message, ws, echoChamberNames, done);
    } catch (e) {
	console.error(e);
    }
}
exports._debug = function debugNodeJS(message, ws, echoChamberNames, done) {
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
	try {
	fs.write(fd, code, 0, 'utf8', function onFileWriteCompletion(err, written, string) {
	    var env = Object.assign({}, process.env);
	    env['NODE_PATH'] = path.join(process.cwd(), 'node_modules')
		+ ':' + path.join(process.cwd(), 'lib');

	    var spawnOpts = {
		cwd: process.cwd(),
		// stdio: ['inherit', 'inherit', 'inherit'], // for debugging
		env: env
	    };
	    // console.log('SPAWN ' + JSON.stringify(spawnOpts, undefined, 4));
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
	} catch (e) {
	    console.error(e);
	}
    });
}
