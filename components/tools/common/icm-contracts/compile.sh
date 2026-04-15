#!/bin/bash
set -exu -o pipefail

SCRIPT_DIR=$(dirname "$0")
# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)

VERSIONS_PATH=$(cd "$SCRIPT_DIR/../../../../scripts" && pwd)/versions.json
ICM_COMMIT=$(jq -r '."ava-labs/icm-services" // empty' "$VERSIONS_PATH")
if [ -z "$ICM_COMMIT" ] || [ "$ICM_COMMIT" = "null" ]; then
    echo "ERROR: Missing 'ava-labs/icm-services' commit in versions.json" >&2
    exit 1
fi
SUBNET_EVM_VERSION="v0.7.0"

# Get current user and group IDs
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

docker build -t validator-manager-compiler --build-arg SUBNET_EVM_VERSION=$SUBNET_EVM_VERSION --build-arg ICM_COMMIT=$ICM_COMMIT "$SCRIPT_DIR"
docker run -it --rm \
    -v "${SCRIPT_DIR}/compiled":/compiled \
    -v "${SCRIPT_DIR}/teleporter_src":/teleporter_src \
    -e ICM_COMMIT=$ICM_COMMIT \
    -e HOST_UID=$CURRENT_UID \
    -e HOST_GID=$CURRENT_GID \
    validator-manager-compiler
