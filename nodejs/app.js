var port = process.env.VCAP_APP_PORT || 8080,
    express = require('express'),
    app = express(),
    expressWs = require('express-ws')(app),
    db = require('./lib/db');

db.init(function() {
    app.listen(port, function() {
	app.ws('/register', db.registerDebugClient_route);

	console.log("OWDBG listening on " + port);
    });
});
