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

var created = require('./create').created,
    Namer = require('../namer'),
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports._list = function _list(ow, callback, type) {
    ow[type || 'actions']
	.list({ limit: 200 })
	.then(function onList(L) { callback(L, ow); },
	      errorWhile('fetching actions', callback));
};

exports.list = function list(wskprops, callback, type) {
    var ow = setupOpenWhisk(wskprops);
    exports._list(ow, callback, type);
};

exports.listToConsole = function listToConsole(wskprops, options, next) {
    if (options.help) {
	return next();
    }

    console.log('Available actions:'.blue);
    function print(actions) {
	actions
	    .filter(action => options && options.full || !Namer.isDebugArtifact(action.name))
	    .forEach(action => console.log('    ', action.name[created[action.name] ? 'green' : 'reset']));

	ok_(next);
    }

    exports.list(wskprops, print);
};
