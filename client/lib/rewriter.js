var uuid = require('uuid'),
    openwhisk = require('openwhisk'),
    invokerPackageNamespace = undefined, // this is currently housed in the user's namespace
    invokerPackageName = 'owdbg',
    invokerActionName = 'invoker',
    invoker = invokerPackageName + '/' + invokerActionName,
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

/** the dictionary of live attachments to actions */
var attached = {};

function echoContinuation(entity, entityNamespace) {
    return {
	annotations: [{ key: 'debug', value: '/' + entityNamespace + '/' + entity }],
	exec: {
	    kind: 'nodejs',
	    code: 'function main(params) { return params; }'
	}
    };
}

/**
 * Initialize a connection mediator to openwhisk
 *
 */
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

/**
 * Log an error, and continue
 *
 */
function errorWhile(inOperation, callback) {
    return function(err) {
	console.error('Error ' + inOperation);
	callback();
    };
}

/**
 *
 * @return a new unique name for an entity
 */
var Namer = {
    prefix: '___debug___',
    name: function name(extra) {
	return Namer.prefix + (extra ? extra + '-' : "") + uuid.v4();
    },
    isDebugArtifact: function(name) {
	return name.indexOf(Namer.prefix) == 0;
    }
};

exports.list = function list(wskprops, callback, type) {
    var ow = setupOpenWhisk(wskprops);
    _list(ow, callback, type);
};
function _list(ow, callback, type) {
    ow[type || 'actions']
	.list({ limit: 200 })
	.then(function onList(L) { callback(L, ow); },
	      errorWhile('fetching actions', callback));
}

exports.listToConsole = function listToConsole(wskprops, next) {
    console.log('Available actions:'.blue);

    function print(actions) {
	actions.forEach(function(action) {
	    console.log('    ', action.name);
	});
	next();
    }

    exports.list(wskprops, print);
};

/**
 * Clean up any residual debugging artifacts
 *
 */
exports.clean = function clean(wskprops, next) {
    function cleanType(type) {
	var types = type + 's';
	// console.log('Cleaning ' + types);

	return new Promise(function(resolve, reject) {
	    exports.list(wskprops, function onList(entities, ow) {
		var toClean = entities.filter(function(entity) {
		    return Namer.isDebugArtifact(entity.name);
		});
		var counter = toClean.length;
		
		if (counter == 0) {
		    return resolve(toClean.length);
		}
		function countDown() {
		    if (--counter == 0) {
			resolve(toClean.length);
		    }
		}
		toClean.forEach(function(entity) {
		    var params = {};
		    params[type + 'Name'] = entity.name;
		    ow[types].delete(params).then(countDown,
						  errorWhile('cleaning ' + types, countDown));
		});
	    }, types);
	});
    }

    function allDone() {
	console.log('ok'.blue);
	next();
    }
    Promise.all([cleanType('action'),
		 cleanType('trigger'),
		 cleanType('package')
		])
	.then(function() {
	    cleanType('rule')
		.then(allDone,
		      errorWhile('cleaning rules', allDone))
	}, errorWhile('cleaning actions and triggers', allDone));
};

/**
 * Create a rule splice
 */
function splice(ow, entity, entityNamespace, next) {
    try {
	var names = attached[entity] = {
	    debugStubName: Namer.name('stub'),
	    triggerName: Namer.name('continuation-trigger'),
	    continuationName: Namer.name('continuation-action'),
	    ruleName: Namer.name('continuation-rule'),
	};

	Promise.all([ow.triggers.create(names),
		     ow.actions.create({ actionName: names.continuationName, action: echoContinuation(entity, entityNamespace) }),
		     ow.packages.create({ packageName: names.debugStubName,
					  package: {
					      binding: {
						  namespace: invokerPackageNamespace || entityNamespace,
						  name: invokerPackageName
					      },
					      parameters: [{ key: 'action', value: entity },
							   { key: 'namespace', value: entityNamespace }
							  ]
					  }
					})
		    ])
	    .then(function() {
		ow.rules
		    .create({ ruleName: names.ruleName, trigger: names.triggerName, action: names.continuationName })
		    .then(function() { next(names); },
			  errorWhile('attaching to action', next));
	    });
    } catch (e) {
	console.error(e);
    }
}

