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

var uuid = require('uuid'),
    fs = require('fs'),
    path = require('path'),
    inquirer = require('inquirer'),
    openwhisk = require('openwhisk'),
    setupOpenWhisk = require('./util').setupOpenWhisk,
    mostRecentEnd = require('./activations').mostRecentEnd,
    waitForActivationCompletion = require('./activations').waitForActivationCompletion,
    lister = require('./commands/list'),
    Namer = require('./namer'),
    ok = require('./repl-messages').ok,
    ok_ = require('./repl-messages').ok_,
    errorWhile = require('./repl-messages').errorWhile,
    invokerPackageNamespace = 'nickm@us.ibm.com_canary-advisor', // this is currently housed in one of nick's namespace
    invokerPackageName = 'owdbg',
    invokerActionName = 'invoker',
    invoker = invokerPackageName + '/' + invokerActionName,
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    },
    debugBroker = {
	host: 'https://owdbg-broker.mybluemix.net'
    };

/** the dictionary of live attachments to actions */
var attached = {}, chainAttached = {}, lastAttached = {};

exports.lastAttached = lastAttached;
exports.isDirectlyAttachedTo = function isDirectlyAttachedTo(name) {
    return attached[name];
};
exports.isChainAttachedTo = function isChainAttachedTo(name) {
    return chainAttached[name];
};

function echoContinuation(entity, entityNamespace) {
    return {
	annotations: [{ key: 'debug', value: '/' + entityNamespace + '/' + entity }],
	exec: {
	    kind: 'nodejs',
	    code: 'function main(params) { return params; }'
	}
    };
}

function doWithRetry(promiseFunc) {
    return promiseFunc().catch((err) => doWithRetry(promiseFunc));
}

/**
 * Clean up any residual debugging artifacts
 *
 */
exports.clean = function clean(wskprops, next) {
    function cleanType(type) {
	var types = type + 's';
	// console.log('Cleaning ' + types);

	return new Promise(function(resolve, reject) {
	    lister.list(wskprops, function onList(entities, ow) {
		var toClean = entities.filter(function(entity) {
		    return Namer.isDebugArtifact(entity.name);
		});
		var counter = toClean.length;
		
		if (counter === 0) {
		    return resolve(toClean.length);
		}
		function _countDown(resolver) {
		    if (--counter === 0) {
			resolver(toClean.length);
		    }
		}
		var countDownError = _countDown.bind(undefined, reject);
		var countDown = _countDown.bind(undefined, resolve);

		toClean.forEach(function(entity) {
		    var params = {};
		    params[type + 'Name'] = entity.name;
		    function clean() {
			ow[types].delete(params)
			    .then(countDown)
			    .catch(errorWhile('cleaning ' + entity.name, countDownError));
		    }
		    if (type === 'rule') {
			doWithRetry(() => ow.rules.disable(params).then(clean));
		    } else {
			clean();
		    }
		});
	    }, types);
	});
    }

    Promise.all([cleanType('action'),
		 cleanType('trigger'),
		 cleanType('package')
		])
	.then(() =>
	    cleanType('rule')
	      .then(ok(next))
	      .catch(errorWhile('cleaning rules', next)))
	.catch(errorWhile('cleaning actions and triggers', next));
};

