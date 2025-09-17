#!/bin/bash
set -exu -o pipefail

SCRIPT_DIR=$(dirname "$0")
# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)


docker build -t openzeppelin-contracts-4.9 "$SCRIPT_DIR"
docker run -it --rm \
    -v "${SCRIPT_DIR}/compiled":/compiled \
    -v "${SCRIPT_DIR}/openzeppelin_src":/openzeppelin_src \
    -e HOST_UID=$(id -u) \
    -e HOST_GID=$(id -g) \
    openzeppelin-contracts-4.9

ls -la "${SCRIPT_DIR}/compiled"
