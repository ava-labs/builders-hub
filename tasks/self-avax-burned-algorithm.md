# Self-AVAX Burned Per Contract — Algorithm & Implementation Spec

## Purpose
Calculate the **self-AVAX burned** by specific contract addresses on Avalanche C-Chain (chain_id `43114`). This uses trace-based gas attribution to accurately assign gas costs to the contract that actually consumed the gas, not just the top-level `tx.to` recipient.

## Why traces instead of `tx.to`?
If you just `GROUP BY tx.to`, aggregator contracts (ParaSwap, Odos, 1inch) get credited with ALL gas from transactions routed through them. In reality, the gas is consumed by the downstream DEXes (Trader Joe, Pharaoh, etc.) they call. Trace-based attribution fixes this.

---

## Core Algorithm: "Received Minus Given"

For each contract address, per transaction:

```
self_gas = max(0, received_gas - given_gas)
```

Where:
- **received_gas** = sum of `gas_used` on all traces WHERE `trace.to = contract`
- **given_gas** = sum of `gas_used` on all traces WHERE `trace.from = contract`

Then:
```
self_avax_burned = self_gas * effective_gas_price / 1e18
```

### Call type filtering
Only count these trace `call_type` values:
- `CALL` — standard external call
- `CREATE` — contract deployment
- `CREATE2` — deterministic deployment

**Exclude:**
- `DELEGATECALL` — executes callee code in caller's context, gas stays with the proxy/caller
- `STATICCALL` — read-only, gas is already counted in the parent CALL

---

## ClickHouse Data Sources

### Connection
```
URL:      CLICKHOUSE_PROXY_URL (env var)
User:     CLICKHOUSE_USER (env var, default: 'readonly')
Password: CLICKHOUSE_PASSWORD (env var)
Database: CLICKHOUSE_DATABASE (env var, default: 'default')

# Query via HTTP POST, append "FORMAT JSON" to SQL
# Headers: X-ClickHouse-User, X-ClickHouse-Key, X-ClickHouse-Database
```

### Table: `raw_traces`
| Column | Type | Notes |
|--------|------|-------|
| `tx_hash` | FixedString(32) | Binary, use `unhex('...')` to match |
| `from` | FixedString(20) | Trace caller (binary) |
| `to` | Nullable(FixedString(20)) | Trace callee (binary, NULL for CREATE) |
| `gas_used` | UInt32 | Gas consumed by this trace |
| `call_type` | LowCardinality(String) | CALL, STATICCALL, DELEGATECALL, CREATE, CREATE2, SELFDESTRUCT |
| `block_time` | DateTime64 | Block timestamp |
| `chain_id` | UInt32 | 43114 for C-Chain |
| `tx_from` | FixedString(20) | Original tx sender |
| `tx_to` | Nullable(FixedString(20)) | Original tx recipient |
| `trace_address` | Array(UInt32) | Nesting path, e.g. [6,0] = 7th subcall's 1st child |

### Table: `raw_txs`
| Column | Type | Notes |
|--------|------|-------|
| `hash` | FixedString(32) | Binary tx hash |
| `from` | FixedString(20) | Sender |
| `to` | Nullable(FixedString(20)) | Recipient (NULL for deploys) |
| `gas_used` | UInt32 | Gas consumed |
| `gas_price` | UInt64 | **WARNING: may not be effectiveGasPrice for EIP-1559 txs** |
| `block_time` | DateTime64 | Block timestamp |
| `chain_id` | UInt32 | 43114 for C-Chain |
| `input` | String | Calldata |

### Table: `raw_logs` (for AVAX/USD price)
Used to derive hourly AVAX/USD from DEX swap events.

### Table: `sync_watermark`
Latest synced block per chain. Use to verify data freshness.

---

## SQL Implementation

### Step 1: Trace Attribution CTE

Given a list of contract addresses and a time filter, compute self-gas per contract per tx:

