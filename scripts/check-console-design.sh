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
      errors=$((errors + 1))
      echo "error: $line"
      echo "       Use zinc-* instead of slate-* for console components"
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
      # Skip in-page fragment anchors (href="#...")
      if echo "$line" | grep -q 'href="#'; then
        continue
      fi
      errors=$((errors + 1))
      echo "error: $line"
      echo "       Use next/link <Link> for internal navigation, <a target=\"_blank\"> for external"
    done < <(grep -Hn '<a href=' "$f" 2>/dev/null || true)
  done
}

# ── Double Notification Prevention ───────────────────────────────
# useContractActions.write() already calls notify(). Components must
# not wrap hook results with an additional notify() call.
# Legitimate notify() calls (not duplicates):
#   - type: 'local' (SDK/aggregation calls, not contract hooks)
#   - ERC20 approve (useERC20Token, not useContractActions)
check_double_notify() {
  local hook_pattern="useNativeTokenStakingManager\|useERC20TokenStakingManager\|useValidatorManager\|usePoAManager\|useTokenRemote\|useTokenHome"
  for f in "${files[@]}"; do
    # Only check console component files
    if [[ "$f" != *"/console/"* ]]; then
      continue
    fi
    # File must import a contract hook AND have notify() calls
    if ! grep -q "$hook_pattern" "$f" 2>/dev/null; then
      continue
    fi
    # Get line numbers of all notify( calls (excluding imports/comments)
    while IFS= read -r match; do
      local linenum="${match%%:*}"
      # Read the notify() call and the next 3 lines to check the type field
      local context
      context=$(sed -n "${linenum},$((linenum + 3))p" "$f" 2>/dev/null || true)
      # Skip type: 'local' — these are SDK/aggregation calls, not contract hooks
      if echo "$context" | grep -q "type:.*'local'\|type:.*\"local\""; then
        continue
      fi
      # Skip approve-related notifications
      if echo "$context" | grep -qi "approve"; then
        continue
      fi
      # Check if this is a raw walletClient.writeContract call (should use hooks instead)
      local nearby
      nearby=$(sed -n "$((linenum > 10 ? linenum - 10 : 1)),${linenum}p" "$f" 2>/dev/null || true)
      if echo "$nearby" | grep -q "walletClient.*writeContract\|walletClient!.*writeContract"; then
        errors=$((errors + 1))
        echo "error: $f:$linenum: raw walletClient.writeContract() — use contract hooks instead"
        echo "       Contract hooks (useValidatorManager, usePoAManager, etc.) centralize error handling and notifications."
        continue
      fi
      errors=$((errors + 1))
      echo "error: $f:$linenum: notify() may duplicate useContractActions notification"
      echo "       Contract hooks already call notify() internally. Use type: 'local' for non-hook calls."
    done < <(grep -n "notify(" "$f" 2>/dev/null | grep -v "useConsoleNotifications\|import\|//" || true)
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
