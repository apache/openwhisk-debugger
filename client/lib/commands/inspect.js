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

var ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    okAfter = require('../repl-messages').okAfter,
    errorWhile = require('../repl-messages').errorWhile,
    _list = require('./list')._list,
    inquirer = require('inquirer'),
    isDirectlyAttachedTo = require('../rewriter').isDirectlyAttachedTo,
    isChainAttachedTo = require('../rewriter').isChainAttachedTo,
    setupOpenWhisk = require('../util').setupOpenWhisk;

exports.inspect = function inspect(wskprops, next, name, property) {
    var ow = setupOpenWhisk(wskprops);

    function doInspect(name) {
	const attached = isDirectlyAttachedTo(name);
	const chainAttached = isChainAttachedTo(name);
	const chainColor = name => name[chainAttached && isDirectlyAttachedTo(name) ? 'green' : 'reset'];

	console.log( ('Attached = ' + (attached ? 'yes' : chainAttached ? 'yes, to one or more parts' : 'no'))
		     [attached ? 'blue' : chainAttached ? 'blue' : 'dim'] );

	ow.actions.get({ actionName: name })
	    .then(details => {
		if (details.exec && details.exec.kind === 'sequence') {
		    //
		    // sequence
		    //
		    console.log('This is an action sequence');
		    console.log('\t' + details.exec.components
				.map(a => chainColor(a.substring(a.lastIndexOf('/') + 1)))
				.join(' => '));
		    
		} else {
		    //
		    // normal action
		    //
		    if (property !== 'inspect' && property !== 'get' && property.indexOf('inspect ') < 0 && property.indexOf('get ') < 0) {
			console.log(details.exec[property] || details[property]);
		    } else {
			console.log(`This is a ${details.exec.kind.blue} action`);
			if (details.exec.code && !details.exec.binary) {
			    console.log('\t' + details.exec.code.replace(/\n/g, '\n\t').green);
			} else if (details.exec.image) {
			    console.log('\t' + details.exec.image.green);
			}
		    }
		}

		ok_(next);
	    }).catch((err) => {
		if (err.toString().indexOf('Resource already exists with this name') >= 0) {
		    //
		    // then the entity exists, but isn't an action. try rules, next
		    //
		    ow.rules.get({ ruleName: name })
			.then(okAfter(rule => console.log('on ' + `${rule.trigger}`.magenta + ' => ' + chainColor(rule.action)), next))
			.catch(errorWhile('inspecting entity', next));
		} else if (err.toString().indexOf('404') >= 0) {
		    console.error(`Error: entity ${name} does not exist`.red);
		    next();
		} else {
		    console.error(err);
		    next();
		}
	    });
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
