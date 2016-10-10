var fs = require('fs'),
    JsDiff = require('diff');

var outstandingDiffs = {};

function entityKey(namespace, name) {
    return '/' + namespace + '/' + name;
}

exports.getOutstandingDiff = function getOutstandingDiff(entity, namespace) {
    namespace = namespace || entity.namespace;
    var name = entity.name || entity;
    return outstandingDiffs[entityKey(namespace, name)];
};
exports.clearOutstandingDiff = function clearOutstandingDiff(entity, namespace) {
    namespace = namespace || entity.namespace;
    var name = entity.name || entity;
    delete outstandingDiffs[entityKey(namespace, name)];
};

exports.applyPatch = function applyPatch(data, patch) {
    var lines = data.split('\n');
    var newLines = [];
    var dataIndex = 1;

    if (!patch.hunks) {
	//
	// patch is a textual unified diff. parse it
	//
	patch = JsDiff.parsePatch(patch)[0];
    }
    
    patch.hunks.forEach((hunk, hunkIndex) => {
	for (var i = dataIndex; i < hunk.oldStart; i++) {
	    newLines.push(lines[i - 1]);
	}

	hunk.lines.forEach( (line, index) => {
	    if (line.charAt(0) === '+') {
		// new line
		newLines.push(line.slice(1));
		
	    } else if (line.charAt(0) === '-') {
		// removed line
		dataIndex++;
		
	    } else if (line.charAt(0) !== '\\') {
		// patch doesn't say anything about this line
		newLines.push(lines[dataIndex++ - 1]);
	    }
	});

	dataIndex = hunk.oldStart + hunk.oldLines + 1;

	if (hunkIndex === patch.hunks.length - 1) {
	    for (i = dataIndex - 1; i < lines.length; i++) {
		newLines.push(lines[i]);
	    }
	}
    });

    return newLines.join('\n');
};

exports.checkIfFileChanged = function checkIfFileChanged(data1, f2, removeBootstrapPatch) {
    return new Promise((resolve, reject) => {
	fs.readFile(f2, (err2, data2) => {
	    try {
		if (err2) {
		    console.error('Error reading file', err2);
		    reject(err2);
		} else {
		    data2 = data2.toString();

		    if (removeBootstrapPatch) {
			try {
			    data2 = exports.applyPatch(data2, removeBootstrapPatch);
			} catch (err) {
			    console.error('Error applying patch', err);
			    console.error(removeBootstrapPatch);
			    console.error(err.stack);
			}
		    }

		    var comparo;
		    try {
			comparo = JsDiff.createPatch('wskdb', data1, data2);
		    } catch (err) {
			console.error('Error creating patch', err);
			console.error('D1', data1);
			console.error('D2', data2);
			console.error(err.stack);
		    }
		    if (comparo && comparo.indexOf('@@') >= 0) {
			resolve(comparo);
		    } else {
			reject(false);
		    }
		}
	    } catch (err) {
		console.error('Error creating diff', err);
		reject(err);
	    }
	});
    });
};

exports.removeIfNotChanged = function removeIfNotChanged(data1, f2, cleanupF2, removeBootstrapPatch) {
    return exports.checkIfFileChanged(data1, f2, removeBootstrapPatch).catch(cleanupF2);
};

exports.rememberIfChanged = function rememberIfChanged(action, f2, cleanupF2, removeBootstrapPatch) {
    return exports.removeIfNotChanged(action.exec.code, f2, cleanupF2, removeBootstrapPatch)
	.then(comparo => {
	    if (comparo) {
		outstandingDiffs[entityKey(action.namespace, action.name)] = {
		    action: action,
		    comparo: comparo
		};
	    }
	});
};

exports.createPatch = function(data1, data2) {
    return JsDiff.structuredPatch('wskdb', 'wskdb', data1, data2);
};
