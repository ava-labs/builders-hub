#!/bin/bash

set -eu -o pipefail

# downlaod source code if not already present
if [ ! -d "/teleporter_src/contracts" ]; then
    git clone https://github.com/ava-labs/icm-contracts /teleporter_src 
    cd /teleporter_src
    git submodule update --init --recursive
fi

cd /teleporter_src
git config --global --add safe.directory /teleporter_src
git checkout $ICM_COMMIT

# Add foundry to PATH
export PATH="/root/.foundry/bin/:${PATH}"

# Install foundry if not already installed
if ! command -v forge &> /dev/null; then
    cd /teleporter_src && ./scripts/install_foundry.sh
fi

# Build contracts
cd /teleporter_src/contracts && forge build

# ls -la /teleporter_src/out

# cd /teleporter_src/lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/transparent && forge build
# Extract and format JSON files
for file in \
    /teleporter_src/out/ValidatorManager.sol/ValidatorManager.json \
    /teleporter_src/out/ValidatorMessages.sol/ValidatorMessages.json \
    /teleporter_src/out/TeleporterRegistry.sol/TeleporterRegistry.json \
    /teleporter_src/out/NativeTokenStakingManager.sol/NativeTokenStakingManager.json \
    /teleporter_src/out/ExampleERC20.sol/ExampleERC20.json \
    /teleporter_src/out/ERC20TokenHome.sol/ERC20TokenHome.json \
    /teleporter_src/out/ERC20TokenRemote.sol/ERC20TokenRemote.json \
    /teleporter_src/out/ExampleRewardCalculator.sol/ExampleRewardCalculator.json \
<<<<<<< HEAD
=======
    /teleporter_src/out/NativeTokenRemote.sol/NativeTokenRemote.json \
    /teleporter_src/out/INativeMinter.sol/INativeMinter.json \
    /teleporter_src/out/validator-manager/NativeTokenStakingManager.sol/NativeTokenStakingManager.json \
    /teleporter_src/out/ictt/TokenRemote/NativeTokenRemoteUpgradeable.sol/NativeTokenRemoteUpgradeable.json \
    /teleporter_src/out/validator-manager/StakingManager.sol/StakingManager.json \
    /teleporter_src/out/validator-manager/ExampleRewardCalculator.sol/ExampleRewardCalculator.json \
    /teleporter_src/out/teleporter/TeleporterMessenger.sol/TeleporterMessenger.json \
    /teleporter_src/out/governance/ValidatorSetSig.sol/ValidatorSetSig.json \
>>>>>>> upstream/master
; do
    filename=$(basename "$file")
    jq '.' "$file" > "/compiled/$filename"
done

<<<<<<< HEAD
# Commented out files:
# /teleporter_src/out/ERC20TokenRemote.sol/ERC20TokenRemote.json
# /teleporter_src/out/NativeTokenRemote.sol/NativeTokenRemote.json
# /teleporter_src/out/NativeTokenHome.sol/NativeTokenHome.json
=======
ls -ltha /teleporter_src/out/
>>>>>>> upstream/master

chown -R $HOST_UID:$HOST_GID /compiled /teleporter_src
echo "Compilation complete"
