# OpenWhisk Debugger

This project currently supports debugging NodeJS actions on your laptop. For now, you must have [NodeJS](https://nodejs.org) installed on your computer in order to use the debugger.

## Usage

Start the debug client:
```
% cd client
% npm install  <-- you need do this only once
% ./wskdb
Welcome to the OpenWhisk Debugger

(wskdb)
```

You will now be in the `wsdk` REPL. Issue `help` to see the list of available commands. 

Note: the first time you launch this, you will experience a small delay, as the debugger pulls in the NodeJS package dependencies supported by OpenWhisk. This will allow you to debug actions that require one or more of the NodeJS [packages supported by OpenWhisk](https://dev-console.stage1.ng.bluemix.net/docs/openwhisk/openwhisk_reference.html#openwhisk_ref_javascript).


## Invoking an action
The syntax here is almost identical to that of the `wsk` CLI.
```
(wskdb) invoke actionName -p param1 value1 -p param2 value2
```

If you haven't yet attached to the action you are invoking, the invocation will proceed as if you weren't in the debugger, and had issued a blocking invocation from the CLI.

## Attaching to an action

You can attach to an attach on startup by passing the action name to the initial invocation. Say for example you wish to attach to an action `foo`, and this action occurs in a sequence `seq`:

```
% ./wskdb foo
Attaching to foo
   Creating action trampoline
   Creating sequence splice seq
```

You may also choose to launch the debugger and attach to `foo` later:

```
(wskdb) attach foo
Attaching to foo
   Creating action trampoline
   Creating sequence splice seq
```

If you wish to limit the instrumentation to the action, avoiding any containing rules or sequences:

```
(wskdb) attach foo --action-only
Attaching to foo
   Creating action trampoline
```

The short-hand for this is `-a`. 

### Getting Help

To learn more about the options for each command, you can issue a `-h` request, e.g.
```
(wskdb) attach -h
Usage: attach [options]

	--help, -h
		Displays help information about this script

	--action-only, -a
		Instrument just the action, not any rules or sequences in which it takes part
```

## Choosing CLI versus Browser-based Debugging

By default, `wskdb` will prefer to use a browser-based debugger. If instead you wish to use a command-line debugger, pass the `--use-cli-debugger` option to `wskdb`; the short-hand form of this option is `-c`:

```
./wskdb -c
Welcome to the OpenWhisk Debugger
    + Favor the CLI for debug sessions over a GUI
```

### License

Copyright 2015-2016 IBM Corporation

Licensed under the [Apache License, Version 2.0 (the "License")](http://www.apache.org/licenses/LICENSE-2.0.html).

Unless required by applicable law or agreed to in writing, software distributed under the license is distributed on an "as is" basis, without warranties or conditions of any kind, either express or implied. See the license for the specific language governing permissions and limitations under the license.

### Issues

Report bugs, ask questions and request features [here on GitHub](../../issues).
