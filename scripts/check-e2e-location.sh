#!/usr/bin/env bash
#
# E2E Location Checker
# Browser and API tests live in tests/e2e and run with tester-army/e2e (AGENTS.md, "Tests").
# PR #4643 removed the old Playwright harness: the root e2e/ folder and the Playwright test runner package.
# A test added there runs nowhere, and the root tsconfig type-checks it without the package, so the site build
# fails. This check fails when the old harness comes back:
#   - a root e2e/ folder
#   - a code file that imports the Playwright test runner (with or without the @ scope), or a package.json that
#     depends on it
# Used by: CI (.github/workflows/e2e.yml, job "E2E test location"). It needs no secrets, so it runs on fork PRs.
#
# Usage:
#   ./scripts/check-e2e-location.sh
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

errors=0

if [ -e e2e ]; then
  echo "ERROR: the root e2e/ folder is back. Put browser and API tests in tests/e2e (see tests/e2e/README.md)." >&2
  find e2e -type f | sort | sed 's/^/  /' >&2
  errors=$((errors + 1))
fi

# The runner's name in quotes, with or without a subpath: an import, a require, a dynamic import, or a dependency
# in package.json. The scoped package only loads playwright/test, so both names count. The pathspecs below do not
# include this script. Tracked and untracked files are searched. Git-ignored files (node_modules) are not.
runner='@?playwright/test'
set +e
matches=$(git grep -n --untracked -E "[\"']${runner}(/[^\"']*)?[\"']" -- \
  '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.jsx' '*.mjs' '*.cjs' '*package.json')
status=$?
set -e
if [ "$status" -eq 0 ]; then
  echo "ERROR: these files use the Playwright test runner. Write the test with tester-army/e2e in tests/e2e." >&2
  echo "$matches" | sed 's/^/  /' >&2
  errors=$((errors + 1))
elif [ "$status" -ne 1 ]; then
  echo "ERROR: git grep failed with status $status." >&2
  exit 2
fi

if [ "$errors" -gt 0 ]; then
  exit 1
fi
echo "E2E location check passed: no root e2e/ folder, and no file uses the Playwright test runner."
