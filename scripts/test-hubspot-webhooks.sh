#!/bin/bash
# Test script — fires all HubSpot certificate webhooks for Nicolas Arnedo
# Usage: bash scripts/test-hubspot-webhooks.sh

BASE="https://api-na1.hubapi.com/automation/v4/webhook-triggers/7522520"
EMAIL="nicolas.arnedo@avalabs.org"
FIRST="Nicolas"
LAST="Arnedo"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

fire() {
  local url="$1"
  local course_name="$2"
  local label="$3"

  echo -n "  $label — $course_name ... "
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "{\"firstName\":\"$FIRST\",\"lastName\":\"$LAST\",\"email\":\"$EMAIL\",\"courseName\":\"$course_name\",\"courseCompletionDate\":\"$DATE\"}")

  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    echo "OK ($status)"
  else
    echo "FAILED ($status)"
  fi
}

echo ""
echo "=== AVALANCHE L1 ACADEMY — Per-Course Webhooks ==="
fire "$BASE/TuyFFUJ" "Avalanche Fundamentals"              "avalanche-fundamentals"
fire "$BASE/sKDDMBB" "Permissioned L1s"                    "permissioned-l1s"
fire "$BASE/GuYqenD" "L1 Native Tokenomics"                "l1-native-tokenomics"
fire "$BASE/QPJMz91" "Permissionless L1s"                  "permissionless-l1s"
fire "$BASE/mGseHO6" "Interchain Messaging"                "interchain-messaging"
fire "$BASE/N89Q354" "ERC-20 to ERC-20 Bridge"             "erc20-bridge"
fire "$BASE/I3LlRdL" "Native Token Bridge"                 "native-token-bridge"
fire "$BASE/W40ZomG" "Customizing the EVM"                 "customizing-evm"
fire "$BASE/QqKjSIN" "Access Restriction Fundamentals"     "access-restriction-fundamentals"
fire "$BASE/K7nyUjr" "Access Restriction Advanced"         "access-restriction-advanced"

echo ""
echo "=== BLOCKCHAIN ACADEMY — Per-Course Webhooks ==="
fire "$BASE/uGqmSUS" "Blockchain Fundamentals"             "blockchain-fundamentals"
fire "$BASE/DM95DwX" "Solidity Programming with Foundry"   "solidity-foundry"
fire "$BASE/EGFz4c0" "NFT Deployment"                      "nft-deployment"
fire "$BASE/iK7ZVk4" "Encrypted ERC"                       "encrypted-erc"
fire "$BASE/qbSaOMv" "x402 Payment Infrastructure"         "x402-payment-infrastructure"

echo ""
echo "=== GRADUATION WEBHOOKS ==="
fire "$BASE/fuZ0WyV" "Avalanche L1 Academy Graduate"       "avalanche-l1-graduation"
fire "$BASE/QZXbYnP" "Blockchain Academy Graduate"         "blockchain-graduation"

echo ""
echo "Done! Check HubSpot for incoming webhook events."
