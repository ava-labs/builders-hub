---
title: HTTP 402 Payment Required
description: How servers request payment using HTTP 402 status code and structured payment requirements.
updated: 2025-11-14
authors: [Federico Nardelli]
icon: Code
---

## HTTP 402 Payment Required Response

When a server requires payment for a resource, it responds with the HTTP 402 Payment Required status code. This standard HTTP response includes a JSON body containing structured payment requirements that specify exactly what payment is needed, where it should go, and how it should be made.

### Response Structure

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "avalanche-fuji",
      "maxAmountRequired": "10000",
      "resource": "/api/premium-data",
      "description": "Real-time market analysis",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "asset": "0x5425890298aed601595a70AB815c96711a31Bc65",
      "maxTimeoutSeconds": 60
    }
  ],
  "error": "X-PAYMENT header is required"
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `x402Version` | number | Yes | Protocol version (currently 1) |
| `accepts` | array | Yes | Array of accepted payment options |
| `error` | string | No | Error message explaining why payment is required |

### Payment Requirements Object (`accepts` array)

Each payment option in the `accepts` array contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheme` | string | Yes | Payment scheme |
| `network` | string | Yes | Blockchain network identifier |
| `maxAmountRequired` | string | Yes | Maximum payment amount required (in token base units) |
| `resource` | string | Yes | Resource path being requested |
| `payTo` | string | Yes | Recipient blockchain address |
| `asset` | string | Yes | Token contract address |
| `maxTimeoutSeconds` | number | No | Maximum time to complete payment |
| `description` | string | No | Human-readable description |

### Payment Schemes

The `scheme` field specifies how payments are settled. x402 supports multiple schemes to handle different payment models:

**`exact` Scheme (Implemented)**:
- Fixed payment amount known upfront
- Use cases: Pay $0.10 to read an article, fixed-price API calls
- Implementations: EVM (EIP-3009), Solana, Sui
- Example: `"scheme": "exact", "maxAmountRequired": "100000"`

**`up-to` Scheme (Proposed)**:
- Variable payment based on resource consumption
- Use cases: LLM token-based pricing, pay-per-token generation, usage-metered services
- Status: Not yet implemented - under development
- Example use: Pay up to $1.00, actual charge depends on tokens consumed

The protocol is designed to be extensible, allowing new schemes to be added as payment models evolve. Current implementations focus on the `exact` scheme across multiple blockchains.

**Reference**: See [x402 Schemes Specification](https://github.com/coinbase/x402/tree/main/specs/schemes) for technical details.

### Network Identifiers

Standard network identifiers for Avalanche and other chains:

```javascript
"network": "avalanche-c-chain" // Avalanche C-Chain Mainnet
"network": "avalanche-fuji"    // Avalanche Fuji Testnet
"network": "base-sepolia"      // Base Sepolia Testnet
```

### Amount Specification

Amounts are always strings representing **base units** (smallest denomination).<br/>
**Important**: USDC has 6 decimals, so:

```javascript
// For USDC: 10000 = 0.01 USDC
"maxAmountRequired": "10000"

// For USDC: 1000000 = 1.0 USDC
"maxAmountRequired": "1000000"
```

### Asset (Token Contract Address)

The `asset` field contains the smart contract address of the payment token:

```javascript
// USDC on Avalanche Fuji testnet
"asset": "0x5425890298aed601595a70AB815c96711a31Bc65"

// USDC on Avalanche C-Chain mainnet
"asset": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"

// USDC on Base Sepolia testnet
"asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
```

**Note**: The asset is identified by contract address, not by symbol like "USDC".

### Multiple Payment Options

Servers can offer multiple payment options (different networks or tokens):

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "avalanche-fuji",
      "maxAmountRequired": "10000",
      "payTo": "0x742d35...",
      "asset": "0x5425890...",
      "resource": "/api/data"
    },
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10000",
      "payTo": "0x742d35...",
      "asset": "0x036CbD...",
      "resource": "/api/data"
    }
  ]
}
```

## Summary

The HTTP 402 Payment Required response is the server's way of requesting payment from clients. It includes a JSON body with an `accepts` array that lists one or more payment options, each specifying the payment scheme, blockchain network, token contract address, maximum amount required, recipient address, and optional timeout.

Servers can offer multiple payment options across different networks or with different tokens, giving clients flexibility in how they pay. Amounts are always specified in token base units (e.g., 10000 = 0.01 USDC with 6 decimals).
