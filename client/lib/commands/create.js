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
exports.create = function create(wskprops, next, name) {
    var questions = [];
    if (!name) {
	questions.push({ name: 'name', message: 'Choose a name for your new action' });
    }
    questions.push({ name: 'kind', type: 'list',
		     message: 'Which runtime do you want to use?',
		     choices: ['nodejs', 'swift', 'python' ]
		   });
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

    inquirer
	.prompt(questions)
	.then(response => {
	      return setupOpenWhisk(wskprops).actions.create({
		  actionName: name || response.name,
		  action: {
		      exec: {
			  kind: response.kind,
			  code: response.code
		      }
		  }
	      });
	})
	.then((action) => exports.created[action.name] = true)
	.then(ok(next), errorWhile('creating action', next));
};
