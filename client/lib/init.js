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
    exec = require('child_process').execSync,
    path = require('path'),
    MARKER = '.initDone';

function touch() {
    fs.closeSync(fs.openSync(MARKER, 'w'));
}
function initDone() {
    try {
	return fs.statSync(MARKER).isFile();
    } catch (e) {
	return false;
    }
}

function doInit() {
    console.log('Doing one-time init');
    exec('npm install', { cwd: path.join('deps', 'nodejs6'), stdio: 'inherit' });
    
    touch();
}

exports.init = function init() {
    if (!initDone()) {
	doInit();
    }
};
