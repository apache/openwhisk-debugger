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

var created = require('./create').created,
    _list = require('./list')._list,
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    setupOpenWhisk = require('../util').setupOpenWhisk;

/**
 * Delete an action
 */
exports.deleteAction = function deleteAction(wskprops, next, name) {
    var ow = setupOpenWhisk(wskprops);

    function doDelete(name) {
    ow.actions.delete({ actionName: name })
        .then((action) => delete created[action.name])
        .then(ok(next), errorWhile('deleting action', next));
    }

    if (!name) {
    _list(ow, function(L) {
        require('inquirer')
        .prompt([{ name: 'name', type: 'list',
               message: 'Which action do you wish to delete?',
               choices: L.map(function(action) { return action.name; })
             }])
        .then(function(response) { doDelete(response.name); });
    });
    } else {
    doDelete(name);
    }
};
