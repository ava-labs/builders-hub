# Explorer External API Calls Documentation

This document lists all external API calls made within the explorer scope, including Glacier (Avalanche SDK), CoinGecko, Dune Analytics, Sourcify, Solokhin, and direct RPC calls.

---

## 1. Avalanche SDK (Glacier API)

All Glacier API calls use the `@avalanche-sdk/chainkit` SDK and authenticate automatically.

| File | Method | Purpose | Parameters |
|------|--------|---------|------------|
| `app/api/explorer/[chainId]/route.ts` | `avalanche.data.evm.chains.get()` | Check if chain is supported by Glacier | `chainId` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.contracts.getMetadata()` | Get contract metadata (name, symbol, logo, etc.) | `address`, `chainId` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.address.chains.list()` | Get multichain address info (all chains where address exists) | `address` |
| `app/api/explorer/[chainId]/address/[address]/route.ts` | `avalanche.data.evm.address.transactions.list()` | Get address transactions with pagination (includes ERC-20, ERC-721, ERC-1155, internal txns) | `address`, `chainId`, `sortOrder: 'desc'`, `pageSize: 25`, `pageToken` |
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
| `app/api/explorer/[chainId]/route.ts` | `api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false` | Get token price data (USD, market cap, 24h change, etc.) | `coingeckoId` (from chain config) |

**Base URL**: `https://api.coingecko.com/api/v3`  
**Authentication**: None (public API)  
**Rate Limits**: Yes (free tier: 10-50 calls/minute)  
**Cache**: 60 seconds (in-memory `priceCache`)

---

## 3. Dune Analytics API

Used for fetching address labels from Dune Analytics queries.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `app/api/dune/[address]/route.ts` | `api.dune.com/api/v1/query/${QUERY_ID}/execute` | Start Dune query execution | `query_parameters: { address }`, `performance: 'medium'` |
| `app/api/dune/[address]/route.ts` | `api.dune.com/api/v1/execution/${executionId}/status` | Check execution status | `executionId` (from cache) |
| `app/api/dune/[address]/route.ts` | `api.dune.com/api/v1/execution/${executionId}/results` | Get query results | `executionId` |

**Base URL**: `https://api.dune.com/api/v1`  
**Authentication**: `X-Dune-API-Key` header (from `DUNE_API_KEY` env var)  
**Rate Limits**: Yes (depends on API plan)  
**Query ID**: `6275927` (hardcoded)  
**Response statuses**: `cached`, `completed`, `waiting`, `failed`  
**Cache**: 
- Labels: 1 hour (in-memory via `app/api/dune/cache.ts`)
- Pending executions: 5 minutes (in-memory)

**Flow** (non-blocking, UI polls):
1. Check cache → return `status: 'cached'` if found
2. Check pending execution → if exists, check status:
   - Complete → fetch results, cache, return `status: 'completed'`
   - Still running → return `status: 'waiting'`
   - Failed → clear and continue to step 3
3. Start new execution → store in cache → return `status: 'waiting'`
4. UI polls every 1.5s until results or timeout (30s)

---

## 4. Sourcify API

Used for contract verification and source code retrieval.

### Server-side / API Routes

No server-side Sourcify calls (verification is done client-side).

### Client-side (Components)

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}` | Check if contract is verified | `chainId`, `address` |
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}?fields=all` | Get full verified contract details (ABI, source code, compilation info) | `chainId`, `address`, `fields=all` |
| `components/explorer/AddressDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${implAddress}?fields=all` | Get proxy implementation ABI | `chainId`, `implAddress`, `fields=all` |
| `components/explorer/TransactionDetailPage.tsx` | `sourcify.dev/server/v2/contract/${chainId}/${address}` | Check if "To" contract is verified (for badge display) | `chainId`, `address` |

**Base URL**: `https://sourcify.dev/server/v2`  
**Authentication**: None (public API)  
**Rate Limits**: None (public service)  
**Note**: Only called when `sourcifySupport: true` in chain config

---

## 5. Solokhin API

Used for fetching transaction statistics and history.

| File | Endpoint | Purpose | Parameters |
|------|----------|---------|------------|
| `app/api/explorer/[chainId]/route.ts` | `idx6.solokhin.com/api/global/overview/dailyTxsByChainCompact` | Get daily transaction counts for all chains (last 14 days) | None |
| `app/api/explorer/[chainId]/route.ts` | `idx6.solokhin.com/api/${evmChainId}/stats/cumulative-txs` | Get cumulative transaction count for a chain | `evmChainId` (path param) |

**Base URL**: `https://idx6.solokhin.com/api`  
**Authentication**: None (public API)  
**Rate Limits**: Unknown  
**Cache**: 
- Daily Txs: 5 minutes (in-memory `dailyTxsCache`)
- Cumulative Txs: 30 seconds (in-memory `cumulativeTxsCache`)

---

## 6. Direct RPC Calls

Direct JSON-RPC calls to chain RPC endpoints (from `l1-chains.json` or query parameter).

### API Routes

#### Main Explorer Route (`app/api/explorer/[chainId]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_blockNumber` | Get latest block number | None |
| `eth_getBlockByNumber` | Get block details with full transactions | `blockNumber` (hex), `true` (full txs) |
| `eth_getTransactionReceipt` | Get transaction receipt (for gas fees, logs) | `transactionHash` |
| `eth_gasPrice` | Get current gas price | None |
| `eth_getLogs` | Get historical logs (for ICM messages) | `fromBlock`, `toBlock`, `topics` (SendCrossChainMessage, ReceiveCrossChainMessage) |
| `eth_getTransactionByHash` | Get transaction details (for ICM processing) | `transactionHash` |

