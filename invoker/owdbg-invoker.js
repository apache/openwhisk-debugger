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

var request = require('request');

function main(params) {
    return new Promise(function(resolve, reject) {
	console.log('Invoking', params);

	try {
	//
	// remove debugging payload from the parameters we send to the debug session
	//
	var actualParameters = Object.assign({}, params);
	delete actualParameters.action;
	delete actualParameters.broker;
	delete actualParameters.namespace;
	delete actualParameters.onDone_trigger;

	    console.log('A');
	var opts = {
	    url: params.broker + '/invoke/begin',
	    method: 'POST',
	    headers: {
		'Accept': 'application/json'
	    },
	    json: true,
	    body: {
		key: whisk.getAuthKey(),
		action: params.action,
		namespace: params.namespace,
		onDone_trigger: params.onDone_trigger,
		actualParameters: actualParameters
	    }
	};

	console.log('with options', opts);
	
	request(opts, function(err, response, body) {
	    if (err || response.statusCode != 200) {
		if (err) console.log('OOPS1 ' + JSON.stringify(err));
		else console.log('OOPS1b ' + JSON.stringify(response) + ' ' + JSON.stringify(body));
		reject(body);
	    } else {
		console.log('YUMMO ' + JSON.stringify(body));
		var activationId = body.activationId;

		console.log('Ok, so far so good with activationId ' + activationId);
		if (params.onDone_trigger) {
		    resolve({ status: "ok" });
		} else {
		    var timer = setInterval(function() {
			request({
			    url: actualParameters.broker + '/invoke/status/' + activationId,
			    method: 'GET',
			    headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'AuthKey': whisk.getAuthKey()
			    },
			}, function(err, response, body) {
			    if (err || response.statusCode != 200) {
				if (err) console.log('OOPS2 ' + JSON.stringify(err));
				else console.log('OOPS2b ' + JSON.stringify(response));
				reject(body);
			    } else {
				try {
				    // body = JSON.parse(body);
				    //console.log("Result? " + body.result + " " + body);
				    if (body.result !== undefined) {
					clearInterval(timer);
					resolve(body.result);
				    }
				} catch (e) {
				    console.log("Could not parse result");
				    reject(body);
				}
			    }
			}); 
		    }, 1000);
		}
	    }
	});
	} catch (e) { console.error(e.stack); reject(e); }
    });
}
//main({'broker':'https://owdbg.mybluemix.net','action':'foo/bar15'})
