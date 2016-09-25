/*var   Cloudant = require("cloudant"),
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
}*/

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
/*    if (!cloudant) return next(); // error in initialization

      cloudant.db.create(dbName, next);*/
    next();
}

var db = {};
function registerDebugClient(key, ws, next, nextOnErr) {
/*    var db = cloudant.db.use(dbName);

    db.insert({}, key, function(err, body, header) {
	if (err) {
	    // TODO log the error
	    console.log("Error inserting registration into DB " + e);
	    nextOnErr();
	} else {
	    next(body.rev);
	}
	});*/
    db[key] = {
	ws: ws,
	activations: {}
    }
    next();
}
function unregisterDebugClient(key, activationId, result, next, nextOnErr) {
/*    var db = cloudant.db.use(dbName);

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
	});*/
    console.log('UNREGISTER ' + key + ' ' + activationId);
    var client = db[key];
    if (client) {
	console.log('UNREGISTER:GotClient ' + JSON.stringify(client.activations));
	var activation = client.activations[activationId];
	if (activation) {
	    console.log('UNREGISTER:GotActivation => ' + result);
	    activation.result = result;
	}
	delete db[key];
    }
}

exports.getClient = function getClient(key) {
    return db[key];
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
	console.log('MESSAGE');
	try {
	    message = JSON.parse(message);
	    console.log('MESSAGE:TYPE ' + message.type + " " + JSON.stringify(message, undefined, 4));
	    switch (message.type) {
	    case 'init':
		registerDebugClient(message.key, ws, _ok, _oops);
		break;
		
	    case 'end':
		unregisterDebugClient(message.key, message.activationId, message.result, _ok, _oops);
		break;
	    }
	} catch (e) {
	    console.log('WS:handleCLientMessage:Error ' + JSON.stringify(e));
	}
    };
}

exports.registerDebugClient = function(ws, req) {
    console.log("FFFFFFFFFFFFFFFFFFFFFFFFFFF");
    ws.on('message', handleClientMessage(ws));
}
