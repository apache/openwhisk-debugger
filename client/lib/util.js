var openwhisk = require('openwhisk'),
    api = {
	host: 'https://openwhisk.ng.bluemix.net',
	path: '/api/v1'
    };

/**
 * Initialize a connection mediator to openwhisk
 *
 */
exports.setupOpenWhisk = function setupOpenWhisk(wskprops) {
    var key = wskprops.AUTH;
    var namespace = wskprops.NAMESPACE;
    var ow = openwhisk({
	api: api.host + api.path,
	api_key: key,
	namespace: namespace
    });
    return ow;
};
