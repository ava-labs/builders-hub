#!/bin/bash
# Integration test script for certificate generation flow
# Usage: SESSION_COOKIE="..." USER_ID="..." bash scripts/test-certificate-flow.sh [BASE_URL]
#
# Requires:
#   SESSION_COOKIE - next-auth session cookie from browser (next-auth.session-token=...)
#   USER_ID        - the authenticated user's ID
#   BASE_URL       - optional, defaults to http://localhost:3000

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
COURSE_ID="avalanche-fundamentals"

if [ -z "${SESSION_COOKIE:-}" ] || [ -z "${USER_ID:-}" ]; then
  echo "ERROR: SESSION_COOKIE and USER_ID must be set."
  echo "Usage: SESSION_COOKIE=\"...\" USER_ID=\"...\" bash $0 [BASE_URL]"
  exit 1
fi

run_test() {
  local name="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $name (HTTP $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $name — expected $expected, got $actual"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== Certificate Flow Integration Tests ==="
echo "  Base URL: $BASE_URL"
echo ""

# ─── Test 1: Badge assignment (single call) ───
echo "1. Badge assignment (single call)"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/badge/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"$COURSE_ID\",\"userId\":\"$USER_ID\",\"category\":0}")
run_test "Single badge assignment" "200" "$status"

# ─── Test 2: Badge assignment idempotency ───
echo "2. Badge assignment idempotency (duplicate call)"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/badge/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"$COURSE_ID\",\"userId\":\"$USER_ID\",\"category\":0}")
run_test "Duplicate badge assignment" "200" "$status"

# ─── Test 3: Concurrent badge assignments ───
echo "3. Concurrent badge assignments (parallel)"
tmpA=$(mktemp)
tmpB=$(mktemp)

curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/badge/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"$COURSE_ID\",\"userId\":\"$USER_ID\",\"category\":0}" > "$tmpA" &

curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/badge/assign" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"$COURSE_ID\",\"userId\":\"$USER_ID\",\"category\":0}" > "$tmpB" &

wait
statusA=$(cat "$tmpA")
statusB=$(cat "$tmpB")
rm -f "$tmpA" "$tmpB"

if [ "$statusA" != "500" ] && [ "$statusB" != "500" ]; then
  echo "  PASS  Concurrent assignments — no 500 (got $statusA, $statusB)"
  PASS=$((PASS + 1))
else
  echo "  FAIL  Concurrent assignments — got 500 ($statusA, $statusB)"
  FAIL=$((FAIL + 1))
fi

# ─── Test 4: Certificate PDF generation ───
echo "4. Certificate PDF generation"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate-certificate" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"$COURSE_ID\"}")
run_test "PDF generation" "200" "$status"

# ─── Test 5: Invalid course ───
echo "5. Invalid course ID"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate-certificate" \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d "{\"courseId\":\"nonexistent-course-xyz\"}")
run_test "Invalid course returns 404" "404" "$status"

# ─── Test 6: Unauthenticated access ───
echo "6. Unauthenticated access"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/generate-certificate" \
  -H "Content-Type: application/json" \
  -d "{\"courseId\":\"$COURSE_ID\"}")
run_test "Unauthenticated returns 401" "401" "$status"

# ─── Summary ───
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit "$FAIL"
