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

'use strict'

const test = require('ava').test;
const uuid = require('uuid');
const spawn = require('child_process').spawn;
const Namer = require('../../lib/namer');

function Driver() {
}

Driver.prototype.it = function it(shouldDoThisSuccessfully, stepFn, args, rootPath) {
    test(shouldDoThisSuccessfully, t => {
	return new Promise((resolve,reject) => {
	    const child = spawn('node', ['wskdb.js'].concat(args || []), { cwd: rootPath || '../..' });

	    const name = Namer.name('test');
	    const steps = stepFn(name);
	    
	    var stepNumber = 0;
	    var goody = false;
	    
	    function doStep() {
		// console.log("STEP " + steps[stepNumber]);
		child.stdout.pause();
		child.stdin.write(steps[stepNumber++] + '\n');
		child.stdout.resume();
	    }
	    doStep(); // do the first step
		
	    child.stderr.on('data', (data) => {
		console.error('stderr: ' + data);
	    });
		
	    child.stdout.on('data', (data) => {
		//console.log('stdout: ' + data + " ||| " + data.indexOf('(wskdb)'))
		if (data.indexOf('Error') >= 0) {
		    goody = false;
		    reject('Step ' + (stepNumber - 1) + ' failed');
			
		} else if (data.indexOf('ok') == 0 || data.indexOf('break in') >= 0 || data.indexOf('stopped') >= 0) {
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
		    reject(`code=${code} goody=${goody}`);
		}
	    });
	}).then(result => t.is(result));
    });
} /* the end of it! */

module.exports = new Driver().it;
