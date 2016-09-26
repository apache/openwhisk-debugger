var request = require('request');

function main(params) {
    return new Promise(function(resolve, reject) {
	console.log('Invoking ' + JSON.stringify(actualParameters));

	var actualParameters = Object.assign({}, params);
	delete actualParameters.action;
	delete actualParameters.namespace;
	delete actualParameters.onDone_trigger;
	
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

	console.log('with options ' + JSON.stringify(opts));
	
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
					resolve(body);
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
    });
}
main({'broker':'https://owdbg.mybluemix.net','action':'foo/bar15'})
