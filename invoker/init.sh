#!/bin/bash

wsk package create owdbg -p broker "https://owdbg.mybluemix.net" -p action ""
wsk action create owdbg/invoker owdbg-invoker.js
