var WebSocket = require('ws');

var host = "https://owdbg.mybluemix.net";
var path = "/register";

var uri = host + path;
console.log(uri);
var ws = new WebSocket(uri);
var key = require('properties-parser').parse("~/.wskprops")["AUTH"];
 
ws.on('open', function open() {
    console.log("CONNECTION OPEN");
    ws.send(JSON.stringify({ action: "init", key: key }));
});
 
ws.on('message', function(data, flags) {
    //
    // flags.binary will be set if a binary data is received. 
    // flags.masked will be set if the data was masked.
    //
    console.log(data);
});
 
/*
sending binary data 
ws.on('open', function open() {
  var array = new Float32Array(5);
 
  for (var i = 0; i < array.length; ++i) {
    array[i] = i / 2;
  }
 
  ws.send(array, { binary: true, mask: true });
});
*/
