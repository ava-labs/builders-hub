#!/bin/bash
# CI check: Ensure all P-Chain transaction steps have platform-cli command
# alternatives and all accessList/warp steps have cast/foundry alternatives.
#
# P-Chain steps must use PChainManualSubmit or CoreWalletTransactionButton
# (both render a copyable platform-cli command in the UI).
#
# AccessList/warp steps must render a cast command alternative.

set -euo pipefail

errors=0
warnings=0

echo "Checking CLI command coverage..."
echo ""

# ── P-Chain: platform-cli coverage ────────────────────────────
# Files that submit P-Chain transactions must render a CLI command
echo "--- P-Chain (platform-cli) ---"

PCHAIN_FILES=$(grep -rln 'submitPChainTx\|registerL1Validator\|setL1ValidatorWeight\|SetL1Validator\|RegisterL1Validator\|DisableL1Validator' \
  components/toolbox/console/ \
  --include="*.tsx" 2>/dev/null | \
  grep -v 'codeConfig\|types\|shared/fetch\|hooks/' || true)

for f in $PCHAIN_FILES; do
  # Skip step wrappers that delegate to shared SubmitPChainTx* components (those already have CLI)
  if grep -q 'SubmitPChainTxWeightUpdate\|SubmitPChainTxRegisterL1Validator\|SubmitPChainTxRemoval' "$f"; then
    continue
  fi
  # Skip utility/context files that don't render UI (false positives)
  basename=$(basename "$f")
  if [[ "$basename" == "justification.tsx" || "$basename" == "ValidatorSelector.tsx" || "$basename" == *"Context.tsx" ]]; then
    continue
  fi
  if ! grep -q 'PChainManualSubmit\|CoreWalletTransactionButton\|CliAlternative\|cliCommand\|platform-cli\|platform l1\|platform subnet\|platform chain\|platform validator' "$f"; then
    echo "::error file=$f::P-Chain transaction missing platform-cli alternative (use PChainManualSubmit, CoreWalletTransactionButton, or CliAlternative)"
    errors=$((errors + 1))
  fi
done

[ $errors -eq 0 ] && echo "  All P-Chain steps have platform-cli commands"

# ── AccessList / Warp: cast coverage ──────────────────────────
# Files that use accessList for warp messages must render a cast command
echo ""
echo "--- AccessList / Warp (cast) ---"

prev_errors=$errors
ACCESSLIST_FILES=$(grep -rln 'packWarpIntoAccessList\|accessList.*packWarp' \
  components/toolbox/console/ \
  --include="*.tsx" 2>/dev/null | \
  grep -v 'codeConfig\|types\|hooks/' || true)

for f in $ACCESSLIST_FILES; do
  if ! grep -q 'cast send\|cast call\|CliAlternative\|castCommand\|foundry\|generateCastCommand\|buildCastCommand' "$f"; then
    echo "::error file=$f::accessList/warp transaction missing cast/foundry alternative"
    errors=$((errors + 1))
  fi
done

[ $errors -eq $prev_errors ] && echo "  All accessList steps have cast commands"

# ── Summary ───────────────────────────────────────────────────
echo ""
if [ $errors -eq 0 ]; then
  echo "All transaction steps have CLI command coverage"
else
  echo "$errors error(s): missing CLI command alternatives"
  exit 1
fi
