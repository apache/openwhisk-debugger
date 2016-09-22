var   Cloudant = require("cloudant"),
 VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES),
  instanceName = 'OWDBG',
        dbName = 'owdbg-registry';

// these variables are initialized below
var cloudant, cloudantCreds;

try {
    cloudantCreds = VCAP_SERVICES.cloudantNoSQLDB.filter(function(env) {
	return env.name == instanceName;
    })[0].credentials;
    cloudant = Cloudant(cloudantCreds.url);
} catch (e) {
    console.log("Could not initialize cloudant");
    cloudant = undefined;
}

/*var WebSocketServer = require('ws').Server;
function startWebSocket(onMessage, docRev) {
    var serverInstance = new WebSocketServer();
    console.log("Listening on port " + serverInstance.port);

    serverInstance.on('connection', function connection(ws) {
	ws.on('message', function _onMessage(message) {
	    onMessage(message, ws, docRev);
	});
    });
}*/

exports.init = function(next) {
    if (!cloudant) return next(); // error in initialization

    cloudant.db.create(dbName, next);
}

function registerDebugClient(key, next, nextOnErr) {
    var db = cloudant.db.use(dbName);

    db.insert({}, key, function(err, body, header) {
	if (err) {
	    // TODO log the error
	    console.log("Error inserting registration into DB " + e);
	    nextOnErr();
	} else {
	    next(body.rev);
	}
    });
}
function unregisterDebugClient(key, next, nextOnErr) {
    var db = cloudant.db.use(dbName);

    db.get(key, function(err, body, header) {
	if (err) {
	    nextOnErr();
	} else {
	    db.destroy(key, body.rev, function(err, body, header) {
		if (err) {
		    // TODO log the error
		    console.log("Error inserting registration into DB " + e);
		    nextOnErr();
		} else {
		    next();
		}
	    });
	}
    });
}

function ok(ws) {
    ws.send(JSON.stringify({ status: "ok" }));
}
function oops(ws) {
    ws.send(JSON.stringify({ status: "error" }));
}

function handleClientMessage(ws) {
    var _ok = ok.bind(undefined, ws);
    var _oops = oops.bind(undefined, ws);

    return function onMessage(message) {
	try {
	    message = JSON.parse(message);
	    switch (message.action) {
	    case "init":
		registerDebugClient(message.key, _ok, _oops);
		break;
		
	    case "end":
		unregisterDebugClient(message.key, _ok, _oops);
		break;
	    }
	} catch (e) {
	}
    };
}

exports.registerDebugClient_route = function(ws, res) {
    ws.on('message', handleClientMessage(ws));
}
