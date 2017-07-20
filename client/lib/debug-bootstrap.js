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

var openwhisk = require('openwhisk'),
    api = {
    host: 'https://openwhisk.ng.bluemix.net',
    path: '/api/v1'
    };

module.exports = function(key, namespace, triggerName, breakAtExit) {
    return function(main, actualParameters) {
    var result = main(actualParameters || {});

    var ow = openwhisk({
        api: api.host + api.path,
        api_key: key,
        namespace: namespace
    });

    // if you want to insert a breakpoint just before exit
    if (breakAtExit) {
        /* jshint ignore:start */
        debugger;
        /* jshint ignore:end */
    }

    // console.log('Returning ' + JSON.stringify(result, undefined, 4));

    ow.triggers.invoke({
        triggerName: triggerName,
        params: result
    }).then(function() {
        // console.log('Debug session complete');
    });
    };
};
