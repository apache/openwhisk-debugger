'use strict'

var test = require('ava').test;
const uuid = require('uuid');
const spawn = require('child_process').spawn;

function Driver() {
}
Driver.prototype.it = function it(shouldDoThisSuccessfully, stepFn, rootPath) {
    test(shouldDoThisSuccessfully, t => {
	return new Promise((resolve,reject) => {
	    const child = spawn('node', ['wskdb.js'], { cwd: rootPath || '../..' });

		var name = uuid.v4();
		var steps = stepFn(name);
	    
		var stepNumber = 0;
		var goody = false;
	    
		function doStep() {
		    child.stdin.write(steps[stepNumber++] + '\n');
		}
		doStep(); // do the first step
		
		child.stderr.on('data', (data) => {
		    console.error('stderr: ' + data);
		});
		
		child.stdout.on('data', (data) => {
		    //console.log('stdout: ' + data)
		    if (data.indexOf('Error') >= 0) {
			goody = false;
			reject('Step ' + (stepNumber - 1) + ' failed');
			
		    } else if (data.indexOf('ok') >= 0) {
			goody = true;
			
			if (stepNumber === steps.length) {
			    child.stdin.write('quit\n');
			    child.stdin.end();
			} else {
			    doStep();
			}
		    }
		});
		child.on('exit', (code) => {
		    if (code === 0 && goody) {
			resolve();
		    } else {
			reject('code=${code} goody=${goody}');
		    }
		});
	    }).then(result => t.is(result));
	});
} /* the end of it! */

module.exports = new Driver().it;
