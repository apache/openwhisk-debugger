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

var inquirer = require('inquirer'),
    _list = require('./list')._list,
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports.created = {};

/**
 * Fires a trigger
 *
 */
exports.fire = function fireTrigger(wskprops, next, name) {
    var ow = setupOpenWhisk(wskprops);

    function doFire(name) {
	return ow.triggers.invoke(name)
	    .then(ok(next))
	    .catch(errorWhile('firing trigger'), next);
    }
    
    if (!name) {
	_list(ow, function(L) {
	    inquirer
		.prompt([{ name: 'triggerName', type: 'list',
			   message: 'Which trigger do you wish to fire?',
			   choices: L.map(trigger => trigger.name)
			 }])
		.then(doFire)
		.catch(next);
		
	}, 'triggers');
    } else {
	doFire({ triggerName: name });
    }
};
