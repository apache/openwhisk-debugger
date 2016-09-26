var openwhisk = require('openwhisk'),
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

module.exports = function(key, namespace, triggerName) {
    return function(main, actualParameters) {
	var result = main(actualParameters || {});

	var ow = openwhisk({
	    api: api.host + api.path,
	    api_key: key,
	    namespace: namespace
	});
	//	debugger;

	ow.triggers.invoke({
	    triggerName: triggerName,
	    params: result
	});
    };
};
