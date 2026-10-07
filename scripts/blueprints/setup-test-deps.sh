#!/usr/bin/env bash
# Fetches the Solidity dependencies the blueprint Foundry suite compiles against into .blueprint-deps/,
# at the versions pinned in blueprints/_shared/compiler.json, and checks every download.
#
# npm tarballs are fetched without their npm dependency trees on purpose: only the Solidity sources are
# needed, and @chainlink/contracts-ccip pulls a large JavaScript tree otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPS="$ROOT/.blueprint-deps"

OZ_VERSION="5.3.0"
OZ_SHA256="18ecbb212e36fa4de9fbf85caed66467bbe7e4cd770d70e674647e4f406c9977"
CCIP_VERSION="2.0.0"
CCIP_SHA256="59c3ea7be405d68cadd948ac1c8ee5e0b7df4d1cdcde709bf1515e009d5dd759"
FORGE_STD_COMMIT="6764d4a42fcdff8e9f6999ab94fb74c1752a0445"

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

fetch_npm() {
  local name="$1" version="$2" expected="$3"
  local dest="$DEPS/$name"
  if [ -f "$dest/.version" ] && [ "$(cat "$dest/.version")" = "$version" ]; then
    return 0
  fi
  local tarball
  tarball="$(mktemp)"
  curl -fsSL "https://registry.npmjs.org/$name/-/$(basename "$name")-$version.tgz" -o "$tarball"
  local actual
  actual="$(sha256 "$tarball")"
  if [ "$actual" != "$expected" ]; then
    echo "Checksum mismatch for $name@$version: expected $expected, got $actual" >&2
    rm -f "$tarball"
    exit 1
  fi
  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$tarball" -C "$dest" --strip-components=1
  rm -f "$tarball"
  echo "$version" >"$dest/.version"
  echo "fetched $name@$version"
}

fetch_forge_std() {
  local dest="$DEPS/forge-std"
  if [ -f "$dest/.commit" ] && [ "$(cat "$dest/.commit")" = "$FORGE_STD_COMMIT" ]; then
    return 0
  fi
  rm -rf "$dest"
  git init --quiet "$dest"
  git -C "$dest" fetch --quiet --depth 1 https://github.com/foundry-rs/forge-std "$FORGE_STD_COMMIT"
  git -C "$dest" checkout --quiet FETCH_HEAD
  echo "$FORGE_STD_COMMIT" >"$dest/.commit"
  echo "fetched forge-std@${FORGE_STD_COMMIT:0:7}"
}

mkdir -p "$DEPS"
fetch_npm "@openzeppelin/contracts" "$OZ_VERSION" "$OZ_SHA256"
fetch_npm "@chainlink/contracts-ccip" "$CCIP_VERSION" "$CCIP_SHA256"
fetch_forge_std
echo "Blueprint test dependencies are ready in $DEPS"
