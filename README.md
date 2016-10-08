# OpenWhisk Debugger

This project currently supports debugging OpenWhisk actions written in NodeJS and Swift. The debugger will arrange things so that the actions you wish to debug will be offloaded from the main OpenWhisk servers and instead run on your laptop. You can then, from within the debugger, inspect and modify values, and even modify code. At this point in time, the modifications will be one-time only. In the near future, we hope to add the ability to push any code updates back to OpenWhisk.

The debugger currently supports inspecting individual actions and actions within sequences. In the near future, we hope to add the ability to debug actions run from rules as well.

For now, you must have [NodeJS](https://nodejs.org) installed on your computer in order to use the debugger.

## Usage

Start the debug client:
```
% cd client
% ./wskdb
Welcome to the OpenWhisk Debugger

(wskdb)
```

You will now be in the `wsdk` REPL. Issue `help` to see the list of available commands. 

Note: the first time you launch `wskdb`, you will experience a 60-90 second delay, as the debugger finishes up the installation. This includes pulling in the package dependencies supported by OpenWhisk. These dependencies will allow you to debug actions that require one or more of the NodeJS [packages supported by OpenWhisk](https://dev-console.stage1.ng.bluemix.net/docs/openwhisk/openwhisk_reference.html#openwhisk_ref_javascript).

## Prerequisites

If you wish to debug NodeJS actions, you must currently have a version of NodeJS installed on your local machine that is compatible with the actions you wish to debug. Also note that `wskdb` currently does not attempt to employ `nvm` in order to leverage a runtime that matches the action being debugged.

If you wish to debug Swift actions, you must have `swiftc` and `lldb` installed. On MacOS, for example, you can acquire these by installing [XCode](https://itunes.apple.com/us/app/xcode/id497799835?mt=12).

## Invoking an action
The syntax here is almost identical to that of the `wsk` CLI.
```
(wskdb) invoke actionName -p param1 value1 -p param2 value2
```

If you haven't yet attached to the action you are invoking, the invocation will proceed as if you weren't in the debugger, and had issued a blocking invocation from the CLI.

## Attaching to an action

You can attach to an attach on startup by passing the action name to the initial invocation. Say for example you wish to attach to an action `foo`:

```
% ./wskdb foo
Attaching to foo
   Creating action trampoline
```

You may also choose to launch the debugger and attach to `foo` later:

```
(wskdb) attach foo
Attaching to foo
   Creating action trampoline
```

If you wish to extend the instrumentation to include any containing rules or sequences (in this case, the action occurs in a sequence `seq`):

```
(wskdb) attach foo --all
Attaching to foo
   Creating action trampoline
   Creating sequence splice seq
```

The short-hand for this is `-a`. 

### Getting Help

To learn more about the options for each command, you can issue a `-h` request, e.g.
```
(wskdb) attach -h
Usage: attach [options]

	--help, -h
		Displays help information about this script

	--all, -a
		Instrument the action, plus any rules or sequences in which it takes part
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
