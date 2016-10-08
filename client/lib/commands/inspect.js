var ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    _list = require('./list')._list,
    inquirer = require('inquirer'),
    isDirectlyAttachedTo = require('../rewriter').isDirectlyAttachedTo,
    isChainAttachedTo = require('../rewriter').isChainAttachedTo,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports.inspect = function inspect(wskprops, next, name, property) {
    var ow = setupOpenWhisk(wskprops);

    function doInspect(name) {
	ow.actions.get({ actionName: name })
	    .then((details) => {
		const attached = isDirectlyAttachedTo(name);
		const chainAttached = isChainAttachedTo(name);
		console.log( ('Attached = ' + (attached ? 'yes' : chainAttached ? 'yes, to one or more parts' : 'no'))
			     [attached ? 'blue' : chainAttached ? 'blue' : 'dim'] );
		
		if (details.exec && details.exec.kind === 'sequence') {
		    console.log(details.exec.components
				.map(a => {
				    const name = a.substring(a.lastIndexOf('/') + 1);
				    return name[chainAttached && isDirectlyAttachedTo(name) ? 'green' : 'reset'];
				}).join(' -> '));
		} else {
		    console.log(property ? details.exec[property]
				: 'This is a ' + details.exec.kind.blue + ' action');
		}

		ok_(next);
	    }).catch(errorWhile('fetching action details', next));
    }
    
    if (!name) {
	_list(ow, function(L) {
	    require('inquirer')
		.prompt([{ name: 'name', type: 'list',
			   message: 'Which action do you wish to inspect?',
			   choices: L.map(function(action) { return action.name; })
			 }])
		.then(function(response) { doInspect(response.name); });
	});
    } else {
	doInspect(name);
    }
};