var UpstreamAdapter = {
    createNames: function createUpstreamAdapterNames(continuationName) {
	return {
	    ruleName: Namer.name('continuation-rule'),
	    triggerName: Namer.name('continuation-trigger'),
	    continuationName: continuationName || Namer.name('continuation-action'),
	    createContinuationPlease: !continuationName,
	    debugStubName: Namer.name('stub')
	};
    },

    invokerFQN: function(entityNamespace, names) {
	return '/' + entityNamespace + '/' + names.debugStubName;// + '/' + invokerActionName;
    },
    invokerName: function(names) {
	return names.debugStubName;// + '/' + invokerActionName;
    },

    createInvoker: function createUpstreamAdapterInvoker_withActionClone(ow, names, actionBeingDebugged, actionBeingDebuggedNamespace) {
	return new Promise((resolve, reject) => {
	    fs.readFile(path.join(__dirname, '..', 'deps', 'invoker', 'owdbg-invoker.js'), (err, codeBuffer) => {
		if (err) {
		    reject(err);
		} else {
		    ow.actions.create({
			actionName: names.debugStubName,
			action: {
			    parameters: [{ key: 'action', value: actionBeingDebugged },
					 { key: 'namespace', value: actionBeingDebuggedNamespace },
					 { key: 'broker', value: debugBroker.host },
					 { key: 'onDone_trigger', value: names.triggerName }
					],
			    exec: {
				kind: 'nodejs:6',
				code: codeBuffer.toString('utf8')
			    }
			}
		    }).then(resolve).catch(reject);
		}
	    });
	});
    },
    createInvoker_usingPackageBinding: function createUpstreamAdapterInvoker_usingPackageBinding(ow, names, actionBeingDebugged, actionBeingDebuggedNamespace) {
	return ow.packages.create({ packageName: names.debugStubName,
				    package: {
					binding: {
					    namespace: invokerPackageNamespace,
					    name: invokerPackageName
					},
					parameters: [{ key: 'action', value: actionBeingDebugged },
						     { key: 'namespace', value: actionBeingDebuggedNamespace },
						     { key: 'onDone_trigger', value: names.triggerName }
						    ]
				    }
				  });
    },
    create: function createUpstreamAdapter(ow, actionBeingDebugged, actionBeingDebuggedNamespace, names) {
	try {
	    if (!names) {
		names = UpstreamAdapter.createNames();
	    }
	    var work = [
		ow.triggers.create(names), // create onDone_trigger
		UpstreamAdapter.createInvoker(ow, names, actionBeingDebugged, actionBeingDebuggedNamespace),
	    ];
	    if (names.createContinuationPlease) {
		work.push(ow.actions.create({ actionName: names.continuationName, action: echoContinuation(actionBeingDebugged,
													   actionBeingDebuggedNamespace) }));
	    }
	    return Promise.all(work)
		.then(() => ow.rules.create({ ruleName: names.ruleName, trigger: '/_/'+names.triggerName, action: '/_/'+names.continuationName }),
		      errorWhile('creating upstream adapter part 1'))
		.then(() => names, errorWhile('creating upstream adapter part 2'));
	} catch (e) {
	    console.error(e);
	    console.error(e.stack);
	}
    }
};

/**
 * Does the given sequence entity use the given action entity located in the given entityNamespace?
 *
 */
var SequenceRewriter = {
    rewriteNeeded: function sequenceUses(sequenceEntityThatMaybeUses, entity, entityNamespace) {
	var fqn = '/' + entityNamespace + '/' + entity;

	return sequenceEntityThatMaybeUses.name !== entity
	    && sequenceEntityThatMaybeUses.exec && sequenceEntityThatMaybeUses.exec.kind === 'sequence'
	    && sequenceEntityThatMaybeUses.exec.components && sequenceEntityThatMaybeUses.exec.components.find((c) => c === fqn);
    }
};

var RuleRewriter = {
    /**
     * Does the given rule entity use the given action entity located in the given entityNamespace?
     *
     */
    rewriteNeeded: function ruleUses(ruleEntityThatMaybeUses, entity, entityNamespace, isAnInstrumentedSequence) {
	//var fqn = '/' + entityNamespace + '/' + entity;

	return ruleEntityThatMaybeUses.name !== entity
	    && (ruleEntityThatMaybeUses.action === entity
		|| isAnInstrumentedSequence[ruleEntityThatMaybeUses.action]);
    },

    rewrite: function cloneRule(ow, ruleEntityWithDetails, entity, entityNamespace, names) {
	if (ruleEntityWithDetails.action === entity) {
	    //
	    // then the rule is T => entity, so we can simply create a new rule T => debugStub
	    //
	    return ow.rules.create({ ruleName: Namer.name('rule-clone'),
				     trigger: '/_/'+ruleEntityWithDetails.trigger,
				     action: '/_/'+names.debugStubName
				   })
		.then(newRule => chainAttached[ruleEntityWithDetails.name] = names);
	} else {
	    var details = chainAttached[ruleEntityWithDetails.action];
	    if (details) {
		//
		// this means the rule maps T => sequence, where the sequence directly contains entity [..., entity, ... ]
		//
		return ow.rules.create({ ruleName: Namer.name('rule-clone'),
					 trigger: '/_/'+ruleEntityWithDetails.trigger,
					 action: '/_/'+details.before
				       })
		    .then(newRule => chainAttached[ruleEntityWithDetails.name] = names);
	    }
	}
    }
};


