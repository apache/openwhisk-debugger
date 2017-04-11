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
    var kind = arguments[3];
    var code;

    var questions = [];
    if (!name) {
	questions.push({ name: 'name', message: 'Choose a name for your new action' });
    }
    if (!kind) {
	questions.push({ name: 'kind', type: 'list',
			 message: 'Which runtime do you want to use?',
			 choices: ['nodejs', 'swift', 'python' ]
		       });
    }
    if (arguments.length < 5) {
	//
	// prompt the user for the code
	//
	questions.push({ name: 'code', type: 'editor',
			 message: 'Please provide the function body for your new action',
			 default: function(response) {
			     if (response.kind === 'nodejs') {
				 // nodejs
				 return 'function main(params) {\n    return { message: \'hello\' };\n}\n';
			     } else if (response.kind === 'swift') {
				 // swift
				 return 'func main(args: [String:Any]) -> [String:Any] {\n      return [ "message" : "Hello world" ]\n}\n';
			     } else {
				 // python
				 return 'import sys\n\ndef main(dict):\n    return { \'message\': \'Hello world\' }\n';
			     }
			 }
		       });
    } else {
	code = arguments[arguments.length -1];
	code = code.substring(code.lastIndexOf(kind) + kind.length).trim();
	code = code.replace(/\\n/g, '\n');
    }

    inquirer
	.prompt(questions)
	.then(response => {
	      return setupOpenWhisk(wskprops).actions.create({
		  actionName: name || response.name,
		  action: {
		      exec: {
			  kind: kind || response.kind,
			  code: code || response.code
		      }
		  }
	      });
	})
	.then((action) => exports.created[action.name] = true)
	.then(ok(next), errorWhile('creating action', next));
};
