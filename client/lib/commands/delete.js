var created = require('./create').created,
    _list = require('./list')._list,
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

/**
 * Delete an action
 *
 */
exports.deleteAction = function deleteAction(wskprops, next, name) {
    var ow = setupOpenWhisk(wskprops);

    function doDelete(name) {
	ow.actions.delete({ actionName: name })
	    .then((action) => delete created[action.name])
	    .then(ok(next), errorWhile('deleting action', next));
    }
    
    if (!name) {
	_list(ow, function(L) {
	    require('inquirer')
		.prompt([{ name: 'name', type: 'list',
			   message: 'Which action do you wish to delete',
			   choices: L.map(function(action) { return action.name; })
			 }])
		.then(function(response) { doDelete(response.name); });
	});
    } else {
	doDelete(name);
    }
};
