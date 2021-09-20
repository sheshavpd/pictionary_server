#!/usr/bin/env bash

# run forever with a config file
PORT=8001 forever start server_instance.js
PORT=8002 forever start server_instance.js
PORT=8003 forever start server_instance.js
forever start publicRoomCheckerService.js

#forever stopall
#forever restartall
