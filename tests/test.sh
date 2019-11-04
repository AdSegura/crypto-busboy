#!/bin/bash

i=0
end=100
while [ $i -lt $end ]
do
  NODE_ENV=test node_modules/.bin/_mocha -b --exit --big_file_size 10mb tests/
  if [ $? -ne 0 ]; then
    break;
  fi
  ((++i));
done

echo "$i must be $end"


