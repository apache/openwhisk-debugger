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
    description: "Quit the debugger"
};
var invoke = {
    handler: rewriter.invoke,
    description: "Invoke an action",
    synchronous: true
};

var commandHandlers = {
    invoke: invoke,
    attach: attach,
    detach: detach,
    exit: exit,
    quit: exit,
    e: exit,
    q: exit,
    help: help,
    h: help,
    '?': help
};

function repl(wskprops) {
    prompt.prompt([{
	name: 'command', message: '(wskdb)',
	validate: function(line) {
	    var commandLine = line.split(/\s+/);
	    return commandLine.length > 0 && commandHandlers[commandLine[0]] ? true : "Invalid command";
	}
    }]).then(function(response) {
	var commandLine = response.command.split(/\s+/);
	var command = commandLine.shift();
	var handler = commandHandlers[command];

	if (handler.synchronous) {
	    commandLine.unshift(repl.bind(undefined, wskprops));
	}
	commandLine.unshift(wskprops);

	handler.handler.apply(undefined, commandLine);

	if (!handler.synchronous) {
	    repl(wskprops);
	}
    });
}

exports.repl = repl;
