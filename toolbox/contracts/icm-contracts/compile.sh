#!/bin/bash
set -exu -o pipefail

SCRIPT_DIR=$(dirname "$0")
# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)

# Require jq and versions.json to provide the commit
if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: 'jq' is required but was not found in PATH." >&2
    exit 1
fi

VERSIONS_PATH=$(cd "$SCRIPT_DIR/../../src" && pwd)/versions.json
if [ ! -f "$VERSIONS_PATH" ]; then
    echo "ERROR: versions.json not found at $VERSIONS_PATH" >&2
    exit 1
fi

ICM_COMMIT=$(jq -r '."ava-labs/icm-contracts" // empty' "$VERSIONS_PATH")
if [ -z "$ICM_COMMIT" ] || [ "$ICM_COMMIT" = "null" ]; then
    echo "ERROR: Missing 'ava-labs/icm-contracts' commit in versions.json" >&2
    exit 1
fi

# Get current user and group IDs
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

rm -rf "$SCRIPT_DIR/compiled"

docker build -t validator-manager-compiler --build-arg ICM_COMMIT=$ICM_COMMIT "$SCRIPT_DIR"
docker run -it --rm \
    -v "${SCRIPT_DIR}/compiled":/compiled \
    -v "${SCRIPT_DIR}/teleporter_src":/teleporter_src \
    -e ICM_COMMIT=$ICM_COMMIT \
    -e HOST_UID=$CURRENT_UID \
    -e HOST_GID=$CURRENT_GID \
    validator-manager-compiler
