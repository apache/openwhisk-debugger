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

var inquirer = require('inquirer'),
    ok = require('../repl-messages').ok,
    ok_ = require('../repl-messages').ok_,
    errorWhile = require('../repl-messages').errorWhile,
    getOutstandingDiff = require('../diff').getOutstandingDiff,
    clearOutstandingDiff = require('../diff').clearOutstandingDiff,
    applyPatch = require('../diff').applyPatch,
    setupOpenWhisk = require('../util').setupOpenWhisk;

/**
 * Create an action
 */
exports.publish = function publish(wskprops, next, name) {
    try {
    var diff = getOutstandingDiff(name, wskprops.NAMESPACE);

    if (!diff) {
        console.log('This action has no pending changes.');
    } else {
        var newAction = Object.assign({}, diff.action);
        newAction.exec.code = applyPatch(newAction.exec.code, diff.comparo);

        var ow = setupOpenWhisk(wskprops);
        ow.actions.update({
        actionName: diff.action.name,
        action: newAction
        });
    }

    clearOutstandingDiff(name, wskprops.NAMESAPCE);

    console.log('Your changes are now live');
    ok_(next);

    } catch (err) {
    console.error(err.stack);
    errorWhile('applying patch', next)(err);
    }
};
