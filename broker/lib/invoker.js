var getClient = require('./db').getClient,
         uuid = require('uuid'),
      request = require('request');

var activations = {};

exports.invoke = function(req, res) {
    var key = req.body.key;
    var action = req.body.action;
    var namespace = req.body.namespace || "_";

    console.log("INVOKE:Begin " + key + " " + action);

    var client = getClient(key);
    if (client) {
	//
	// fetch the action details from the openwhisk server
	//
	request({
	    url: "https://openwhisk.ng.bluemix.net/api/v1"
		+ "/namespaces/" + encodeURIComponent(namespace)
		+ "/actions/" + encodeURIComponent(action),
	    method: "GET",
	    headers: {
		"Authorization": 'basic ' + new Buffer(key).toString('base64')
	    }
	}, function(err, response, body) {
	    if (err || response.statusCode != 200) {
		if (err) console.log("INVOKE:ErrorFetchingAction " + JSON.stringify(err));
		else console.log("INVOKE:ErrorFetchingAction_b " + JSON.stringify(response) + " " + JSON.stringify(body));		
		res.status(response.statusCode || 500).send(body);
	    } else {
		var activationId = uuid.v4();

		//
		// send the action details to the debug client
		//
		client.ws.send(JSON.stringify({
		    type: "invoke",
		    key: key,
		    activationId: activationId,
		    onDone_trigger: req.body.onDone_trigger,
		    actualParameters: req.body.actualParameters,
		    action: JSON.parse(body)
		}), function onError(error) {
		    console.log("INVOKE:ErrorSendingToClient " + JSON.stringify(error) + " " + client.ws.readyState);
		});

		//
		// create an activation record for this invocation
		//
		client.activations[activationId] = activations[activationId] = {
		    result: undefined,
		    action: JSON.parse(body)
		};

		//
		// respond to the invoke dispatcher that all is well
		//
		res.status(200).send({
		    activationId: activationId
		});
	    }
	});
	
    } else {
	console.log("INVOKE:ClientNotFound");
	res.sendStatus(404);
    }
}

exports.status = function(req, res) {
    var key = req.headers.authkey;
    var activationId = req.params.activationId;

    console.log("INVOKE:Status " + key + " " + activationId + " " + JSON.stringify(req.headers));

    var activation = activations[activationId];
    if (activation) {
	console.log("INVOKE:Status:Result " + JSON.stringify(activation.result));
	res.status(200).send(JSON.stringify({
	    result: activation.result
	}));
    } else {
	nope(res, "Could not find activationId for this debug client " + activationId);
    }
}

function nope(res, message) {
    res.status(404).send(JSON.stringify({ message: message }));
}
