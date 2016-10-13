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
    exec = require('child_process').exec,
    path = require('path'),
    MARKER = '.initDone',
    nodejs6_deps = path.join('deps', 'nodejs6');

function touch() {
    fs.closeSync(fs.openSync(MARKER, 'w'));
}
function initDone() {
    try {
	return fs.statSync(MARKER).isFile()
	    && fs.statSync('node_modules').isDirectory()
	    && fs.statSync(nodejs6_deps).isDirectory();
    } catch (e) {
	return false;
    }
}

exports.init = function init() {
    return new Promise((resolve, reject) => {
	if (initDone()) {
	    return resolve();
	}

	console.log('>>> Please be patient while we finish up the installation of the OpenWhisk Debugger.');
	console.log('>>> This may take 60-90 seconds');

	var dots = setInterval(function() {
	    process.stdout.write('.');
	}, 1000);
    
	exec('npm install', { cwd: process.cwd() /*, stdio: 'inherit'*/ }, (err) => {
	    if (err) {
		return reject(err);
	    }
	    
	    exec('npm install', { cwd: nodejs6_deps/*, stdio: 'inherit'*/ }, (err) => {
		if (err) {
		    return reject(err);
		}

		exec('pip install -r deps/python/requirements.txt', { cwd: process.cwd() }, (err) => {
		    if (err) {
			return reject(err);
		    }

		    touch();
		    clearInterval(dots);

		    console.log();
		    console.log('>>> Great! The one-time initialization has completed.');
		    console.log();

		    resolve();
		});
	    });
	});
    });
};
