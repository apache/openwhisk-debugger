#!/usr/bin/env bash

NAMESPACE="`grep NAMESPACE ~/.wskprops | awk -F = '{print $2}'`"

TRIGGER="`uuidgen`"
ACTION="`uuidgen`"
RULE="`uuidgen`"

function allDone() {
    (wsk trigger delete ${TRIGGER} >& /dev/null) &
    (wsk action delete ${ACTION} >& /dev/null) &
    wsk rule delete ${RULE} >& /dev/null
    wait

    echo
    echo "Debug session complete"
    
    exit
}

trap allDone INT

wsk trigger create ${TRIGGER} >& /dev/null
wsk action create ${ACTION} lib/echo.js >& /dev/null
wsk rule create ${RULE} ${TRIGGER} ${ACTION} >& /dev/null

wait

wsk action invoke owdbg/invoker -p namespace "${NAMESPACE}" -p onDone_trigger ${TRIGGER} -p action $@

echo -n "Your debugging session should now be active."

while true; do
    sleep 2

    activationId=`wsk activation list | grep ${ACTION} | awk '{print $1}'`

    if [ -n "$activationId" ]; then
	wsk activation get $activationId
	allDone
	break
    fi

    echo -n "."
done
