var prompt = require('inquirer'),
    rewriter = require('./rewriter'),
    columnify = require('columnify');

var help = {
    handler: function help() {
	console.log('The available commands are:');
	console.log();

	var grouped = {};
	for (var x in commandHandlers) {
	    var already = grouped[commandHandlers[x].description];
	    if (already) {
		grouped[commandHandlers[x].description] = already + ", " + x;
	    } else {
		grouped[commandHandlers[x].description] = x;
	    }
	}
	
	var pruned = [];
	for (var d in grouped) {
	    pruned.push({ command: grouped[d], description: d });
	}

	console.log(columnify(pruned, { minWidth: 18 }));
    },
    description: "Print this help text"
};
var attach = {
    handler: rewriter.attach,
    enumerate: rewriter.list,
    description: "Attach to an action",
    synchronous: true
};
var detach = {
    handler: rewriter.detach,
    description: "Detatch from an action",
    synchronous: true
};
var exit = {
    handler: function(wskprops) {
	//console.log("Cleaning up".red);
	rewriter.detachAll(wskprops, process.exit);
    },
    description: "Quit the debugger",
    synchronous: true
};
var invoke = {
    handler: rewriter.invoke,
    description: "Invoke an action",
    synchronous: true
};
var list = {
    handler: rewriter.listToConsole,
    description: "List available actions",
    synchronous: true
};
var clean = {
    handler: rewriter.clean,
    description: "Clean up debugging artifacts",
    synchronous: true
};
var create = {
    handler: rewriter.create,
    description: "Create an action",
    synchronous: true
};
var deleteAction = {
    handler: rewriter.deleteAction,
    description: "Delete an action",
    synchronous: true
};


var commandHandlers = {
    list: list,
    l: list,
    
    invoke: invoke,
    i: invoke,

    attach: attach,
    a: attach,

    detach: detach,
    d: detach,

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

function repl(wskprops) {
    prompt.prompt([{
	name: 'command', message: '(wskdb)',
	validate: function(line) {
	    var commandLine = line.split(/\s+/);
	    return line.length == 0 || commandHandlers[commandLine[0]] ? true : "Invalid command";
	}
    }]).then(function(response) {
	if (response.command.length == 0) {
	    // user hit return;
	    return repl(wskprops);
	}
	
	var commandLine = response.command.split(/\s+/);
	var command = commandLine.shift();
	var handler = commandHandlers[command];

	if (handler.synchronous) {
	    // the second parameter is the call back to the repl
	    // when done with the synchronous operation
	    commandLine.unshift(repl.bind(undefined, wskprops));
	}

	// the first parameter is wskprops
	commandLine.unshift(wskprops);

	// call to the handler!
	handler.handler.apply(undefined, commandLine);

	if (!handler.synchronous) {
	    // if async, then restart the repl right away
	    repl(wskprops);
	}
    });
}

exports.repl = repl;
