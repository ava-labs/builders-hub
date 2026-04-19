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

# Track whether we're in full-scan mode (no args) so per-check functions
# can decide their own scope instead of always reusing the console-only
# `files` array.
FULL_SCAN=0

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
  FULL_SCAN=1
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

# ── Direct viem Client Instantiation ─────────────────────────────
# createPublicClient should come from a shared hook so RPC resolution
# lives in one place:
#   - usePublicClientForChain(blockchainIdOrRpcUrl) → any chain by id or url
#                                                     (the default for reads)
#   - useChainPublicClient()                        → the wallet's current chain
#
# Inline createPublicClient() calls duplicate RPC resolution and silently
# fail when the user's l1ListStore is customized or a chain's RPC isn't
# obvious from its blockchainId. Template-string matches (snippets shown
# to users to copy) are detected and skipped — detection is multi-line
# backtick-aware, so even `code: \`const x = createPublicClient(…)\`` on
# its own line passes. The approved list below is for foundational
# primitives that own the pattern; there is no grandfather list.
check_direct_viem_client() {
  # Permanent approval — foundational primitives that own the pattern.
  local approved_core=(
    "components/toolbox/hooks/useChainPublicClient.ts"
    "components/toolbox/hooks/usePublicClientForChain.ts"
    "components/toolbox/stores/walletStore.ts"
    "components/toolbox/lib/chainId.ts"
    "components/toolbox/services/balanceService.ts"
  )

  # This rule cares about the whole toolbox, not just console — so it
  # builds its own file list. In full-scan mode do a fresh find over the
  # entire toolbox; in lint-staged mode filter the passed files (which
  # come from `$@` in the outer script and may include non-console toolbox
  # paths like hooks/ or components/).
  local scan=()
  if [ $FULL_SCAN -eq 1 ]; then
    while IFS= read -r f; do
      scan+=("$f")
    done < <(find components/toolbox \( -name '*.tsx' -o -name '*.ts' \) 2>/dev/null | sort)
  else
    for f in "${files[@]}"; do
      if [[ "$f" == *"components/toolbox/"* ]]; then
        scan+=("$f")
      fi
    done
  fi

  for f in "${scan[@]}"; do
    # Skip approved files
    local skip=0
    for a in "${approved_core[@]}"; do
      if [[ "$f" == *"$a" ]]; then
        skip=1
        break
      fi
    done
    [ $skip -eq 1 ] && continue

    # Use awk to track whether we're inside a template literal by
    # counting unescaped backticks. Only flag createPublicClient calls
    # that are NOT inside one — so `code: \`…\`` snippets used to render
    # sample code for users don't trigger false positives.
    local matches
    matches=$(awk '
      BEGIN { in_tmpl = 0 }
      {
        line = $0
        # Strip escaped backticks so they do not flip state
        gsub(/\\`/, "", line)
        # Match createPublicClient( and flag only if not inside template
        cpc = match(line, /createPublicClient\(/)
        if (cpc > 0) {
          before = substr(line, 1, cpc - 1)
          n_before = gsub(/`/, "`", before)
          at_pos = (in_tmpl + (n_before % 2)) % 2
          if (at_pos == 0) {
            printf "%s:%d:%s\n", FILENAME, NR, $0
          }
        }
        # Update state for next line based on all backticks on this line
        n_total = gsub(/`/, "`", line)
        if (n_total % 2 == 1) in_tmpl = 1 - in_tmpl
      }
    ' "$f" 2>/dev/null)

    if [ -n "$matches" ]; then
      while IFS= read -r m; do
        [ -z "$m" ] && continue
        errors=$((errors + 1))
        echo "error: $m"
        echo "       Use usePublicClientForChain(idOrRpcUrl) at component top level,"
        echo "       makePublicClientForChain(idOrRpcUrl, l1List) inside async handlers / loops,"
        echo "       or useChainPublicClient() for the wallet's current chain."
        echo "       If you genuinely need a bespoke client, add the path to the"
        echo "       approved list in scripts/check-console-design.sh with a reason."
      done <<< "$matches"
    fi
  done
}

echo "Console Design System Check"
echo "════════════════════════════"

check_banned_classes
check_off_palette
check_raw_anchors
check_double_notify
check_direct_viem_client

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
