#!/bin/bash

echo "Running Autocannon Ramp-Up Test..."

# Etapa 1
npx autocannon -c 50 -d 60 -p 10 --json https://tu-app.vercel.app/hackathons > autocannon-50c.json

# Etapa 2
npx autocannon -c 100 -d 120 -p 10 --json https://tu-app.vercel.app/hackathons > autocannon-100c.json

# Etapa 3
npx autocannon -c 150 -d 120 -p 10 --json https://tu-app.vercel.app/hackathons > autocannon-150c.json

# Etapa 4
npx autocannon -c 200 -d 180 -p 10 --json https://tu-app.vercel.app/hackathons > autocannon-200c.json

# Etapa 5
npx autocannon -c 300 -d 300 -p 10 --json https://tu-app.vercel.app/hackathons > autocannon-300c.json

echo "Ramp-up test completed. JSON results saved."
