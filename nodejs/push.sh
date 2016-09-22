#!/bin/bash

cf push owdbg --no-start
cf bind-service owdbg OWDBG
cf start owdbg
