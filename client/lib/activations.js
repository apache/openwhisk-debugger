var pollIntervalMillis = 200,
    openwhisk = require('openwhisk'),
    ok_ = require('./repl-messages').ok_,
    errorWhile = require('./repl-messages').errorWhile,
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

/**
 * Wait for activation completion
 *
 */
exports.waitForActivationCompletion = function waitForActivationCompletion(wskprops, eventBus, waitForThisAction) {
    var key = wskprops.AUTH;
    var ow = openwhisk({
	api: api.host + api.path,
	api_key: key,
	namespace: '_' // special here, as activations are currently stored in the user's default namespace
    });

    return new Promise((resolve, reject) => {
	//
	// this is the poll function
	//
	var pollOnce = function() {
	    //
	    // scan the recent activations, looking for the
	    // anticipated activation by invoked-entity name
	    //
	    ow.activations.list({ limit: 20 }).then(list => {
		var allDone = false;
		for (var i = 0; i < list.length; i++) {
		    var activation = list[i];
		    if (activation.name === waitForThisAction) {

			//
			// great! we found the anticipated activation
			//
			ow.activations.get({ activation: activation.activationId })
			    .then(activationDetails => {
				// print out the activation record
				console.log(JSON.stringify(activationDetails, undefined, 4));

				// let other async listeners know about it
				eventBus.emit('invocation-done', activationDetails);

				// and let the promise know about it
				resolve(activationDetails);

			    }).catch(errorWhile('fetching activation detais', reject));
			
			allDone = true;
			break;
		    }
		}
		if (!allDone) {
		    //
		    // not yet, try again in a little bit
		    //
		    setTimeout(pollOnce, pollIntervalMillis);
		}
		    
	    }).catch(errorWhile('listing activations', reject));
	};

	//
	// start up the poller
	//
	setTimeout(pollOnce, pollIntervalMillis);
    });
};