function beforeSpliceSplitter(element, replacement, A) { A = A.slice(0, A.indexOf(element)); A.push(replacement); return A; }
function afterSpliceSplitter(element, tackOnTheEnd, A) { A = A.slice(A.indexOf(element) + 1); return A; }
function makeSequenceSplicePart(ow, name, sequence, splitter) {
    var opts = {
	actionName: name,
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
    try {
	var finalBit;/*{
	    actionName: Namer.name('action'),
	    action: echoContinuation(entity, entityNamespace, spliceNames.onDone_trigger)
	};*/
	
	var fqn = '/' + entityNamespace + '/' + entity;

	var afterSpliceContinuation = Namer.name('sequence-splice-after', `for-${sequence.name}`);
	var upstreamAdapterNames = UpstreamAdapter.createNames(afterSpliceContinuation);

	var beforeSpliceUpstream = UpstreamAdapter.invokerFQN(entityNamespace, upstreamAdapterNames);
	//var afterSpliceContinuation = '/' + entityNamespace + '/' + upstreamAdapterNames.continuationName;

	return Promise.all([
	    makeSequenceSplicePart(ow,
				   Namer.name('sequence-splice-before'),
				   sequence,
				   beforeSpliceSplitter.bind(undefined, fqn, beforeSpliceUpstream)),   // before: _/--upstream
	    makeSequenceSplicePart(ow,
				   afterSpliceContinuation,
				   sequence,
				   afterSpliceSplitter.bind(undefined, fqn, finalBit)) // after: -\__continuation

	]).then(beforeAndAfter => {
	    //
	    // after the breakpoint, continue with the afterSplice
	    //
	    return UpstreamAdapter.create(ow, entity, entityNamespace, upstreamAdapterNames)
		.then(() => {
		    //
		    // this sequence splice uses its own downstream trigger, not the generic one from the action splice
		    //
		    var names = {
			before: beforeAndAfter[0].name,
			after: beforeAndAfter[1].name,
			triggerName: upstreamAdapterNames.triggerName
		    };
		    chainAttached[sequence.name] = names;
		    return names;

		}, errorWhile('creating upstream adapter'));
	}, errorWhile('splicing sequence'));
    } catch (e) {
	console.error(e);
    }
}

function doPar(ow, type, entity, each) {
    return new Promise((resolve, reject) => {
	var types = type + 's';
	ow[types].list({ limit: 200 })
	    .then(entities => {
		var counter = entities.length;
		function countDown(names) {
		    if (--counter <= 0) {
			resolve();
		    }
		}
		entities.forEach(otherEntity => {
		    if (otherEntity.name === entity) {
			// this is the entity itself. skip, because
			// we're looking for uses in *other* entities
			countDown();

		    } else {
			var opts = { namespace: otherEntity.namespace };
			opts[type + 'Name'] = otherEntity.name;
			ow[types].get(opts)
			    .then(otherEntityWithDetails => each(otherEntityWithDetails, countDown))
			    .catch(errorWhile('processing one ' + type, countDown));
		    }
		});
	    })
	    .catch(errorWhile('processing ' + types, reject));
    });
}

/**
 * Attach to the given entity, allowing for debugging its invocations
 *
 */
exports.attach = function attach(wskprops, options, next, entity) {
    if (options.help) {
	// the user passed -h or --help, so there is nothing to do here
	return next();
    }
    if (!entity) {
	console.error('Error: Please specify an entity ');
	console.error();
	return next();
    }

    try {
	var entityNamespace = wskprops.NAMESPACE;
	var ow = setupOpenWhisk(wskprops);

	var doAttach = function doAttach() {
	    console.log('Attaching'.blue + ' to ' + entity);

	    console.log('   Creating action trampoline'.green);
	    UpstreamAdapter.create(ow, entity, entityNamespace).then(names => {
		// remember the names, so that we can route invocations to the debug version
		attached[entity] = names;
		lastAttached = entity;

		if (!options || !options.all) {
		    //
		    // user asked not to instrument any rules or sequences
		    //
		    return ok_(next);
		}

		// remember all sequences that include action, so that we can properly handle rules T -> sequence(..., action, ...)
		var isAnInstrumentedSequence = {};
		doPar(ow, 'action', entity, (otherEntityWithDetails, countDown) => {
		    if (SequenceRewriter.rewriteNeeded(otherEntityWithDetails, entity, entityNamespace)) {
			//
			// splice the sequence!
			//
			console.log('   Creating sequence splice'.green, otherEntityWithDetails.name);
			isAnInstrumentedSequence[otherEntityWithDetails.name] = true;
			spliceSequence(ow, otherEntityWithDetails, entity, entityNamespace, names)
			    .then(countDown)
			    .catch(errorWhile('creating sequence splice', countDown));
			
		    } else {
			countDown();
		    }
		}).then(() => {
		    doPar(ow, 'rule', entity, (otherEntityWithDetails, countDown) => {
			if (RuleRewriter.rewriteNeeded(otherEntityWithDetails, entity, entityNamespace, isAnInstrumentedSequence)) {
			    //
			    // clone the rule!
			    //
			    console.log('   Creating rule clone'.green, otherEntityWithDetails.name);
			    RuleRewriter.rewrite(ow, otherEntityWithDetails, entity, entityNamespace, names)
				.then(countDown, errorWhile('creating rule clone', countDown));
			} else {
			    countDown();
			}
		    }).then(ok(next)).catch(next);
		}).catch(next);
	    });
	}; /* end of doAttach */
	
	//
	// first fetch the action to make sure it exists (at least for now)
	//
	ow.actions.get({ actionName: entity })
	    .then(doAttach)
	    .catch(errorWhile('looking up action', next));
	
    } catch (e) {
	console.error(e);
    }
};

exports.detachAll = function detachAll(wskprops, next) {
    var ow = setupOpenWhisk(wskprops);

    var count = 0;
    function done() {
	if (--count <= 0) {
	    if (next) {
		next();
	    }
	}
    }
    
    for (var entity in attached) {
	if (attached.hasOwnProperty(entity)) {
	    count++;
	}
    }

    if (count === 0) {
	done();
    } else {
	for (entity in attached) {
	    if (attached.hasOwnProperty(entity)) {
		exports.detach(wskprops, done, entity);
	    }
	}
    }
};

function doDetach(wskprops, next, entity) {
    console.log('Detaching'.blue + ' from ' + entity);

    function errlog(idx, noNext) {
	return function(err) {
	    if (err.indexOf && err.indexOf('HTTP 404') < 0) {
		console.error('Error ' + idx, err);
	    }
	    if (!noNext) {
		next();
	    }
	};
    }
    
    var names = attached[entity];
    if (names) {
	try {
	    var ow = setupOpenWhisk(wskprops);
	    ow.rules.disable(names)
		.then(() => {
		    try {
			// first delete the action and rule and debug package
			Promise.all([ow.triggers.delete(names),
				     ow.actions.delete({ actionName: names.continuationName }),
				     ow.actions.delete({ actionName: names.debugStubName }) // keep in sync with UpstreamAdapter
				    ])
			    .then(() => {
				// then we can delete the rule
				ow.rules.delete(names)
				    .then(() => {
					try {
					    delete attached[entity];
					    ok_(next);
					} catch (err) {
					    errlog(5, true)(err);
					}
				    }).
				    catch(errlog(4));
			    })
			    .catch(errlog(3));
		    }
		    catch (err) { errlog(2, true)(err); }
		}).catch(errlog(1));
	} catch (err) {
	    errlog(0)(err);
	}
    }
}
exports.detach = function detach(wskprops, next, entity) {
    if (!entity) {
	var L = [];
	for (var x in attached) {
	    if (attached.hasOwnProperty(x)) {
		L.push(x);
	    }
	}
	if (L.length === 0) {
	    console.error('No attached actions detected');
	    next();
	} else {
	    inquirer
		.prompt([{ name: 'name', type: 'list',
			   message: 'From which action do you wish to detach',
			   choices: L
			 }])
		.then(function(response) { doDetach(wskprops, next, response.name); });
	}
    } else {
	doDetach(wskprops, next, entity);
    }
};

/**
 * Invoke an action
 *
 */
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
    var eventBus = args.shift();
    var namespace = wskprops.NAMESPACE;
    var next = args.shift();
    var action = args.shift();

    if (!action || action === '-p' || action === 'invoke') {
	//
	// user did not provide an action
	//
	if (action) {
	    args.unshift(action);
	}

	action = lastAttached;
    }

    var params = {};
    for (var i = 0; i < args.length; i++) {
	if (args[i] === '-p') {
	    params[args[++i]] = args[++i];
	}
    }

    var invokeThisAction, waitForThisAction;
    
    var attachedTo = attached[action];
    if (!attachedTo) {
	var seq = chainAttached[action];
	if (seq) {
	    if (seq.before) {
		// sequence
		invokeThisAction = seq.before;
		waitForThisAction = seq.after;
	    } else {
		// rule: invoke the rule's action
		invokeThisAction = seq.debugStubName;
		waitForThisAction = seq.continuationName;
	    }

	} else {
	    invokeThisAction = action;
	    waitForThisAction = action;
	}

    } else {
	invokeThisAction = UpstreamAdapter.invokerName(attachedTo);

	// these are now part of the debug stub binding
	// params.action = action;
	// params.namespace = namespace;
	// params.onDone_trigger = attachedTo.triggerName;

	waitForThisAction = attachedTo.continuationName;
    }

    //console.log('Invoking', action);
    
    if (!action) {
	console.error('Please provide an action to invoke'.red);
	return next();
    }

    var ow = setupOpenWhisk(wskprops);

    //
    // remember the time, so that the waitForActivationCompletion
    // doesn't look for previous invocations of the given action
    //
    mostRecentEnd(wskprops)
	.then(since => ow.actions.invoke({ actionName: invokeThisAction, params: params })
	      .then(() => waitForActivationCompletion(wskprops, eventBus, waitForThisAction, { result: true, since: since })
		    .then(ok(next)))
	      .catch(errorWhile('invoking your specified action', next)));
};
