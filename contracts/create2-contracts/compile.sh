#!/bin/bash
set -exu -o pipefail

SCRIPT_DIR=$(dirname "$0")
# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)

CREATE2_COMMIT="main"

# Get current user and group IDs
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

rm -rf "$SCRIPT_DIR/compiled"

docker build -t create2-compiler --build-arg CREATE2_COMMIT=$CREATE2_COMMIT "$SCRIPT_DIR"
docker run -it --rm \
    -v "${SCRIPT_DIR}/compiled":/compiled \
    -v "${SCRIPT_DIR}/create2_source":/create2_source \
    -e CREATE2_COMMIT=$CREATE2_COMMIT \
    -e HOST_UID=$CURRENT_UID \
    -e HOST_GID=$CURRENT_GID \
    create2-compiler 