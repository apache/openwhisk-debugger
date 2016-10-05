var uuid = require('uuid');

import {test as it} from 'ava'
const spawn = require('child_process').spawn

it('should create and delete an action and quit without error', t => {
    return new Promise((resolve,reject) => {
	var child = spawn('node', ['wskdb.js'], { cwd: '../..' })
	var name = uuid.v4();
	child.stdin.write('create ' + name + ' nodejs function main(params) { return { message: "Hello " + params.name } }\n')
	child.stdin.write('delete ' + name + '\n');
	child.stdin.write('q\n');

	child.stderr.on('data', (data) => {
	    console.error('stderr: ' + data)
	})

	var goody = false;
	child.stdout.on('data', (data) => {
	    // console.log('stdout: ' + data);
	    if (data.indexOf('Error') >= 0) {
		goody = false

	    } else if (data.indexOf('ok') >= 0) {
		child.stdin.write('q\n')
		goody = true
	    }
	});
	child.on('exit', (code) => {
	    if (code == 0 && goody) resolve()
	    else reject('code=${code} goody=${goody}')
	});
    }).then(result => t.is(result))
});
