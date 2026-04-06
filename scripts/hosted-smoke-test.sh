#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
USER_EMAIL="${2:-}"

if [[ -z "$BASE_URL" || -z "$USER_EMAIL" ]]; then
  echo "Usage: bash profitstack/scripts/hosted-smoke-test.sh <base-url> <user-email>"
  exit 1
fi

BASE_URL="${BASE_URL%/}"

echo "== ProfitStack hosted smoke test =="
echo "Base URL: $BASE_URL"
echo "User: $USER_EMAIL"

echo
echo "-- Public checks --"
curl -fsS "$BASE_URL/api/health" >/dev/null && echo "PASS /api/health"
curl -fsS "$BASE_URL/login.html" >/dev/null && echo "PASS /login.html"
curl -fsS "$BASE_URL/crm.html" >/dev/null && echo "PASS /crm.html"
curl -fsS "$BASE_URL/overrides.html" >/dev/null && echo "PASS /overrides.html"
curl -fsS "$BASE_URL/sync.html" >/dev/null && echo "PASS /sync.html"

echo
echo "-- Auth-scoped API checks --"
curl -fsS -H "X-User-Email: $USER_EMAIL" "$BASE_URL/api/session" >/dev/null && echo "PASS /api/session"
curl -fsS -H "X-User-Email: $USER_EMAIL" "$BASE_URL/api/dashboard" >/dev/null && echo "PASS /api/dashboard"
curl -fsS -H "X-User-Email: $USER_EMAIL" "$BASE_URL/api/crm-connection" >/dev/null && echo "PASS /api/crm-connection"
curl -fsS -H "X-User-Email: $USER_EMAIL" "$BASE_URL/api/overrides" >/dev/null && echo "PASS /api/overrides"
curl -fsS -H "X-User-Email: $USER_EMAIL" "$BASE_URL/api/sync-runs" >/dev/null && echo "PASS /api/sync-runs"

echo
echo "Smoke test complete."
