/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
