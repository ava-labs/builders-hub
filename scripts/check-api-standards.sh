#!/usr/bin/env bash
#
# API Standards Checker
# Enforces security and quality conventions across API route handlers.
# Used by: CI (api-ci.yml).
#
# Checks:
#   1. Stack trace leaks in JSON responses (ERROR)
#   2. Raw error object exposure in responses (ERROR)
#   3. Unbounded pagination parameters (ERROR)
#   4. Missing auth on state-changing operations (ERROR)
#   5. Hardcoded secrets in API routes (ERROR)
#   6. Missing withApi wrapper on route handlers (ERROR)
#   7. Missing Zod schema on POST/PUT/PATCH mutations (ERROR)
#   8. Missing test coverage for API routes (WARNING)
#   9. Raw fetch('/api/') in client code (ERROR)
#  10. Axios imports in client code (ERROR)
#
# Usage:
#   ./scripts/check-api-standards.sh
#
set -euo pipefail

ERRORS=0
WARNINGS=0

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No color

error() {
  echo -e "${RED}ERROR${NC}: $1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo -e "${YELLOW}WARNING${NC}: $1"
  WARNINGS=$((WARNINGS + 1))
}

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
}

echo "API Standards Check"
echo "════════════════════"
echo ""

# ── 1. Stack Trace Leaks ────────────────────────────────────────
# Catch .stack being included in NextResponse.json / Response responses.
# Patterns: error.stack, e.stack, err.stack inside JSON/response context.
echo "── Stack trace leaks ──"
found=0
while IFS= read -r match; do
  if [ -n "$match" ]; then
    error "$match"
    echo "       Never include .stack in API responses — leaks internal paths to clients"
    found=1
  fi
