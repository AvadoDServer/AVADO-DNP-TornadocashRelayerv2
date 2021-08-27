#!/bin/sh
while :
do
    redis-cli FLUSHALL
    echo "current folder is"
    pwd
    yarn start 
    echo "waiting..."
    sleep 10
done
