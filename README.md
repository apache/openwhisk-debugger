# OpenWhisk Debugger

This project currently supports debugging NodeJS actions on your laptop.

## Usage

Start the debug client:
```
% (cd client; ./wskdb)
Welcome to the OpenWhisk Debugger

(wskdb)
```

You will now be in the `wsdk` REPL. Issue `help` to see the list of available commands. 

## Invoking an action
The syntax here is almost identical to that of the `wsk` CLI.
```
(wskdb) invoke actionName -p param1 value1 -p param2 value2
```

If you haven't yet attached to the action you are invoking, the invocation will proceed as if you weren't in the debugger, and had issued a blocking invocation from the CLI.

## Attaching to an action

Say for example you wish to attach to an action `foo`, and this action occurs in a sequence `seq`.

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