```sql
-- For each address: convert to unhex format for binary matching
-- e.g. address 0xAbC123... → unhex('abc123...')

trace_attribution AS (
  SELECT
    address,
    tx_hash,
    greatest(sum(received) - sum(given), 0) AS self_gas
  FROM (
    -- Leg 1: Gas RECEIVED by the contract (traces where to=contract)
    SELECT
      lower(concat('0x', hex(tr.to))) AS address,
      tr.tx_hash AS tx_hash,
      toInt64(tr.gas_used) AS received,
      0 AS given
    FROM raw_traces tr
    WHERE tr.chain_id = 43114
      AND tr.to IN (unhex('addr1'), unhex('addr2'), ...)
      AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
      AND tr.block_time >= '{startDate}'
      AND tr.block_time < '{endDate}' + INTERVAL 1 DAY

    UNION ALL

    -- Leg 2: Gas GIVEN AWAY by the contract (traces where from=contract)
    SELECT
      lower(concat('0x', hex(tr.from))) AS address,
      tr.tx_hash AS tx_hash,
      0 AS received,
      toInt64(tr.gas_used) AS given
    FROM raw_traces tr
    WHERE tr.chain_id = 43114
      AND tr.from IN (unhex('addr1'), unhex('addr2'), ...)
      AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
      AND tr.block_time >= '{startDate}'
      AND tr.block_time < '{endDate}' + INTERVAL 1 DAY
  )
  GROUP BY address, tx_hash
  HAVING self_gas > 0
)
```

### Step 2: AVAX/USD Price CTE (Optional — for USD values)

Derives hourly AVAX price from Trader Joe V1 + Pangolin USDC/WAVAX Swap events on `raw_logs`:

```sql
swap_prices AS (
  SELECT
    toStartOfHour(block_time) as price_hour,
    median(
      toFloat64(
        reinterpretAsUInt256(reverse(substring(data, 33, 32)))
        + reinterpretAsUInt256(reverse(substring(data, 97, 32)))
      ) * 1e12
      / toFloat64(
        reinterpretAsUInt256(reverse(substring(data, 1, 32)))
        + reinterpretAsUInt256(reverse(substring(data, 65, 32)))
      )
    ) as price_usd
  FROM raw_logs
  WHERE chain_id = 43114
    AND topic0 = unhex('d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822')
    AND address IN (
      unhex('f4003f4efbe8691b60249e6afbd307abe7758adb'),  -- Trader Joe V1 USDC/WAVAX
      unhex('0e0100ab771e9288e0aa97e11557e6654c3a9665')   -- Pangolin USDC/WAVAX
    )
    AND length(data) >= 128
    AND (reinterpretAsUInt256(reverse(substring(data, 1, 32)))
        + reinterpretAsUInt256(reverse(substring(data, 65, 32)))) > 0
    AND block_time >= '{startDate}'
    AND block_time < '{endDate}' + INTERVAL 1 DAY
  GROUP BY price_hour
  HAVING price_usd > 0 AND price_usd < 100000
)
```

The `data` field decodes Uniswap V2 `Swap(address,uint256,uint256,uint256,uint256)` event:
- bytes 1-32: amount0In (USDC, 6 decimals)
- bytes 33-64: amount1In (WAVAX, 18 decimals)
- bytes 65-96: amount0Out (USDC)
- bytes 97-128: amount1Out (WAVAX)
- Price = (amount1In + amount1Out) * 1e12 / (amount0In + amount0Out) → gives AVAX/USD

### Step 3: Join traces with tx-level gas_price for AVAX burned

