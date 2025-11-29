# Explorer External API Calls Documentation

This document lists all external API calls made within the explorer scope, including Glacier (Avalanche SDK), CoinGecko, Dune Analytics, Sourcify, Subnet Stats, and direct RPC calls.

---

## 1. Avalanche SDK (Glacier API)

All Glacier API calls use the `@avalanche-sdk/chainkit` SDK and authenticate automatically.

| File | Method | Purpose | Parameters |
|------|--------|---------|------------|
| `app/api/explorer/[chainId]/route.ts` | `avalanche.data.evm.chains.get()` | Check if chain is supported by Glacier | `chainId` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.address.balances.getNative()` | Get native token balance for address | `address`, `chainId`, `currency: 'usd'` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.contracts.getMetadata()` | Get contract metadata (name, symbol, logo, etc.) | `address`, `chainId` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.address.chains.list()` | Get multichain address info (all chains where address exists) | `address` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.address.transactions.list()` | Get address transactions with pagination | `address`, `chainId`, `pageToken`, `pageSize: 50` |
| `app/api/explorer/[chainId]/address/[address]/erc20-balances/route.ts` | `avalanche.data.evm.address.balances.listErc20()` | Get ERC-20 token balances (paginated) | `address`, `chainId`, `currency: 'usd'`, `filterSpamTokens: true`, `pageSize: 200`, `pageToken` |
| `app/api/explorer/[chainId]/token/[tokenAddress]/metadata/route.ts` | `avalanche.data.evm.contracts.getMetadata()` | Get token metadata (logo URI, name, symbol) | `address`, `chainId` |

**Base URL**: `https://data-api.avax.network`  
**Authentication**: Automatic via SDK  
**Rate Limits**: None (authenticated service)

---

## 2. CoinGecko API

Used for fetching token prices and AVAX price data.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `app/api/explorer/[chainId]/route.ts` | `api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd` | Get AVAX price in USD | None |
| `app/api/explorer/[chainId]/route.ts` | `api.coingecko.com/api/v3/coins/${coingeckoId}` | Get token price data (USD, market cap, etc.) | `coingeckoId` (from chain config) |

**Base URL**: `https://api.coingecko.com/api/v3`  
**Authentication**: None (public API)  
**Rate Limits**: Yes (free tier: 10-50 calls/minute)  
**Cache**: 60 seconds (`revalidate: 60`)

---

## 3. Dune Analytics API

Used for fetching address labels from Dune Analytics queries.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `api.dune.com/api/v1/query/${QUERY_ID}/execute` | Start Dune query execution for address labels | `query_parameters: { address }`, `performance: 'medium'` |
| `app/api/dune/status/[executionId]/route.ts` | `api.dune.com/api/v1/execution/${executionId}/status` | Poll query execution status | `executionId` |
| `app/api/dune/results/[executionId]/route.ts` | `api.dune.com/api/v1/execution/${executionId}/results` | Get query results (address labels) | `executionId` |

**Base URL**: `https://api.dune.com/api/v1`  
**Authentication**: `X-Dune-API-Key` header (from `DUNE_API_KEY` env var)  
**Rate Limits**: Yes (depends on API plan)  
**Query ID**: `6275927` (hardcoded)

---

## 4. Sourcify API

Used for contract verification and source code retrieval.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}` | Check if contract is verified | `chainId`, `address` |
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}?fields=all` | Get full verified contract details (ABI, source code, etc.) | `chainId`, `address`, `fields=all` |
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${implAddress}?fields=all` | Get proxy implementation ABI | `chainId`, `implAddress`, `fields=all` |
| `components/explorer/TransactionDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}` | Check if "To" contract is verified | `chainId`, `address` |

**Base URL**: `https://sourcify.dev/server/v2`  
**Authentication**: None (public API)  
**Rate Limits**: No (public service)  
**Note**: Only called when `sourcifySupport: true` in chain config

---

## 5. Solokhin API

