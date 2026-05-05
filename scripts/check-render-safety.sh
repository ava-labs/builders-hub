#!/usr/bin/env bash
#
# Render Safety Check
# Finds potentially unsafe property access in JSX render code
# that could cause "Cannot read properties of undefined" crashes.
#
# This is a WARNING-only check — false positives are expected where
# the value is guaranteed non-null. Add a `// safe:` comment to opt out.
#
# Usage:
#   ./scripts/check-render-safety.sh
#
set -euo pipefail

echo "Render Safety Check"
echo "==================="
echo ""

# Pattern: function calls followed by .property without optional chaining
# e.g., hexToBuffer(x).length, JSON.parse(x).field, someFunc().prop
# This catches: func(args).prop but NOT func(args)?.prop
violations=$(grep -rn '\b[a-zA-Z]\+([^)]*)\.\(length\|map\|filter\|forEach\|find\|reduce\|slice\|join\|toString\|includes\|indexOf\|push\|pop\|keys\|values\|entries\)' \
  components/toolbox/console/ \
  components/toolbox/components/ \
  --include="*.tsx" 2>/dev/null | \
  grep -v '?\.' | \
  grep -v 'node_modules' | \
  grep -v '// safe:' | \
  grep -v 'test' || true)

if [ -n "$violations" ]; then
  count=$(echo "$violations" | wc -l | tr -d ' ')
  echo "Found $count potentially unsafe property access pattern(s)."
  echo "Consider using optional chaining (?.) for safety."
  echo "Add '// safe:' comment to suppress false positives."
  echo ""
  echo "$violations" | while read -r line; do
    echo "::warning::$line"
  done
fi

echo ""
echo "Render safety check complete"
