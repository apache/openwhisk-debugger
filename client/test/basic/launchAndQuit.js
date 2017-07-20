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

import {test as it} from 'ava'
var spawn = require('child_process').spawn

it('should launch and quit without error', t => {
    return new Promise((resolve,reject) => {
    var child = spawn('node', ['wskdb.js'], { cwd: '../..' })
    child.stdin.write('q\n');

    child.stderr.on('data', (data) => {
        console.error('stderr: ' + data)
    })
    /*child.stdout.on('data', (data) => {
    })*/
    child.on('exit', (code) => {
        if (code == 0) resolve()
        else reject(code)
    })
    }).then(result => t.is(result))
});
