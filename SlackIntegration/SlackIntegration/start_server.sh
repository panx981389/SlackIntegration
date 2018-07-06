#!/bin/bash

forever app.js 2>&1 |tee -a /tmp/slack.log &
