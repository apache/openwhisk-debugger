var pollIntervalMillis = 200,
    openwhisk = require('openwhisk'),
    ok_ = require('./repl-messages').ok_,
    errorWhile = require('./repl-messages').errorWhile,
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

exports.waitForActivationCompletion = function waitForActivationCompletion(wskprops, eventBus, waitForThisAction, activation) {
    var key = wskprops.AUTH;
    var ow = openwhisk({
	api: api.host + api.path,
	api_key: key,
	namespace: '_' // special here, as activations are currently stored in the user's default namespace
    });

    return new Promise((resolve, reject) => {
	if (activation && activation.activationId) {
	    // successfully invoked

	    /*if (!attachedTo) {
		console.log('Successfully invoked with activationId', activation.activationId);
		
	    } else {
		// we'll wait for the result...
	    }*/

	    //
	    // wait for activation completion
	    //
	    var pollOnce = function() {
		ow.activations.list({ limit: 10 }).then(list => {
		    var allDone = false;
		    for (var i = 0; i < list.length; i++) {
			var activation = list[i];
			if (activation.name === waitForThisAction) {
			    ow.activations.get({ activation: activation.activationId })
				.then(activationDetails => {
				    console.log(JSON.stringify(activationDetails, undefined, 4));
				    eventBus.emit('invocation-done', activationDetails);
				    resolve(activationDetails);
				}).catch(errorWhile('fetching activation detais', reject));
			    allDone = true;
			    break;
			}
		    }
		    if (!allDone) {
			setTimeout(pollOnce, pollIntervalMillis);
		    }
		    
		}).catch(errorWhile('listing activations', reject));
	    };
	    setTimeout(pollOnce, pollIntervalMillis);
	}
    });
};
