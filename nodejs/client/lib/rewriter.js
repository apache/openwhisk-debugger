var uuid = require('uuid'),
    openwhisk = require('openwhisk'),
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

var attached = {};

var echoCompletion = "function main(params) { return params; }";

function setupOpenWhisk(wskprops) {
    var key = wskprops['AUTH'];
    var namespace = wskprops['NAMESPACE'];
    var ow = openwhisk({
	api: api.host + api.path,
	api_key: key,
	namespace: namespace
    });
    return ow;
}

exports.attach = function attach(wskprops, next, entity) {
    var names = attached[entity] = {
	triggerName: uuid.v4(),
	actionName: uuid.v4(),
	ruleName: uuid.v4(),
	action: echoCompletion
    };

    console.log("Attaching".blue + " to " + entity);

    var ow = setupOpenWhisk(wskprops);

    try {
	Promise.all([ow.triggers.create(names),
		     ow.actions.create(names)])
	    .then(function() {
		ow.rules
		    .create({ ruleName: names.ruleName, trigger: names.triggerName, action: names.actionName })
		    .then(next);
	    });
    } catch (e) {
	console.error(e);
    }
};

exports.detachAll = function detachAll(wskprops, next) {
    var ow = setupOpenWhisk(wskprops);

    var count = 0;
    function done() {
	if (--count <= 0) {
	    next && next();
	}
    }
    
    for (var entity in attached) {
	count++;
    }

    if (count == 0) {
	done();
    } else {
	for (var entity in attached) {
	    exports.detach(wskprops, done, entity);
	}
    }
};

exports.detach = function detach(wskprops, next, entity) {
    console.log("Detaching".blue + " from " + entity);

    function errlog(idx, noNext) {
	return function(err) {
	    console.error("Error " + idx, err);
	    if (!noNext) next();
	};
    }
    
    var names = attached[entity];
    if (names) {
	try {
	    var ow = setupOpenWhisk(wskprops);
	    //console.log("D1");
	    ow.rules.disable(names).then(function() {
		try {
		    //console.log("D2");
		    Promise.all([ow.triggers.delete(names),
				 ow.actions.delete(names)])
			.then(function(values) {
			    //console.log("D3");
			    ow.rules.delete(names).then(function() {
				try { delete attached[entity]; next(); } catch (err) { errlog(5, true)(); }
			    }, errlog(4));
			}, errlog(3));
		} catch (err) { errlog(2, true)(); }
	    }, errlog(1));
	} catch (e) {
	    console.error(e);
	}
    }
};

exports.invoke = function invoke() {
    try {
	exports._invoke.apply(undefined, arguments);
    } catch (e) {
	console.error(e);
    }
};
exports._invoke = function invoke() {
    var args = Array.prototype.slice.call(arguments);
    var wskprops = args.shift();
    var namespace = wskprops['NAMESPACE'];
    var next = args.shift();
    var action = args.shift();

    var params = {};
    for (var i = 0; i < args.length; i++) {
	if (args[i] == '-p') {
	    params[args[++i]] = args[++i];
	}
    }

    var invokeThisAction, waitForThisAction;
    
    var attachedTo = attached[action];
    if (!attachedTo) {
	invokeThisAction = action;
	waitForThisAction = action;

    } else {
	invokeThisAction = 'owdbg/invoker';

	params.action = action;
	params.namespace = namespace;

	params.onDone_trigger = attachedTo.triggerName;
	waitForThisAction = attachedTo.actionName;
    }

    //console.log("PARAMS", invokeThisAction, params);

    var key = wskprops['AUTH'];
    var ow = setupOpenWhisk(wskprops);
    var owForActivations = openwhisk({
	api: api.host + api.path,
	api_key: key,
	namespace: '_'
    });

    ow.actions.invoke({
	actionName: invokeThisAction,
	params: params
    }).then(function(activation) {
	if (activation && activation.activationId) {
	    // successfully invoked
	    if (!attachedTo) {
		console.log('Successfully invoked with activationId', activation.activationId);
	    } else {

	    }

	    var timer = setInterval(function waitForResponse() {
		owForActivations.activations.list({ limit: 10 }).then(function(list) {
		    for (var i = 0; i < list.length; i++) {
			var activation = list[i];
			if (activation.name == waitForThisAction) {
			    clearInterval(timer);
			    owForActivations.activations.get({ activation: activation.activationId }).then(function(activation) {
				console.log(JSON.stringify(activation, undefined, 4));
				next();
			    });
			    break;
			}
		    }
		});
	    }, 2000);
	}
    });
}
