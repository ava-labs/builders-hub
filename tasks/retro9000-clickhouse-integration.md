# Retro9000 — Replace Solokhin with ClickHouse Trace-Based Gas Attribution

## Overview

The Retro9000 program ranks projects by `leaderboard_points = avax_burned × age_multiplier × category_multiplier`. Currently, `avax_burned` comes from the **Solokhin API** (`idx6.solokhin.com`). We're replacing it with **direct ClickHouse queries** using trace-based gas attribution for more accurate per-contract AVAX burned values.

## Architecture (Current → New)

```
CURRENT:
  Frontend → Backend API → Solokhin API → returns avax_burned per contract

NEW:
  Frontend → Backend API → ClickHouse  → trace-based self_avax_burned per contract
```

---

## Frontend (`avax-retro9000-frontend`)

### Changes: NONE

The frontend does not calculate or fetch gas data directly. It receives `project.metrics.avax_burned` from the backend API and displays it. The response shape from the backend stays identical, so **zero frontend changes are needed**.

Key files that remain untouched:
- `src/app/types/entity.ts` — `ContractMetrics` interface (same fields)
- `src/app/(modules)/leaderboard/component/LeaderBoard/LeaderBoardTableBody.tsx` — displays `avax_burned`
- `src/app/services/` — API calls to backend (same endpoints)

---

## Backend (`avax-retro9000-backend`)

### Changes: 3 files modified, 1 file added

### Step 1: Add environment variables

Add to `.env`:

```env
# ClickHouse (replaces Solokhin for contract gas metrics)
CLICKHOUSE_PROXY_URL=https://your-clickhouse-proxy.avax.network
CLICKHOUSE_USER=readonly
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DATABASE=default
```

The old Solokhin vars can be removed or left as dead config:
```env
# No longer used:
# CONTRACT_STATS_API_URL=https://idx6.solokhin.com/api
# CONTRACT_STATS_API_KEY=
```

### Step 2: Create `src/common/services/clickhouse.service.ts` (NEW FILE)

This is the ClickHouse client + trace attribution query. It accepts contract addresses and a time range, returns per-contract self-AVAX burned.

