# Metrics API Migration

## Context

The EVM chain metrics endpoints (`chain-stats/[chainId]` and `overview-stats`) were migrated from `@avalanche-sdk/chainkit` (which proxied to `metrics.avax.network`) to direct HTTP calls against [ava-labs/metrics-api](https://github.com/ava-labs/metrics-api) — a Go service that computes metrics from ClickHouse.

**Endpoint**: `GET {METRICS_API_URL}/v2/chains/{chainId}/metrics/{metric}`

**Env var**: `METRICS_API_URL` (default: `https://44.221.18.159.sslip.io`)

## Migrated Routes

| Route | Status |
|-------|--------|
| `app/api/chain-stats/[chainId]/route.ts` | Migrated |
| `app/api/overview-stats/route.ts` | Migrated |
| `app/api/primary-network-stats/route.ts` | No change (staking metrics, not in new API) |
| `app/api/validator-stats/route.ts` | No change (explorer/discovery data) |

## Known Discrepancies (new API vs legacy)

| Metric | Status | Diff | Root Cause |
|--------|--------|------|------------|
| txCount | Exact | 0% | — |
| gasUsed | Exact | 0% | — |
| avgTps | Exact | 0% | — |
| maxTps | Exact | 0% | — |
| maxGps | Exact | 0% | — |
| avgGasPrice | Exact | 0% | — |
| maxGasPrice | Exact | 0% | — |
| feesPaid | Exact | 0% | — |
| contracts | Exact | 0% | — |
| deployers | Exact | 0% | — |
| cumulativeTxCount | ~Exact | 0.0003% | — |
| avgGps | Minor | 0.03% | New API uses fixed 86400s denominator; legacy uses actual block-time delta |
| activeAddresses | **~2x lower** | -50% | Legacy double-counts addresses across sources; new API correctly deduplicates |
| activeSenders | **~2x lower** | -50% | Same legacy double-counting bug |
| cumulativeDeployers | **~4x lower** | -75% | Legacy uses running sum of daily counts; new API uses true unique from genesis |
| cumulativeContracts | Minor | 3.4% | Small cumulative drift over chain lifetime |
| feesPaidUsd | New metric | N/A | Added in new API (C-Chain only), not in legacy |
| validatorCount | Not available | N/A | Stub endpoint — still using legacy `metrics.avax.network` |

## What Changed

- Removed `@avalanche-sdk/chainkit` import and `Avalanche` client instantiation
- Removed `METRICS_BYPASS_TOKEN` / `rltoken` rate-limit bypass logic (new API has no rate limiting)
- Added `fetchMetricsApi()` helper with pagination support (`nextPageToken`)
- `chainId === "all"` maps to `"mainnet"` (same behavior as before)
- `getValidatorCount()` still hits `metrics.avax.network` (see TODO in code)
