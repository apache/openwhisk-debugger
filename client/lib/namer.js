var uuid = require('uuid');

/**
 *
 * @return a new unique name for an entity
 */
exports.prefix = '___debug___';

exports.name = function name(extra) {
    return exports.prefix + (extra ? extra + '-' : '') + uuid.v4();
};

exports.isDebugArtifact = function isDebugArtifact(name) {
    return name.indexOf(exports.prefix) === 0;
};
