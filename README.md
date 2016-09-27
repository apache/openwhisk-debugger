### OpenWhisk Debugger

This project currently supports debugging NodeJS actions on your laptop.

# Usage

First, start a debug client:
```
wskdb
```

Then, every time you want to debug an action, invoke it via the wrapper script:

```
% wskinvoke.sh myaction -p param1Name param1Value -p param2Name param2Value
```

i.e. invoke an action as you would normally, except making sure to use the invoke wrapper script provided in this repo.
