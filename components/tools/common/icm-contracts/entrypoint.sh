#!/bin/bash

set -eu -o pipefail

# download source code if not already present
if [ ! -d "/teleporter_src/contracts" ]; then
    git clone https://github.com/ava-labs/icm-contracts /teleporter_src 
    cd /teleporter_src && git submodule update --init --recursive
fi

# Add foundry to PATH
export PATH="/root/.foundry/bin/:${PATH}"

# Install foundry if not already installed
if ! command -v forge &> /dev/null; then
    cd /teleporter_src && ./scripts/install_foundry.sh
fi

# Build contracts
cd /teleporter_src/contracts && forge build

cd /teleporter_src/lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/transparent && forge build
# Extract and format JSON files
for file in /teleporter_src/out/PoAValidatorManager.sol/PoAValidatorManager.json \
            /teleporter_src/out/ValidatorMessages.sol/ValidatorMessages.json \
            /teleporter_src/out/NativeTokenStakingManager.sol/NativeTokenStakingManager.json ; do
    filename=$(basename "$file")
    jq '.' "$file" > "/compiled/$filename"
done

chown -R $HOST_UID:$HOST_GID /compiled /teleporter_src
echo "Compilation complete"
