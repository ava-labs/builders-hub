#!/bin/bash

set -eu

# download source code if not already present
if [ ! -d "/create2_source/.git" ]; then
    rm -rf /create2_source/*
    git clone https://github.com/pcaversaccio/create2deployer /tmp/create2_temp
    mv /tmp/create2_temp/* /create2_source/
    mv /tmp/create2_temp/.git /create2_source/
    rm -rf /tmp/create2_temp
    cd /create2_source
    git submodule update --init --recursive
fi

cd /create2_source
git config --global --add safe.directory /create2_source
git checkout $CREATE2_COMMIT

# Install Node.js and pnpm if not already installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies and build contracts
cd /create2_source
pnpm install
# Disable telemetry prompts by setting environment variable
export HARDHAT_TELEMETRY_DISABLED=true
echo "n" | pnpm run compile

# ls -la /teleporter_src/out

# Ensure compiled directory exists
mkdir -p /compiled

# Copy the Create2Deployer.json file directly
echo "Copying Create2Deployer.json to compiled directory..."
cp /create2_source/artifacts/contracts/Create2Deployer.sol/Create2Deployer.json /compiled/
echo "File copied successfully"

echo "Contents of /compiled directory:"
ls -la /compiled/

echo "Changing ownership of compiled directory..."
chown -R $HOST_UID:$HOST_GID /compiled
echo "Ownership changed successfully"

echo "Compilation complete"
