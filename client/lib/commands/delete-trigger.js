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

var created = require('./create-trigger').created,
    _list = require('./list')._list,
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

/**
 * Delete an action
 *
 */
exports.delete = function deleteTrigger(wskprops, next, name) {
    var ow = setupOpenWhisk(wskprops);

    function doDelete(name) {
	ow.triggers.delete({ name: name })
	    .then(trigger => delete created[trigger.name])
	    .then(ok(next), errorWhile('deleting trigger', next));
    }
    
    if (!name) {
	errorWhile('deleting trigger, no name provided', next)();
    } else {
	doDelete(name);
    }
};