```sql
WITH
  {swap_prices_cte},
  {trace_attribution_cte}
SELECT
  ta.address,
  count(DISTINCT ta.tx_hash) as tx_count,
  sum(ta.self_gas) as total_self_gas,
  sum(toFloat64(ta.self_gas) * toFloat64(t.gas_price)) / 1e18 as self_avax_burned,
  sum(toFloat64(ta.self_gas) * toFloat64(t.gas_price) / 1e18
      * coalesce(p.price_usd, 0)) as self_avax_burned_usd,
  uniqExact(t.from) as unique_senders
FROM trace_attribution ta
JOIN raw_txs t ON ta.tx_hash = t.hash
  AND t.chain_id = 43114
  AND t.block_time >= '{startDate}'
  AND t.block_time < '{endDate}' + INTERVAL 1 DAY
LEFT JOIN swap_prices p ON toStartOfHour(t.block_time) = p.price_hour
GROUP BY ta.address
ORDER BY self_avax_burned DESC
```

**IMPORTANT**: The `t.block_time` filter on the JOIN is required — without it ClickHouse scans all of `raw_txs` and OOMs (~54GB memory limit).

### Step 4: Total Chain Gas (for coverage %)

```sql
SELECT
  count() as total_tx,
  sum(gas_used) as total_gas,
  sum(toFloat64(gas_used) * toFloat64(gas_price)) / 1e18 as total_burned
FROM raw_txs
WHERE chain_id = 43114
  AND block_time >= '{startDate}'
  AND block_time < '{endDate}' + INTERVAL 1 DAY
```

---

## API Endpoint Spec

### `GET /api/chain-stats`

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | `YYYY-MM-DD` | Yes* | Start of range (inclusive) |
| `endDate` | `YYYY-MM-DD` | Yes* | End of range (inclusive — query adds +1 day) |
| `days` | number | No | Fallback: sliding window from now(). Default 30, max 183 |
| `addresses` | string | No | Comma-separated contract addresses to query. If omitted, use a built-in registry |

*If both `startDate` and `endDate` are provided, they take precedence over `days`.

**Validation:** Date params must match `/^\d{4}-\d{2}-\d{2}$/` — only digits and hyphens reach the SQL.

**Response shape:**
```json
{
  "contracts": [
    {
      "address": "0x...",
      "txCount": 12345,
      "selfGas": 9876543,
      "selfAvaxBurned": 123.456,
      "selfAvaxBurnedUsd": 4567.89,
      "uniqueSenders": 789,
      "gasShare": 3.45
    }
  ],
  "coverage": {
    "totalChainTxs": 1000000,
    "totalChainGas": 500000000,
    "totalChainBurned": 24000.0,
    "taggedGasPercent": 73.8
  },
  "timeRange": "2026-01-01 to 2026-01-31",
  "lastUpdated": "2026-03-17T..."
}
```

---

## Known Issues & Caveats

1. **February AVAX burned discrepancy**: Our query returns ~14.6K for Feb 2026, Snowpeer shows ~24.9K. January and December match fine. Likely cause: `gas_price` field in `raw_txs` may not store `effectiveGasPrice` for all EIP-1559 transactions. **Needs investigation** — compare `raw_txs.gas_price` against RPC `eth_getTransactionReceipt.effectiveGasPrice` for sample February txs.

2. **Tx coverage >100%**: Expected when using traces — a single tx can attribute gas to multiple contracts, so `sum(contract_tx_counts) > total_chain_txs`. Use `count(DISTINCT tx_hash)` for accurate unique tx count.

3. **`uniqueSenders` overcounts across contracts**: If a sender interacts with multiple tracked contracts, they're counted once per contract. Sum across contracts ≠ total unique senders.

4. **Query performance**: The trace attribution query takes ~46 seconds for 30-day windows. Cache results aggressively (10 min recommended). The `t.block_time` filter on the `raw_txs` JOIN is critical to avoid OOM.

5. **DELEGATECALL exclusion**: Gas from DELEGATECALL traces stays attributed to the proxy/caller contract, not the implementation. This is intentional — the proxy is the "identity" of the protocol.

---

## Target Repos for Integration

- **Frontend**: https://github.com/ava-labs/avax-retro9000-frontend
- **Backend**: https://github.com/ava-labs/avax-retro9000-backend

Replace the existing AVAX burned endpoint URL in these repos to point to the new hosted endpoint.