function sequenceUses(maybeUsingEntity, entity, entityNamespace) {
    var fqn = '/' + entityNamespace + '/' + entity;

    return maybeUsingEntity.name !== entity
	&& maybeUsingEntity.exec && maybeUsingEntity.exec.kind == 'sequence'
	&& maybeUsingEntity.exec.components && maybeUsingEntity.exec.components.find(function(c) {
	    return c === fqn;
	});
}

function beforeSpliceSplitter(element, replacement, A) { A = A.slice(0, A.indexOf(element)); A.push(replacement); return A; }
function afterSpliceSplitter(element, replacement, A) { A = A.slice(A.indexOf(element)); A[0] = replacement; return A; }
function makeSequenceSplicePart(ow, sequence, splitter) {
    var opts = {
	actionName: Namer.name('sequence-splice'),
	action: {
	    exec: {
		kind: sequence.exec.kind,
		code: '',
		components: splitter(sequence.exec.components)
	    }
	}
    };
    return ow.actions.create(opts);
}
function spliceSequence(ow, sequence, entity, entityNamespace, names) {
    var fqn = '/' + entityNamespace + '/' + entity;
    return Promise.all([
	makeSequenceSplicePart(ow, sequence, beforeSpliceSplitter.bind(undefined, fqn, names.debugStubName + '/' + invokerActionName)),
	makeSequenceSplicePart(ow, sequence, afterSpliceSplitter.bind(undefined, fqn, '/' + entityNamespace + '/' + names.continuationName))
    ]);
}

/**
 * Attach to the given entity, allowing for debugging its invocations
 *
 */
exports.attach = function attach(wskprops, next, entity) {
    console.log('Attaching'.blue + ' to ' + entity);

    try {
	var entityNamespace = wskprops['NAMESPACE'];
	var ow = setupOpenWhisk(wskprops);

	console.log('   Creating action trampoline'.green);
	splice(ow, entity, entityNamespace, function afterSplice(names) {
	    _list(ow, function onList(entities, ow) {
		var counter = entities.length;
		function countDown() {
		    if (--counter <= 0) {
			next();
		    }
		}
		entities.forEach(function(otherEntity) {
		    if (otherEntity.name === entity) {
			countDown();
		    } else {
			ow.actions.get({ actionName: otherEntity.name, namespace: otherEntity.namespace })
			    .then(function(sequenceWithDetails) {
				if (sequenceUses(sequenceWithDetails, entity, entityNamespace)) {
				    console.log('   Creating sequence splice'.green, otherEntity.name);
				    spliceSequence(ow, sequenceWithDetails, entity, entityNamespace, names)
					.then(countDown, errorWhile('creating sequence splice', countDown));
				} else {
				    countDown();
				}
			    }).catch(function() { countDown(); });
		    }
		});
	    });
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
    console.log('Detaching'.blue + ' from ' + entity);

    function errlog(idx, noNext) {
	return function(err) {
	    if (err.indexOf('HTTP 404') < 0) {
		console.error('Error ' + idx, err);
	    }
	    if (!noNext) next();
	};
    }
    
    var names = attached[entity];
    if (names) {
	try {
	    var ow = setupOpenWhisk(wskprops);
	    //console.log('D1');
	    ow.rules.disable(names).then(function() {
		try {
		    //console.log('D2');
		    Promise.all([ow.triggers.delete(names),
				 ow.actions.delete({ actionName: names.continuationName }),
				 ow.packages.delete({ packageName: names.debugStubName })
				])
			.then(function(values) {
			    //console.log('D3');
			    ow.rules.delete(names).then(function() {
				try { delete attached[entity]; next(); } catch (err) { errlog(5, true)(err); }
			    }, errlog(4));
			}, errlog(3));
		} catch (err) { errlog(2, true)(err); }
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
	invokeThisAction = attachedTo.debugStubName + '/' + invokerActionName;

	// these are now part of the debug stub binding
	// params.action = action;
	// params.namespace = namespace;

	params.onDone_trigger = attachedTo.triggerName;
	waitForThisAction = attachedTo.continuationName;
    }

    //console.log('PARAMS', invokeThisAction, params);

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

	    //
	    // wait for activation completion
	    //
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
	    }, 1000);
	}
    });
}
