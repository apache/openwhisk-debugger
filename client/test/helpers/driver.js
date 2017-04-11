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
const colors = require('colors');

function Driver() {
}

function doTest(expectFailure, shouldDoThisSuccessfully, stepFn, args, rootPath) {
    return test(shouldDoThisSuccessfully, t => {
	return new Promise((resolve,reject) => {
	    const child = spawn('node', ['wskdb.js'].concat(args || []), { cwd: rootPath || '../..' });

	    const name = Namer.name('test');
	    const steps = stepFn(name);
	    
	    var stepNumber = 0;
	    var goody;

	    // for the dead man's switch
	    var lastStep;
	    var lastOut;
	    var expectedOutput, gotExpectedOutput;

	    function doStep() {
		var step = steps[stepNumber++];

		if (typeof step == "object") {
		    expectedOutput = step.expectedOutput;
		    gotExpectedOutput = false;
		    step = step.input;
		}

		// console.log("STEP".green, step, expectedOutput, typeof step);
		
		lastStep = Date.now();
		child.stdin.write(step + '\n');
	    }
	    function redoStep() {
		// console.log(("REDO STEP " + steps[stepNumber]).red);
		child.stdin.write(steps[stepNumber - 1] + '\n');
	    }
	    doStep(); // do the first step

	    setInterval(function deadMansSwitch() {
		if (lastStep > lastOut || (lastOut - lastStep < 100 && Date.now() - lastStep > 2000)) {
		    redoStep();
		}
	    }, 2000);

	    function errorInOutput(err) {
		goody = false;
		if (expectFailure) {
		    resolve();
		    return true;
		} else {
		    reject('Step ' + (stepNumber - 1) + ' failed: ' + steps[stepNumber - 1] + ' with ' + err);
		    return false;
		}
	    }
	    
	    child.stderr.on('data', (data) => {
		if (data.toString().indexOf('Error') >= 0) {
		    if (errorInOutput(data.toString())) {
			//
			// don't print the error, as this was expected
			//
			return;
		    }
		}
		console.error(('stderr: ' + data).red);
	    });

	    child.stdout.on('data', (data) => {
		// console.log('stdout: '.blue + data);
		lastOut = Date.now(); // for the dead man's switch
		
		if (data.indexOf('Error') >= 0) {
		    errorInOutput(data);
			
		} else if (data.indexOf('ok') == 0
			   || data.indexOf('\nok\n') >= 0
			   || data.indexOf('break in') >= 0
			   || data.indexOf('(Pdb)') >= 0
			   || data.indexOf('stopped') >= 0) {
		    //
		    // the cumulative goodness is: if we are good so
		    // far (or this is our first step) and either we
		    // have no expected output, or we got it
		    //
		    goody = goody === undefined || goody && !expectedOutput || gotExpectedOutput;

		    // reset the got expected output bit
		    expectedOutput = undefined;
		    gotExpectedOutput = false;

		    if (stepNumber === steps.length) {
			stepNumber = -1;
			child.stdin.write('quit\n');
			child.stdin.end();
		    } else if (stepNumber >= 0) {
			doStep();
		    }
		} else if (expectedOutput && data.indexOf(expectedOutput) >= 0) {
		    gotExpectedOutput = true;
		}
	    });
	    child.on('exit', (code) => {
		if (code === 0 && goody) {
		    if (expectFailure) {
			reject('zero exit code');
		    } else {
			resolve();
		    }
		} else {
		    if (expectFailure) {
			resolve();
		    } else {
			reject();
		    }
		}
	    });
	}).then(result => t.is(result));
    });
} /* the end of it! */

function should(shouldDoThisSuccessfully, stepFn, args, rootPath) {
    return doTest(false, shouldDoThisSuccessfully, stepFn, args, rootPath);
};
function shouldFail(shouldDoThisSuccessfully, stepFn, args, rootPath) {
    return doTest(true, shouldDoThisSuccessfully, stepFn, args, rootPath);
};

Driver.prototype.it = {
    should: should,
    shouldFail: shouldFail
};

module.exports = new Driver().it;
