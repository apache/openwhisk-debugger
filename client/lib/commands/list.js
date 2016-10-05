var created = require('./create').created,
    Namer = require('../namer'),
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports._list = function _list(ow, callback, type) {
    ow[type || 'actions']
	.list({ limit: 200 })
	.then(function onList(L) { callback(L, ow); },
	      errorWhile('fetching actions', callback));
};

exports.list = function list(wskprops, callback, type) {
    var ow = setupOpenWhisk(wskprops);
    exports._list(ow, callback, type);
};

exports.listToConsole = function listToConsole(wskprops, options, next) {
    if (options.help) {
	return next();
    }

    console.log('Available actions:'.blue);
    function print(actions) {
	actions
	    .filter(action => options && options.full || !Namer.isDebugArtifact(action.name))
	    .forEach(action => console.log('    ', action.name[created[action.name] ? 'green' : 'reset']));

	ok_(next);
    }

    exports.list(wskprops, print);
};