done < <(grep -rn '\.stack' app/api/ --include="*.ts" 2>/dev/null \
  | grep -i 'NextResponse\|Response\|json\|body\|message\|return' 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No stack trace leaks in API responses"
fi
echo ""

# ── 2. Raw Error Object Exposure ────────────────────────────────
# Catch patterns where entire error objects are spread or passed into responses:
#   { error: err }  /  { error: wrappedError }  /  { ...error }  /  { ...err }
echo "── Raw error object exposure ──"
found=0
while IFS= read -r match; do
  if [ -n "$match" ]; then
    error "$match"
    echo "       Serialize specific error fields (message, code) instead of spreading raw error objects"
    found=1
  fi
done < <(grep -rn '\.json({.*\.\.\.\(error\|err\|e\)\b' app/api/ --include="*.ts" 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No raw error object spread in API responses"
fi
echo ""

# ── 3. Unbounded Pagination ─────────────────────────────────────
# Catch routes that read pageSize/limit from query params without Math.min capping.
echo "── Unbounded pagination ──"
found=0
while IFS= read -r file; do
  if [ -n "$file" ]; then
    # Check if the file also has a Math.min or max cap near the param usage
    if ! grep -q 'Math\.min\|Math\.max\|MAX_PAGE\|MAX_LIMIT\|maxPageSize\|maxLimit' "$file" 2>/dev/null; then
      match=$(grep -n 'pageSize\|[^a-zA-Z]limit' "$file" 2>/dev/null | grep -i 'searchParams\|query\|param\|parseInt\|Number(' | head -1)
      if [ -n "$match" ]; then
        error "$file: $match"
        echo "       Apply Math.min(requested, MAX) cap to prevent denial-of-service via large page sizes"
        found=1
      fi
    fi
  fi
done < <(grep -rl '\.get(['"'"'"]pageSize['"'"'"]\|\.get(['"'"'"]limit['"'"'"]' app/api/ --include="*.ts" 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No unbounded pagination parameters"
fi
echo ""

# ── 4. Missing Auth on State-Changing Operations ────────────────
# POST/PUT/DELETE/PATCH exports must use auth.
# Exception: add "// withApi: auth intentionally omitted — [reason]" for public endpoints.
echo "── Auth on state-changing operations ──"
found=0
while IFS= read -r file; do
  if [ -n "$file" ]; then
    # Check for state-changing handlers (both withApi-style and old-style exports)
    has_mutation=false
    if grep -qE 'export\s+(const\s+)?(POST|PUT|DELETE|PATCH)\s*=' "$file" 2>/dev/null; then
      has_mutation=true
    elif grep -qE 'export\s+(async\s+)?function\s+(POST|PUT|DELETE|PATCH)\b' "$file" 2>/dev/null; then
      has_mutation=true
    fi

    if [ "$has_mutation" = true ]; then
      # Skip documented exceptions
      if grep -q '// withApi: auth intentionally omitted\|// withApi: not applicable' "$file" 2>/dev/null; then
        continue
      fi
      # Skip NextAuth
      if echo "$file" | grep -q 'auth/\[\.\.\.nextauth\]'; then continue; fi
      if ! grep -qE 'withAuth|withAuthRole|withApi.*auth|auth:\s*true|getServerSession|getToken|getUserId|CRON_SECRET' "$file" 2>/dev/null; then
        error "$file: state-changing handler without auth"
        echo "       Add { auth: true } to withApi() or document with '// withApi: auth intentionally omitted — [reason]'"
        found=1
      fi
    fi
  fi
done < <(find app/api -name '*.ts' -type f 2>/dev/null | sort)
if [ $found -eq 0 ]; then
  pass "All state-changing operations have auth checks"
fi
echo ""

# ── 5. Hardcoded Secrets ────────────────────────────────────────
# Catch patterns that look like hardcoded keys/tokens/passwords.
echo "── Hardcoded secrets ──"
found=0
while IFS= read -r match; do
  if [ -n "$match" ]; then
    # Skip lines that reference process.env or are in comments
    line_content=$(echo "$match" | cut -d: -f3-)
    if echo "$line_content" | grep -qE '^\s*(//|/\*|\*)' 2>/dev/null; then
      continue
    fi
    if echo "$line_content" | grep -q 'process\.env' 2>/dev/null; then
      continue
    fi
    error "$match"
    echo "       Use environment variables (process.env.*) instead of hardcoded secrets"
    found=1
  fi
done < <(grep -rnE "(api[_-]?key|api[_-]?secret|private[_-]?key|auth[_-]?token|bearer)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]" app/api/ --include="*.ts" 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No hardcoded secrets detected"
fi
echo ""

# ── 6. Missing withApi Wrapper ──────────────────────────────────
# Every exported route handler (GET/POST/PUT/DELETE/PATCH) must use withApi().
# Exceptions: routes with "// withApi: not applicable" (e.g. NextAuth, HTML renderers, cron).
echo "── Missing withApi wrapper ──"
found=0
while IFS= read -r file; do
  if [ -n "$file" ]; then
    # Skip documented exceptions
    if grep -q '// withApi: not applicable\|// withApi: auth intentionally omitted' "$file" 2>/dev/null; then
      continue
    fi
    # Skip NextAuth catch-all
    if echo "$file" | grep -q 'auth/\[\.\.\.nextauth\]'; then continue; fi
    # Check if file exports handlers WITHOUT withApi
    if grep -qE 'export\s+(const\s+)?(GET|POST|PUT|DELETE|PATCH)\s*=' "$file" 2>/dev/null; then
      if ! grep -q 'withApi' "$file" 2>/dev/null; then
        # Old-style: export async function GET — also not using withApi
        error "$file: route handler not wrapped with withApi()"
        echo "       All API routes must use withApi() from @/lib/api for consistent error handling + envelope"
        found=1
      fi
    elif grep -qE 'export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\b' "$file" 2>/dev/null; then
      if ! grep -q 'withApi' "$file" 2>/dev/null; then
        error "$file: route handler not wrapped with withApi()"
        echo "       All API routes must use withApi() from @/lib/api for consistent error handling + envelope"
        found=1
      fi
    fi
  fi
done < <(find app/api -name 'route.ts' -o -name 'route.tsx' 2>/dev/null | sort)
if [ $found -eq 0 ]; then
  pass "All route handlers use withApi()"
fi
echo ""

# ── 7. Missing Zod Schema on POST/PUT/PATCH ───────────────────
# State-changing routes with request bodies must have Zod validation.
# Exceptions: routes with "// schema: not applicable" (e.g. FormData, streaming).
echo "── Missing Zod schema on mutations ──"
found=0
while IFS= read -r file; do
  if [ -n "$file" ]; then
    # Skip documented exceptions
    if grep -q '// schema: not applicable\|// withApi: not applicable' "$file" 2>/dev/null; then
      continue
    fi
    # Skip NextAuth
    if echo "$file" | grep -q 'auth/\[\.\.\.nextauth\]'; then continue; fi
    # Check if file has POST/PUT/PATCH handler with withApi but no schema
    if grep -qE 'export\s+const\s+(POST|PUT|PATCH)\s*=\s*withApi' "$file" 2>/dev/null; then
      if ! grep -qE 'schema:|validateBody|validateQuery' "$file" 2>/dev/null; then
        error "$file: POST/PUT/PATCH handler missing Zod schema validation"
        echo "       Add schema option to withApi() or use validateBody()/validateQuery()"
        found=1
      fi
    fi
  fi
done < <(find app/api -name 'route.ts' -o -name 'route.tsx' 2>/dev/null | sort)
if [ $found -eq 0 ]; then
  pass "All mutation handlers have Zod validation"
fi
echo ""

# ── 8. Missing Test Coverage for API Routes ────────────────────
# Every API route must have a corresponding test file.
# This runs on ALL routes (not just changed files) to prevent drift.
echo "── API test coverage ──"
found=0
routes_without_tests=0
total_routes=0
while IFS= read -r file; do
  if [ -n "$file" ]; then
    total_routes=$((total_routes + 1))
    # Skip documented exceptions
    if grep -q '// tests: not applicable' "$file" 2>/dev/null; then continue; fi
    # Skip NextAuth, OG image routes, well-known, cron routes
    if echo "$file" | grep -qE 'auth/\[\.\.\.nextauth\]|/og/|well-known|/check/route\.ts$'; then continue; fi
    # Check if any test file references this route's path
    route_path=$(echo "$file" | sed 's|app/api/||; s|/route\.tsx\?||')
    if ! grep -rl "$route_path\|$(basename $(dirname $file))" tests/api/ --include="*.test.ts" > /dev/null 2>&1; then
      routes_without_tests=$((routes_without_tests + 1))
      if [ $routes_without_tests -le 10 ]; then
        warn "$file: no test coverage found in tests/api/"
        echo "       Add tests to tests/api/ that import and test this route's handlers"
      fi
    fi
  fi
done < <(find app/api -name 'route.ts' -o -name 'route.tsx' 2>/dev/null | sort)
if [ $routes_without_tests -gt 10 ]; then
  warn "... and $((routes_without_tests - 10)) more routes without tests"
fi
if [ $routes_without_tests -gt 0 ]; then
  warn "$routes_without_tests of $total_routes API routes lack test coverage"
else
  pass "All $total_routes API routes have test coverage"
fi
echo ""

# ── 9. Raw fetch('/api/') in Client Code ───────────────────────
# Client components/hooks/app pages must use apiFetch() from @/lib/api/client.
echo "── Raw fetch('/api/') in client code ──"
found=0
while IFS= read -r match; do
  if [ -n "$match" ]; then
    if echo "$match" | grep -q "eslint-disable"; then continue; fi
    error "$match"
    echo "       Use apiFetch() from @/lib/api/client instead of raw fetch('/api/...')"
    found=1
  fi
done < <(grep -rn "fetch(['\"\`]/api/" components/ hooks/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "^app/api/" 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No raw fetch('/api/') calls in client code"
fi
echo ""

# ── 10. Axios Imports in Client Code ───────────────────────────
# axios is banned — all API calls go through apiFetch().
echo "── Axios imports in client code ──"
found=0
while IFS= read -r match; do
  if [ -n "$match" ]; then
    error "$match"
    echo "       Use apiFetch() from @/lib/api/client instead of axios"
    found=1
  fi
done < <(grep -rn "from ['\"]axios['\"]" components/ hooks/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ $found -eq 0 ]; then
  pass "No axios imports in client code"
fi
echo ""

# ── Summary ─────────────────────────────────────────────────────
echo "════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠ $WARNINGS warning(s) (non-blocking)${NC}"
  exit 0
else
  echo -e "${GREEN}✓ All checks passed${NC}"
  exit 0
fi
