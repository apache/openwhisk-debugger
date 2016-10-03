# OpenWhisk Debugger

This project currently supports debugging NodeJS actions on your laptop.

## Usage

Start the debug client:
```
% (cd client; ./wskdb)
Welcome to the OpenWhisk Debugger

? (wskdb)
```

You will now be in a REPL. Issue `help` to see the list of available commands. 

# Invoking an action
The syntax here is almost identical to that of the `wsk` CLI.
```
? (wskdb) invoke actionName -p param1 value1 -p param2 value2
```

If you haven't yet attached to the action you are invoking, the invocation will proceed as if you weren't in the debugger, and had issued a blocking invocation from the CLI.

# Attaching to an action
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
