import {test as it} from 'ava'
var spawn = require('child_process').spawn

it('should launch and quit without error', t => {
    return new Promise((resolve,reject) => {
	var child = spawn('node', ['wskdb.js'], { cwd: '..' })
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