```typescript
import { Injectable, Logger } from '@nestjs/common';

const C_CHAIN_ID = 43114;

// Defense-in-depth: only exactly 40 lowercase hex chars reach the query.
// Prevents SQL injection even if caller forgets to validate.
function toSafeHex(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  if (!/^[a-f0-9]{40}$/.test(hex)) {
    throw new Error(`Invalid contract address: ${address}`);
  }
  return hex;
}

function buildAddressFilter(addresses: string[], column: string): string {
  if (addresses.length === 0) return '1=0';
  const safe = addresses.map(a => `unhex('${toSafeHex(a)}')`);
  return addresses.length === 1
    ? `${column} = ${safe[0]}`
    : `${column} IN (${safe.join(', ')})`;
}

export interface ContractGasStats {
  txCount: number;
  avaxBurned: number;
  uniqueSenders: number;
}

@Injectable()
export class ClickHouseService {
  private readonly logger = new Logger(ClickHouseService.name);
  private readonly url = process.env.CLICKHOUSE_PROXY_URL || '';
  private readonly user = process.env.CLICKHOUSE_USER || 'readonly';
  private readonly password = process.env.CLICKHOUSE_PASSWORD || '';
  private readonly database = process.env.CLICKHOUSE_DATABASE || 'default';

  private async query<T>(sql: string): Promise<{ data: T[] }> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': this.user,
        'X-ClickHouse-Key': this.password,
        'X-ClickHouse-Database': this.database,
      },
      body: `${sql} FORMAT JSON`,
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ClickHouse query failed: ${err}`);
    }
    return response.json();
  }

  /**
   * Self-AVAX Burned per contract using trace-based gas attribution.
   *
   * Algorithm ("received minus given"):
   *   For each contract in each tx:
   *     self_gas = max(0, gas_received_by_contract - gas_given_to_subcalls)
   *     self_avax_burned = self_gas × tx.gas_price / 1e18
   *
   * Why traces instead of tx.to?
   *   If you GROUP BY tx.to, aggregators (1inch, ParaSwap) get credited with ALL
   *   gas from transactions routed through them. Traces attribute gas to the
   *   contract that actually consumed it (e.g. the DEX, not the aggregator).
   *
   * Call type filtering:
   *   CALL, CREATE, CREATE2 — counted
   *   DELEGATECALL — excluded (gas stays with proxy contract)
   *   STATICCALL — excluded (read-only, gas counted in parent)
   *
   * @param addresses - Contract addresses (0x-prefixed hex strings)
   * @param tsFrom - Start of time range (unix seconds, inclusive)
   * @param tsTo - End of time range (unix seconds, inclusive — query adds +1 day)
   */
  async getContractStats(
    addresses: string[],
    tsFrom?: number,
    tsTo?: number,
  ): Promise<{
    perContract: Map<string, ContractGasStats>;
    totals: ContractGasStats;
  }> {
    if (addresses.length === 0) {
      return {
        perContract: new Map(),
        totals: { txCount: 0, avaxBurned: 0, uniqueSenders: 0 },
      };
    }

    // Validate all addresses upfront (throws on invalid)
    addresses.forEach(toSafeHex);

    // Build filters per table alias — no regex surgery on SQL strings
    const trToFilter = buildAddressFilter(addresses, 'tr.to');
    const trFromFilter = buildAddressFilter(addresses, 'tr.from');

    // Build time filters per table alias separately
    let trTimeFilter = '';
    let tTimeFilter = '';
    if (tsFrom && tsTo) {
      const startDate = new Date(tsFrom * 1000).toISOString().split('T')[0];
      const endDate = new Date(tsTo * 1000).toISOString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        throw new Error('Invalid timestamp range');
      }
      trTimeFilter = `AND tr.block_time >= '${startDate}' AND tr.block_time < '${endDate}' + INTERVAL 1 DAY`;
      tTimeFilter = `AND t.block_time >= '${startDate}' AND t.block_time < '${endDate}' + INTERVAL 1 DAY`;
    }

    const sql = `
      WITH trace_attribution AS (
        SELECT
          address,
          tx_hash,
          greatest(sum(received) - sum(given), 0) AS self_gas
        FROM (
          -- Leg 1: Gas RECEIVED by the contract (traces where to = contract)
          SELECT
            lower(concat('0x', hex(tr.to))) AS address,
            tr.tx_hash,
            toInt64(tr.gas_used) AS received,
            0 AS given
          FROM raw_traces tr
          WHERE tr.chain_id = ${C_CHAIN_ID}
            AND ${trToFilter}
            AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
            ${trTimeFilter}

          UNION ALL

          -- Leg 2: Gas GIVEN AWAY by the contract (traces where from = contract)
          SELECT
            lower(concat('0x', hex(tr.from))) AS address,
            tr.tx_hash,
            0 AS received,
            toInt64(tr.gas_used) AS given
          FROM raw_traces tr
          WHERE tr.chain_id = ${C_CHAIN_ID}
            AND ${trFromFilter}
            AND tr.call_type IN ('CALL', 'CREATE', 'CREATE2')
            ${trTimeFilter}
        )
        GROUP BY address, tx_hash
        HAVING self_gas > 0
      )
      SELECT
        ta.address,
        count(DISTINCT ta.tx_hash) as tx_count,
        sum(toFloat64(ta.self_gas) * toFloat64(t.gas_price)) / 1e18 as avax_burned,
        uniqExact(t.from) as unique_senders
      FROM trace_attribution ta
      JOIN raw_txs t ON ta.tx_hash = t.hash
        AND t.chain_id = ${C_CHAIN_ID}
        ${tTimeFilter}
      GROUP BY ta.address
      ORDER BY avax_burned DESC
    `;

    this.logger.debug(`Querying ClickHouse for ${addresses.length} contracts`);
    const result = await this.query<{
      address: string;
      tx_count: string;
      avax_burned: number;
      unique_senders: string;
    }>(sql);

    const perContract = new Map<string, ContractGasStats>();
    let totalTx = 0;
    let totalBurned = 0;
    let totalSenders = 0;

    for (const row of result.data) {
      const stats: ContractGasStats = {
        txCount: parseInt(row.tx_count) || 0,
        avaxBurned: row.avax_burned || 0,
        uniqueSenders: parseInt(row.unique_senders) || 0,
      };
      perContract.set(row.address.toLowerCase(), stats);
      totalTx += stats.txCount;
      totalBurned += stats.avaxBurned;
      totalSenders += stats.uniqueSenders;
      // Note: totalSenders overcounts when users interact with multiple
      // contracts. For deduplicated count, run a separate query.
    }

    return {
      perContract,
      totals: { txCount: totalTx, avaxBurned: totalBurned, uniqueSenders: totalSenders },
    };
  }
}
```

### Step 3: Register `ClickHouseService` in the NestJS module

In the module that provides `ContractStatsService` (likely `submissions.module.ts` or `app.module.ts`):

```typescript
import { ClickHouseService } from '../common/services/clickhouse.service';

@Module({
  providers: [
    ClickHouseService,
    ContractStatsService,
    // ... other existing providers
  ],
  exports: [ClickHouseService],
})
```

### Step 4: Modify `src/submissions/contract-stats.service.ts`

Inject `ClickHouseService` and replace the Solokhin fetch.

**4a. Add the injection:**

```typescript
import { ClickHouseService } from '../common/services/clickhouse.service';

