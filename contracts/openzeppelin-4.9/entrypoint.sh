#!/bin/bash
set -eu -o pipefail

rm -rf /compiled/*


cp -r /openzeppelin-contracts/out/ProxyAdmin.sol/*.json /compiled/
cp -r /openzeppelin-contracts/out/TransparentUpgradeableProxy.sol/*.json /compiled

chown -R $HOST_UID:$HOST_GID /compiled
