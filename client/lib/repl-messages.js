exports.ok = function ok(next) {
    return function() {
	console.log('ok');
	next();
    };
};

exports.ok_ = function ok_(next) {
    exports.ok(next)();
};

/**
 * Log an error, and continue
 *
 */
exports.errorWhile = function errorWhile(inOperation, callback) {
    return function(err) {
	console.error('Error ' + inOperation);
	console.error(err);
	if (callback) {
	    callback();
	}
    };
};
