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

exports.ok = function ok(next) {
    return function() {
	console.log('ok');
	next();
    };
};

exports.ok_ = function ok_(next) {
    exports.ok(next)();
};

exports.okAfter = function okAfter(f, next) {
    return function() {
	f.apply(undefined, arguments);
	exports.ok_(next);
    };
};

/**
 * Log an error, and continue
 *
 */
exports.errorWhile = function errorWhile(inOperation, callback) {
    return function(err) {
	if (err && err.toString().indexOf('404')) {
	    console.error('Error: entity does not exist');
	} else {
	    console.error('Error ' + inOperation);
	    console.error(err);
	}
	
	if (callback) {
	    callback();
	}
    };
};
