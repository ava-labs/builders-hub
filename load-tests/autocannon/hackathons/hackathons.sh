#!/bin/bash

echo "Running Autocannon Ramp-Up Test..."

# Stage 1
npx autocannon -c 50 -d 60 -p 10 --json https://build.avax.network/hackathons > autocannon-50c.json

# Stage 2
npx autocannon -c 100 -d 120 -p 10 --json https://build.avax.network/hackathons > autocannon-100c.json

# Stage 3
npx autocannon -c 150 -d 120 -p 10 --json https://build.avax.network/hackathons > autocannon-150c.json

# Stage 4
npx autocannon -c 200 -d 180 -p 10 --json https://build.avax.network/hackathons > autocannon-200c.json

# Stage 5
npx autocannon -c 300 -d 300 -p 10 --json https://build.avax.network/hackathons > autocannon-300c.json

echo "Ramp-up test completed. JSON results saved."
