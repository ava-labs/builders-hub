#!/bin/bash
# Test script — fires all HubSpot certificate webhooks for Nicolas Arnedo
# Usage: bash scripts/test-hubspot-webhooks.sh
#
# Reads webhook URLs from environment variables. Set them in .env or export before running.
# See .env.example for the full list of required variables.

EMAIL="nicolas.arnedo@avalabs.org"
FIRST="Nicolas"
LAST="Arnedo"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

fire() {
  local env_var="$1"
  local url="${!env_var}"
  local course_name="$2"
  local label="$3"

  if [ -z "$url" ]; then
    echo "  $label — $course_name ... SKIPPED ($env_var not set)"
    return
  fi

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
fire "HUBSPOT_WEBHOOK_AVALANCHE_FUNDAMENTALS"            "Avalanche Fundamentals"              "avalanche-fundamentals"
fire "HUBSPOT_WEBHOOK_PERMISSIONED_L1S"                  "Permissioned L1s"                    "permissioned-l1s"
fire "HUBSPOT_WEBHOOK_L1_NATIVE_TOKENOMICS"              "L1 Native Tokenomics"                "l1-native-tokenomics"
fire "HUBSPOT_WEBHOOK_PERMISSIONLESS_L1S"                "Permissionless L1s"                  "permissionless-l1s"
fire "HUBSPOT_WEBHOOK_INTERCHAIN_MESSAGING"              "Interchain Messaging"                "interchain-messaging"
fire "HUBSPOT_WEBHOOK_ERC20_BRIDGE"                      "ERC-20 to ERC-20 Bridge"             "erc20-bridge"
fire "HUBSPOT_WEBHOOK_NATIVE_TOKEN_BRIDGE"               "Native Token Bridge"                 "native-token-bridge"
fire "HUBSPOT_WEBHOOK_CUSTOMIZING_EVM"                   "Customizing the EVM"                 "customizing-evm"
fire "HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_FUNDAMENTALS"   "Access Restriction Fundamentals"     "access-restriction-fundamentals"
fire "HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_ADVANCED"       "Access Restriction Advanced"         "access-restriction-advanced"

echo ""
echo "=== BLOCKCHAIN ACADEMY — Per-Course Webhooks ==="
fire "HUBSPOT_WEBHOOK_BLOCKCHAIN_FUNDAMENTALS"           "Blockchain Fundamentals"             "blockchain-fundamentals"
fire "HUBSPOT_WEBHOOK_SOLIDITY_FOUNDRY"                  "Solidity Programming with Foundry"   "solidity-foundry"
fire "HUBSPOT_WEBHOOK_NFT_DEPLOYMENT"                    "NFT Deployment"                      "nft-deployment"
fire "HUBSPOT_WEBHOOK_ENCRYPTED_ERC"                     "Encrypted ERC"                       "encrypted-erc"
fire "HUBSPOT_WEBHOOK_X402_PAYMENT_INFRASTRUCTURE"       "x402 Payment Infrastructure"         "x402-payment-infrastructure"

echo ""
echo "=== GRADUATION WEBHOOKS ==="
fire "HUBSPOT_WEBHOOK_AVALANCHE_L1_GRADUATION"           "Avalanche L1 Academy Graduate"       "avalanche-l1-graduation"
fire "HUBSPOT_WEBHOOK_BLOCKCHAIN_GRADUATION"             "Blockchain Academy Graduate"         "blockchain-graduation"

echo ""
echo "Done! Check HubSpot for incoming webhook events."