@Injectable()
export class ContractStatsService {
  constructor(
    private readonly clickHouseService: ClickHouseService,
    // ... keep all other existing constructor params
  ) {}
```

**4b. Replace the Solokhin call in the method that fetches stats for a project.**

The current code calls `fetchContractStatsWithTimeout()` which hits `idx6.solokhin.com` and returns:
- `transactions.totalGasCost` → stored as `avax_burned`
- `transactions.total` → stored as `transaction_count`
- `interactions.uniqueAddresses` → stored as `active_accounts`

Replace with:

```typescript
// BEFORE (Solokhin — multiple batches of 10, 15 concurrent):
// const response = await this.fetchContractStatsWithTimeout(batchAddresses, tsFrom, tsTo);
// avaxBurned += response.transactions.totalGasCost;
// txCount += response.transactions.total;
// activeAccounts += response.interactions.uniqueAddresses;

// AFTER (ClickHouse — single query, all contracts at once):
const result = await this.clickHouseService.getContractStats(
  allContractAddresses,   // string[] of all verified 0x addresses for this project
  round.tsFrom,           // unix timestamp (seconds) — round start
  round.tsTo,             // unix timestamp (seconds) — round end
);

const avaxBurned = result.totals.avaxBurned;
const txCount = result.totals.txCount;
const activeAccounts = result.totals.uniqueSenders;
```

**4c. Simplify batching:**

The Solokhin integration uses batches of 10 contracts with 15 concurrent requests to stay under rate limits. ClickHouse handles hundreds of addresses in a single `IN (...)` clause, so **batching can be removed entirely**. Just pass all of a project's verified contract addresses in one call.

If you want to keep batching as a safety net (e.g. projects with 500+ contracts), batch by ~100 addresses instead of 10.

**4d. Keep everything else unchanged:**

- Multiplier logic (`age_multiplier`, `category_multiplier`)
- `leaderboard_points = avax_burned × age_multiplier × category_multiplier`
- The upsert into `ProjectMetrics` table
- The rank recalculation SQL window function

### Step 5: Nothing else changes

These files are **untouched**:

| File | Why unchanged |
|------|---------------|
| `src/metrics/final-metrics.service.ts` | Calls `contractStatsService.getStatsForProject()` — same interface |
| `prisma/schema.prisma` | Same `ProjectMetrics` model, same fields |
| `src/cron/cron.service.ts` | Same cron triggers, calls same service methods |
| `src/auth/` | No auth changes |
| All frontend files | Frontend only displays `project.metrics.avax_burned` from API |

---

## ClickHouse Data Sources Reference

### Connection (HTTP API)
```
POST {CLICKHOUSE_PROXY_URL}
Headers:
  X-ClickHouse-User: {CLICKHOUSE_USER}
  X-ClickHouse-Key: {CLICKHOUSE_PASSWORD}
  X-ClickHouse-Database: {CLICKHOUSE_DATABASE}
Body: {SQL} FORMAT JSON
```

### Table: `raw_traces` (for gas attribution)
| Column | Type | Notes |
|--------|------|-------|
| `tx_hash` | FixedString(32) | Binary, match with `unhex('...')` |
| `from` | FixedString(20) | Trace caller (binary) |
| `to` | Nullable(FixedString(20)) | Trace callee (binary) |
| `gas_used` | UInt32 | Gas consumed by this trace |
| `call_type` | LowCardinality(String) | CALL/STATICCALL/DELEGATECALL/CREATE/CREATE2/SELFDESTRUCT |
| `block_time` | DateTime64 | Block timestamp |
| `chain_id` | UInt32 | 43114 for C-Chain |

### Table: `raw_txs` (for gas_price to convert gas → AVAX)
| Column | Type | Notes |
|--------|------|-------|
| `hash` | FixedString(32) | Binary tx hash |
| `from` | FixedString(20) | Sender |
| `gas_used` | UInt32 | Gas consumed |
| `gas_price` | UInt64 | Gas price in wei |
| `block_time` | DateTime64 | Block timestamp |
| `chain_id` | UInt32 | 43114 for C-Chain |

### Table: `sync_watermark` (optional — check data freshness)
```sql
SELECT block_number, block_time FROM sync_watermark WHERE chain_id = 43114
```

---

## Performance Notes

- Single query handles all of a project's contracts (~5-45s depending on date range and contract count)
- **CRITICAL**: The `t.block_time` filter on the `raw_txs` JOIN is required — without it ClickHouse scans the entire `raw_txs` table and hits the 54GB memory limit
- Consider caching results in Redis (already available in the backend) with ~10 min TTL
- No Solokhin rate limiting concerns — ClickHouse has no request rate limit, just memory limits per query

## Known Caveat

The `gas_price` field in `raw_txs` may not store the correct `effectiveGasPrice` for all EIP-1559 transactions. This was observed as a discrepancy in February 2026 data (14.6K vs expected 24.9K AVAX burned for the full chain). This does NOT affect relative ranking between projects (all use the same formula), but absolute AVAX burned values may be lower than external sources like Snowpeer for certain months. Under investigation.
