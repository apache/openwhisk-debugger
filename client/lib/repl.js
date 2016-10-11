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

var argv = require('argv'),
    prompt = require('inquirer'),
    lister = require('./commands/list'),
    options = require('./options'),
    rewriter = require('./rewriter'),
    columnify = require('columnify');

var commandHandlers; // defined below. helping out jshint here
var help = {
    handler: function help() {
	console.log('The available commands are:');
	console.log();

	var grouped = {};
	for (var x in commandHandlers) {
	    if (commandHandlers.hasOwnProperty(x)) {
		var already = grouped[commandHandlers[x].description];
		if (already) {
		    grouped[commandHandlers[x].description] = already + ', ' + x;
		} else {
		    grouped[commandHandlers[x].description] = x;
		}
	    }
	}
	
	var pruned = [];
	for (var d in grouped) {
	    if (grouped.hasOwnProperty(d)) {
		pruned.push({ command: grouped[d], description: d });
	    }
	}

	console.log(columnify(pruned, { minWidth: 18 }));
    },
    description: 'Print this help text'
};
var attach = {
    handler: rewriter.attach,
    enumerate: lister.list,
    description: 'Attach to an action',
    synchronous: true,
    options: [{ name: 'all', short: 'a', type: 'string', description: 'Instrument the action, plus any rules or sequences in which it takes part' }]
};
var detach = {
    handler: rewriter.detach,
    description: 'Detatch from an action',
    synchronous: true
};
var exit = {
    handler: function(wskprops) {
	//console.log('Cleaning up'.red);
	rewriter.detachAll(wskprops, process.exit);
    },
    description: 'Quit the debugger',
    synchronous: true
};
var invoke = {
    handler: rewriter.invoke,
    description: 'Invoke an action',
    needsEventBus: true,
    synchronous: true
};
var fire = {
    handler: require('./commands/fire').fire,
    description: 'Fire a trigger',
    synchronous: true
};
var list = {
    handler: lister.listToConsole,
    description: 'List available actions',
    synchronous: true,
    options: [{ name: 'full', short: 'f', type: 'string', description: 'Show all actions, including debugging artifacts' }]
};
var inspect = {
    handler: require('./commands/inspect').inspect,
    description: 'Inspect the details of an OpenWhisk action',
    synchronous: true
};
var clean = {
    handler: rewriter.clean,
    description: 'Clean up debugging artifacts',
    synchronous: true
};
var create = {
    handler: require('./commands/create').create,
    description: 'Create an action',
    synchronous: true
};
var deleteAction = {
    handler: require('./commands/delete').deleteAction,
    description: 'Delete an action',
    synchronous: true
};
var diff = {
    handler: require('./commands/diff').diff,
    description: 'Show the pending diffs of a given action',
    synchronous: true
};
var publish = {
    handler: require('./commands/publish').publish,
    description: 'Publish pending changes to a given action',
    synchronous: true
};
var cli = {
    handler: options.update.bind(undefined, 'use-cli-debugger', undefined),
    description: 'Use the CLI debugger, when available',
    synchronous: true
};
commandHandlers = {
    list: list,
    l: list,

    cli: cli,

    invoke: invoke,
    i: invoke,

    inspect: inspect,
    ins: inspect,
    get: inspect,
    
    fire: fire,
    f: fire,

    attach: attach,
    a: attach,

    detach: detach,
    d: detach,

    diff: diff,
    publish: publish,
    p: publish,

    exit: exit,
    quit: exit,
    e: exit,
    q: exit,

    clean: clean,
    c: clean,

    create: create,
    delete: deleteAction,

    help: help,
    h: help,
    '?': help
};

/**
 * This is the read-eval-print loop.
 *
 * @param wskprops is a map that provides the user's NAMESPACE and AUTH settings
 * @param eventBus will be used to post and listen for inter-function communication
 * @param attachTo if the user requested to attach to an action on launch
 *
 */
function repl(wskprops, eventBus, attachTo) {
    function handleReplCommand(response) {
	if (response.command.length === 0) {
	    // user hit return;
	    return repl(wskprops, eventBus);
	}
	
	var commandLine = response.command.split(/\s+/);
	var command = commandLine.shift();
	var handler = commandHandlers[command];

	var options;
	if (handler.options) {
	    argv.clear();
	    argv.description = 'Usage: ' + command + ' [options]';
	    argv.options.help.example = '';
	    argv.options.help.onset = (args) => {
		argv.help(args.mod);
	    };
	    options = argv.option(handler.options).run(commandLine).options;
	}

	if (handler.synchronous) {
	    // the second parameter is the call back to the repl
	    // when done with the synchronous operation
	    commandLine.unshift(repl.bind(undefined, wskprops, eventBus));
	}

	if (handler.options) {
	    commandLine.unshift(options);
	}

	if (handler.needsEventBus) {
	    commandLine.unshift(eventBus);
	}

	// the first parameter is wskprops
	commandLine.unshift(wskprops);

	// call to the handler!
	try {
	    handler.handler.apply(undefined, commandLine);
	} catch (e) {
	    console.error(e);
	}

	if (!handler.synchronous) {
	    // if async, then restart the repl right away
	    repl(wskprops, eventBus);
	}
    } /* end of handleReplCommand */
    
    if (attachTo) {
	handleReplCommand({ command: 'attach ' + attachTo });
    } else {
	prompt.prompt([{
	    name: 'command', message: '(wskdb)',
	    prefixMessage: '', // override the default question mark prefix
	    validate: function(line) {
		var commandLine = line.split(/\s+/);
		return line.length === 0 || commandHandlers[commandLine[0]] ? true : 'Invalid command';
	    }
	}]).then(handleReplCommand);
    }
}

exports.repl = repl;