Used for fetching transaction statistics and history.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `app/api/explorer/[chainId]/route.ts` | `idx6.solokhin.com/api/global/overview/dailyTxsByChainCompact` | Get daily transaction counts for all chains | None |
| `app/api/explorer/[chainId]/route.ts` | `idx6.solokhin.com/api/${evmChainId}/stats/cumulative-txs` | Get cumulative transaction count for a chain | `evmChainId` (path param) |

**Base URL**: `https://idx6.solokhin.com/api`  
**Authentication**: None (public API)  
**Rate Limits**: Unknown  
**Cache**: 
- Daily Txs: 5 minutes (in-memory)
- Cumulative Txs: 30 seconds (in-memory)

---

## 6. Direct RPC Calls

Direct JSON-RPC calls to chain RPC endpoints (from `l1-chains.json`).

### Main Explorer Route (`app/api/explorer/[chainId]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_blockNumber` | Get latest block number | None |
| `eth_getBlockByNumber` | Get block details with transactions | `blockNumber` (hex), `true` (full txs) |
| `eth_getTransactionReceipt` | Get transaction receipt (for gas fees, logs) | `transactionHash` |
| `eth_gasPrice` | Get current gas price | None |
| `eth_getLogs` | Get historical logs (for ICM messages) | `fromBlock`, `toBlock`, `topics` |
| `eth_getTransactionByHash` | Get transaction details | `transactionHash` |

### Address Route (`app/api/explorer/[chainId]/address/[address]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getCode` | Check if address is a contract | `address`, `latest` |

### Transaction Route (`app/api/explorer/[chainId]/tx/[txHash]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getTransactionByHash` | Get transaction details | `transactionHash` |
| `eth_getTransactionReceipt` | Get transaction receipt with logs | `transactionHash` |

### Block Routes (`app/api/explorer/[chainId]/block/[blockNumber]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getBlockByNumber` | Get block details | `blockNumber` (hex), `false` (tx hashes only) or `true` (full txs) |

### UI Components (Client-side RPC calls)

| File | RPC Method | Purpose | Parameters |
|------|------------|---------|------------|
| `components/explorer/TransactionDetailPage.tsx` | `eth_call` | Get token symbol | `to: tokenAddress`, `data: symbol()` |
| `components/explorer/TransactionDetailPage.tsx` | `eth_call` | Get token decimals | `to: tokenAddress`, `data: decimals()` |
| `components/explorer/ContractReadSection.tsx` | `eth_call` | Read contract function | `to: contractAddress`, `data: encodedFunctionCall` |

**RPC URL**: From `l1-chains.json` (`chain.rpcUrl`)  
**Protocol**: JSON-RPC 2.0  
**Rate Limits**: Depends on RPC provider  
**Timeout**: 15 seconds per call

---

## Summary Statistics

| Service | Total Calls | Rate Limited? | Cached? |
|---------|-------------|---------------|---------|
| **Glacier (Avalanche SDK)** | 7 | No | No (but SDK may cache) |
| **CoinGecko** | 2 | Yes | Yes (60s) |
| **Dune Analytics** | 3 | Yes | Yes (1 hour, in-memory) |
| **Sourcify** | 4 | No | No |
| **Solokhin API** | 2 | Unknown | Yes (5 min / 30s) |
| **Direct RPC** | ~12+ | Depends on provider | No |

---

## Environment Variables Required

- `DUNE_API_KEY` - Dune Analytics API key for address labels

---

## Notes

1. **Glacier API**: All calls are authenticated via the SDK. No manual API key needed.
2. **Dune Analytics**: Uses a 3-step process (execute → poll → results) with caching to avoid duplicate queries.
3. **RPC Calls**: Timeout set to 15 seconds. Some chains may have rate limits.
4. **Caching**: 
   - CoinGecko: Next.js `revalidate: 60`
   - Subnet Stats: In-memory cache (5 min)
   - Dune: In-memory cache (1 hour)
   - Explorer data: In-memory cache (30 seconds)
5. **Error Handling**: All external calls have try-catch blocks and fallback to empty/default values.

---

## Future Considerations

- Consider adding retry logic for rate-limited APIs
- Add request logging/metrics for external calls
- Implement exponential backoff for failed requests
- Consider using a rate limiting library for CoinGecko calls

