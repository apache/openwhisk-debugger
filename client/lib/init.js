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
    exec = require('child_process').spawn,
    path = require('path'),
    MARKER = '.initDone',
    nodejs6_deps = path.join('deps', 'nodejs6');

function touch() {
    fs.closeSync(fs.openSync(MARKER, 'w'));
}
function initDone() {
    try {
	return !process.argv.find(s => s === '--reset' || s === '-r')
	    && fs.statSync(MARKER).isFile()
	    && fs.statSync('node_modules').isDirectory()
	    && fs.statSync(nodejs6_deps).isDirectory();
    } catch (e) {
	return false;
    }
}

exports.init = function init() {
    return new Promise((resolve, reject) => { try {
	if (initDone()) {
	    return resolve();
	}

	console.log('>>> Please be patient while we finish up the installation of the OpenWhisk Debugger.');
	console.log('>>> This may take around 30-60 seconds');

	var dot = '.';
	var dots = setInterval(function() {
	    process.stdout.write(dot);
	}, 1000);

	var allDone = function() {
	    touch();
	    clearInterval(dots);

	    console.log();
	    console.log('>>> Great! The one-time initialization has completed.');
	    console.log();

	    resolve();
	};
	var errDone = function(err) {
	    console.error(err.stack);
	    clearInterval(dots);
	    reject(err);
	};

	var verbose = process.argv.find(s => s === '--verbose');
	var stdio = ['pipe', verbose ? 'inherit' : 'pipe', 'pipe' ];
	if (verbose) {
	    dot = '';
	}
	
	//
	// first, we install the npm modules needed by wskdb
	//
	try {
	    var args = ['install'];
	    if (!process.argv.find(s => s === '--dev' || s === 'd')) {
		//
		// install dev dependencies
		//
		args.push('--production');
	    }
		try {
		    /*		    if (err) {
			return errDone(err);
			}*/
	    
		    //
		    // here, we install the prerequisities dictated by OpenWhisk nodejs actions
		    //
		    if (!verbose) {
			dot = 'n';
		    }
		    exec('npm', ['install', '--production'], { cwd: nodejs6_deps, stdio: stdio }).on('exit', (err) => {
			try {
			    if (err) {
				return errDone(err);
			    }

			    if (process.argv.find(s => s === '--python' || s === '-p')) {
				//
				// here, we install the prerequisities dictated by OpenWhisk python actions
				//
				if (!verbose) {
				    dot = 'p';
				}
				exec('pip', ['install', '-r', 'deps/python/requirements.txt'], { cwd: process.cwd(), stdio: stdio }).on('exit', (err) => {
				    if (err) {
					return errDone(err);
				    }

				    allDone();
				});
			    } else {
				//
				// user doesn't want python support
				//
				allDone();
			    }
			} catch (err) {
			    return errDone(err);
			}
		    });
		} catch (err) {
		    return errDone(err);
		}

	} catch (err) {
	    return errDone(err);
	}
    } catch (err) {
	console.error(err.stack);
    }
    });
};
