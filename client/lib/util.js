/*
 * Copyright 2015-2016 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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

/**
 * Initialize a connection mediator to openwhisk
 *
 */
exports.setupOpenWhisk = function setupOpenWhisk(wskprops) {
    var key = wskprops.AUTH;
    var ow = openwhisk({
	api: api.host + api.path,
	api_key: key
    });
    return ow;
};
