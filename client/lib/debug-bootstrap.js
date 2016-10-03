var openwhisk = require('openwhisk'),
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

module.exports = function(key, namespace, triggerName, breakAtExit) {
    return function(main, actualParameters) {
	var result = main(actualParameters || {});

	var ow = openwhisk({
	    api: api.host + api.path,
	    api_key: key,
	    namespace: namespace
	});

	// if you want to insert a breakpoint just before exit
	if (breakAtExit) {
	    debugger;
	}

	console.log('Returning ' + JSON.stringify(result, undefined, 4));

	ow.triggers.invoke({
	    triggerName: triggerName,
	    params: result
	});
    };
};
