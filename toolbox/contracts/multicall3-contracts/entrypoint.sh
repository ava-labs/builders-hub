#!/bin/bash

set -eu -o pipefail

# download source code if not already present
if [ ! -d "/multicall3_source" ]; then
    git clone https://github.com/mds1/multicall3 /multicall3_source
    cd /multicall3_source
    git submodule update --init --recursive
fi

cd /multicall3_source
git config --global --add safe.directory /multicall3_source
git checkout $ICM_COMMIT

# Install Foundry if not already installed
if [ ! -f "/root/.foundry/bin/forge" ]; then
    echo "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    # Temporarily disable unbound variable check for sourcing bashrc
    set +u
    source /root/.bashrc || true
    set -u
    /root/.foundry/bin/foundryup
fi

# Add foundry to PATH
export PATH="/root/.foundry/bin/:${PATH}"

# Build contracts
cd /multicall3_source && forge build

# ls -la /teleporter_src/out

# cd /teleporter_src/lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/transparent && forge build
# Extract and format JSON files
for file in \
    /multicall3_source/out/Multicall3.sol/Multicall3.json \
; do
    filename=$(basename "$file")
    jq '.' "$file" > "/compiled/$filename"
done

ls -ltha /multicall3_source/out/

# Debug: Find all JSON files in the out directory
echo "Looking for JSON files in out directory:"
find /multicall3_source/out -name "*.json" -type f

chown -R $HOST_UID:$HOST_GID /compiled /multicall3_source
echo "Compilation complete"
