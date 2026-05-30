#!/bin/bash

set -eu -o pipefail

# download source code if not already present
if [ ! -d "/teleporter_src/.git" ]; then
    git clone https://github.com/ava-labs/icm-services /teleporter_src
    cd /teleporter_src && git submodule update --init --recursive
fi

cd /teleporter_src
git config --global --add safe.directory /teleporter_src
# Ensure remote points to icm-services (may be cached from old icm-contracts clone)
git remote set-url origin https://github.com/ava-labs/icm-services
git fetch origin
git checkout $ICM_COMMIT
git submodule update --init --recursive

# Add foundry to PATH
export PATH="/root/.foundry/bin/:${PATH}"

# Install foundry if not already installed
if ! command -v forge &> /dev/null; then
    cd /teleporter_src && ./scripts/install_foundry.sh
fi

# Build contracts (at pinned commit, contracts are under contracts/)
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