#### Address Route (`app/api/explorer/[chainId]/address/[address]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getCode` | Check if address is a contract | `address`, `'latest'` |
| `eth_getBalance` | Get native token balance | `address`, `'latest'` |

#### Block Route (`app/api/explorer/[chainId]/block/[blockNumber]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getBlockByNumber` | Get block details with full transactions | `blockNumber` (hex), `true` (full txs) |
| `eth_getTransactionReceipt` | Get transaction receipts for gas fee calculation | `transactionHash` (for each tx in block) |

#### Block Transactions Route (`app/api/explorer/[chainId]/block/[blockNumber]/transactions/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getBlockByNumber` | Get block with full transaction objects | `blockNumber` (hex), `true` (full txs) |

#### Transaction Route (`app/api/explorer/[chainId]/tx/[txHash]/route.ts`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_getTransactionReceipt` | Get transaction receipt with logs | `transactionHash` |
| `eth_getTransactionByHash` | Get transaction details | `transactionHash` |
| `eth_getBlockByNumber` | Get block for timestamp | `blockNumber` (hex), `false` |
| `eth_blockNumber` | Get latest block for confirmations | None |

### Client-side (Components)

#### Transaction Detail Page (`components/explorer/TransactionDetailPage.tsx`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_call` | Get token symbol (`symbol()` - 0x95d89b41) | `to: tokenAddress`, `data: '0x95d89b41'` |
| `eth_call` | Get token decimals (`decimals()` - 0x313ce567) | `to: tokenAddress`, `data: '0x313ce567'` |

#### Contract Read Section (`components/explorer/ContractReadSection.tsx`)

| RPC Method | Purpose | Parameters |
|------------|---------|------------|
| `eth_call` | Read contract function | `to: contractAddress`, `data: encodedFunctionCall` |

**RPC URL**: From `l1-chains.json` (`chain.rpcUrl`) or `rpcUrl` query parameter  
**Protocol**: JSON-RPC 2.0  
**Rate Limits**: Depends on RPC provider  
**Timeout**: 
- API routes: 10-15 seconds per call
- Client-side: Browser default

---

## 7. Internal API Routes

These are internal API endpoints called by frontend components (not external APIs).

| Component | Internal API | Purpose |
|-----------|-------------|---------|
| `AddressDetailPage.tsx` | `/api/explorer/${chainId}/address/${address}` | Fetch address data |
| `AddressDetailPage.tsx` | `/api/explorer/${chainId}/address/${address}/erc20-balances` | Fetch ERC-20 balances (paginated) |
| `AddressDetailPage.tsx` | `/api/dune/${address}` | Fetch Dune labels (polling) |
| `TransactionDetailPage.tsx` | `/api/explorer/${chainId}/tx/${txHash}` | Fetch transaction details |
| `TransactionDetailPage.tsx` | `/api/explorer/${chainId}/token/${tokenAddress}/metadata` | Fetch token metadata for ERC-20 transfers |
| `L1ExplorerPage.tsx` | `/api/explorer/${chainId}` | Fetch chain explorer data (initial + incremental) |
| `AllChainsExplorerPage.tsx` | `/api/explorer/${chainId}` | Fetch data for all supported chains |

---

## Summary Statistics

| Service | Total Calls | Rate Limited? | Cached? |
|---------|-------------|---------------|---------|
| **Glacier (Avalanche SDK)** | 6 | No | No (but SDK may cache) |
| **CoinGecko** | 2 | Yes | Yes (60s in-memory) |
| **Dune Analytics** | 3 | Yes | Yes (1 hour labels / 5 min pending) |
| **Sourcify** | 4 (client-side) | No | No (client fetches per page load) |
| **Solokhin API** | 2 | Unknown | Yes (5 min / 30s) |
| **Direct RPC** | ~15+ | Depends on provider | No |
| **Internal APIs** | 7+ | No | Varies by route |

---

## Environment Variables Required

- `DUNE_API_KEY` - Dune Analytics API key for address labels

---

## Notes

1. **Glacier API**: All calls are authenticated via the SDK. No manual API key needed. Used for address info, contract metadata, and ERC-20 balances.

2. **Dune Analytics**: Uses a 3-step process (execute → poll → results) with caching to avoid duplicate queries. Labels are cached for 1 hour.

3. **RPC Calls**: Timeout set to 10-15 seconds. Some chains may have rate limits depending on RPC provider.

4. **Sourcify**: All calls are made client-side from `AddressDetailPage.tsx` and `TransactionDetailPage.tsx`. Only fetched when viewing a contract address with `sourcifySupport: true`.

5. **Caching Summary**:
   - CoinGecko: 60 seconds (in-memory)
   - Solokhin Daily Txs: 5 minutes (in-memory)
   - Solokhin Cumulative Txs: 30 seconds (in-memory)
   - Dune Labels: 1 hour (in-memory)
   - Dune Pending Executions: 5 minutes (in-memory)

6. **Error Handling**: All external calls have try-catch blocks and fallback to empty/default values.

7. **Cross-Chain (ICM) Events**: Detected via `eth_getLogs` with TeleporterMessenger event topics (SendCrossChainMessage, ReceiveCrossChainMessage).

---

## Future Considerations

- Consider adding retry logic for rate-limited APIs (especially CoinGecko)
- Add request logging/metrics for external calls
- Implement exponential backoff for failed requests
- Consider using a rate limiting library for CoinGecko calls
- Consider server-side caching for Sourcify data to reduce client-side requests

