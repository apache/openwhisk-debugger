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
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports.created = {};

/**
 * Create an action
 *
 */
exports.create = function create() {
    var wskprops = arguments[0];
    var next = arguments[1];
    var name = arguments.length > 3 && arguments[2];
    var trigger = arguments[3];
    var action = arguments[4];

    var questions = [];
    if (!name) {
	questions.push({ name: 'name', message: 'Choose a name for your new rule' });
    }
    if (!trigger) {
	questions.push({ name: 'name', message: 'Choose a trigger' });
    }
    if (!action) {
	questions.push({ name: 'name', message: 'Choose an action' });
    }

    inquirer
	.prompt(questions)
	.then(response => {
	      return setupOpenWhisk(wskprops).rules.update({
		  name: name || response.name,
		  trigger: `/_/${trigger || response.trigger}`,
		  action: `/_/${action || response.action}`
	      });
	})
	.then(rule => exports.created[rule.name] = true)
	.then(ok(next), errorWhile('creating rule', next));
};
