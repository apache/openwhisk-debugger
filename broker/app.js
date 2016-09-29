var port = process.env.VCAP_APP_PORT || 8080,
    express = require('express'),
    app = express(),
    expressWs = require('express-ws')(app),
    bodyParser = require('body-parser'),
    invoker = require('./lib/invoker'),
    db = require('./lib/db');

db.init(function() {
    app.use(bodyParser.json());

    var router = express.Router();
    router.ws('/client/register', db.registerDebugClient);
    app.use('/ws', router);

    app.get('/ping', function(req, res) { res.send("OK") });
    app.post('/invoke/begin', invoker.invoke);
    app.get('/invoke/status/:activationId', invoker.status);
    
    app.listen(port, function() {
	console.log("OWDBG Broker Ready");
    });
});
