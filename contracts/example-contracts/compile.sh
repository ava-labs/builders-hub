#!/bin/bash
set -exu -o pipefail

SCRIPT_DIR=$(dirname "$0")
# Convert to absolute path
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)

sudo rm -rf $SCRIPT_DIR/compiled
mkdir -p "$SCRIPT_DIR/compiled"

# Initialize Foundry project and compile contracts
docker run --rm \
    --user root \
    -v "$SCRIPT_DIR/contracts:/app/contracts" \
    -v "$SCRIPT_DIR/compiled:/compiled" \
    ghcr.io/foundry-rs/foundry:stable \
    "cd /app && forge build && cp /app/out/*.sol/*.json /compiled/" 
