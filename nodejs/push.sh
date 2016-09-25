#!/bin/bash

cf push owdbg-broker --no-start
#cf bind-service owdbg OWDBG
cf start owdbg-broker
