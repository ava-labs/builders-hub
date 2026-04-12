#!/usr/bin/env bash
#
# Console Design System Checker
# Enforces Tailwind/styling conventions across console components.
# Used by: lint-staged (pre-commit) and CI.
#
# Usage:
#   ./scripts/check-console-design.sh [files...]
#   If no files given, checks all of components/toolbox/console/
#
set -euo pipefail

errors=0
warnings=0

# If specific files passed (lint-staged mode), filter to only .tsx/.ts
if [ $# -gt 0 ]; then
  files=()
  for f in "$@"; do
    if [[ "$f" == *.tsx || "$f" == *.ts ]]; then
      files+=("$f")
    fi
  done
  if [ ${#files[@]} -eq 0 ]; then
    exit 0
  fi
else
  # Full scan mode (CI) — compatible with bash 3.2+ (no mapfile)
  files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(find components/toolbox/console -name '*.tsx' -o -name '*.ts' | sort)
fi

# ── Banned Tailwind Classes ──────────────────────────────────────
# gray-* is banned in console — use zinc-* for the neutral palette
check_banned_classes() {
  local pattern="(text|bg|border|ring|divide|placeholder)-gray-"
  for f in "${files[@]}"; do
    while IFS= read -r line; do
      errors=$((errors + 1))
      echo "error: $line"
      echo "       Use zinc-* instead of gray-* for console components"
    done < <(grep -Hn "$pattern" "$f" 2>/dev/null || true)
  done
}

# ── Banned Color Tokens ──────────────────────────────────────────
# Catch other off-palette colors that should be zinc
check_off_palette() {
  local pattern="(text|bg|border)-slate-"
  for f in "${files[@]}"; do
    while IFS= read -r line; do
      warnings=$((warnings + 1))
      echo "warn:  $line"
      echo "       Prefer zinc-* over slate-* for consistency"
    done < <(grep -Hn "$pattern" "$f" 2>/dev/null || true)
  done
}

# ── Nested <a> Prevention ────────────────────────────────────────
# Raw <a href= without target="_blank" is likely a bug — should use <Link>
check_raw_anchors() {
  for f in "${files[@]}"; do
    while IFS= read -r line; do
      # Skip external links (they need <a target="_blank">)
      if echo "$line" | grep -q 'target='; then
        continue
      fi
      warnings=$((warnings + 1))
      echo "warn:  $line"
      echo "       Use next/link <Link> for internal navigation, <a target=\"_blank\"> for external"
    done < <(grep -Hn '<a href=' "$f" 2>/dev/null || true)
  done
}

# ── Double Notification Prevention ───────────────────────────────
# useContractActions.write() already calls notify(). Components must
# not wrap hook results with an additional notify() call.
check_double_notify() {
  for f in "${files[@]}"; do
    # Only check console component files (not hooks/stores)
    if [[ "$f" != *"/console/"* ]]; then
      continue
    fi
    # Look for files that both import a staking/contract hook AND call notify()
    # on what appears to be a hook result (the promise variable pattern)
    local has_contract_hook=false
    local has_notify=false
    if grep -q "useNativeTokenStakingManager\|useERC20TokenStakingManager\|useValidatorManager\|usePoAManager\|useTokenRemote\|useTokenHome" "$f" 2>/dev/null; then
      has_contract_hook=true
    fi
    if grep -q "notify(" "$f" 2>/dev/null; then
      has_notify=true
    fi
    if $has_contract_hook && $has_notify; then
      # Check for the specific pattern: notify({...}, somePromise, ...)
      # where somePromise is assigned from a hook method call
      while IFS= read -r line; do
        # Skip approve calls (erc20Token.approve uses a different path)
        if echo "$line" | grep -qi "approve"; then
          continue
        fi
        # Skip aggregate/local notifications (not from useContractActions)
        if echo "$line" | grep -q "type: 'local'"; then
          continue
        fi
        warnings=$((warnings + 1))
        echo "warn:  $line"
        echo "       Contract hooks already call notify() via useContractActions — this may be a duplicate"
      done < <(grep -Hn "notify(" "$f" 2>/dev/null | grep -v "useConsoleNotifications\|import\|//" || true)
    fi
  done
}

echo "Console Design System Check"
echo "════════════════════════════"

check_banned_classes
check_off_palette
check_raw_anchors
check_double_notify

echo ""
if [ $errors -gt 0 ]; then
  echo "✗ $errors error(s), $warnings warning(s)"
  exit 1
elif [ $warnings -gt 0 ]; then
  echo "⚠ $warnings warning(s) (non-blocking)"
  exit 0
else
  echo "✓ All checks passed"
  exit 0
fi
