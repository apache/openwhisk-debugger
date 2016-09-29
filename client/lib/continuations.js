var request = require('request'),
    uuid = require('uuid');

module.exports = function exports(api) {
    var module = {};
    
    module.makeEchoChamber = function makeEchoChamber(key, namespace, next, nextOnErr) {
	var names = {
	    rule: 'rule_' + uuid.v4(),
	    trigger: 'trigger_' + uuid.v4(),
	    action: 'action_' + uuid.v4()
	}

	makeTrigger(key, namespace, names.trigger,
		    makeAction.bind(undefined, key, namespace, names.action, 
				    makeRule.bind(undefined,
						  { trigger: names.trigger, action: names.action },
						  key, namespace, names.rule, function allDone() {
						      next(names);
						  }, nextOnErr),
				    nextOnErr),
		    nextOnErr);

	return names;
    }

    function makeEntity(type, body, key, namespace, name, next, nextOnErr) {
	var opts = {
	    url: api.host + api.path + '/namespaces/' + encodeURIComponent(namespace) + '/' + type + 's/' + encodeURIComponent(name),
	    method: 'PUT',
	    json: true,
	    body: body || {},
	    headers: {
		'Content-Type': 'application/json',
		'Authorization': 'basic ' + new Buffer(key).toString('base64')
	    },
	};

	request(opts, function(err, response, body) {
	    if (err || response.statusCode != 200) {
		console.log('makeEchoChamber:Error ' + JSON.stringify(err, undefined, 4) + ' ' + (response && response.statusCode) + ' ' + JSON.stringify(body, undefined, 4));
		nextOnErr();
	    } else {
		next();
	    }
	});
    }

    var echo = {
	exec: {
	    kind: 'nodejs:default',
	    code: 'function main(params) { return params; }'
	}
    };

    var makeTrigger = makeEntity.bind(undefined, 'trigger', undefined);
    var makeAction = makeEntity.bind(undefined, 'action', echo);
    var makeRule = makeEntity.bind(undefined, 'rule');

    return module;
};
