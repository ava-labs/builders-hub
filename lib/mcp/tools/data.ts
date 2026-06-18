/**
 * On-chain data tool domain (consolidated).
 *
 * Three parameterized tools replace the eight PR-#4302 data/stats tools:
 *  - onchain_lookup   — resolve any identifier (address / contract / token / NFT /
 *                       tx / subnet / validator / chain) via the indexed Glacier API.
 *  - onchain_activity — time-windowed feeds ("what happened in the last N hours");
 *                       EVM activity from ClickHouse (raw_txs), P-chain + asset
 *                       transfers from Glacier.
 *  - chain_stats      — chain/contract metrics from ClickHouse (raw_txs aggregation),
 *                       P-chain validator snapshot from Glacier.
 *
 * Backend split: ClickHouse (raw_txs) has timestamped EVM flow events — ideal for
 * "last N hours" windows and chain throughput. Glacier has current state / enriched
 * metadata (balances, NFTs, contract ABIs, subnets, validators). ClickHouse access
 * goes through ./lib/clickhouse-safe (read-only, validated-params-only, no raw SQL).
 */

import { glacierFetch, fetchErc20Balances } from '@/lib/rwa/glacier/client';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';
import {
  chSelect,
  assertChainId,
  toSafeHexAddr,
  assertSafeHours,
  assertSafeDays,
  clampLimit,
  isFrozenChain,
} from './lib/clickhouse-safe';

const C_CHAIN_ID: Record<Network, string> = { mainnet: '43114', fuji: '43113' };

function getNetwork(args: Record<string, unknown>): Network {
  return args.network === 'fuji' ? 'fuji' : 'mainnet';
}

/** EVM chainId as a string for Glacier paths: explicit arg wins, else C-Chain. */
function getChainId(args: Record<string, unknown>): string {
  const explicit = typeof args.chainId === 'string' && args.chainId.trim() ? args.chainId.trim() : '';
  if (typeof args.chainId === 'number') return String(Math.floor(args.chainId));
  return explicit || C_CHAIN_ID[getNetwork(args)];
}

function getString(args: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof args[key] === 'string' && (args[key] as string).trim() ? (args[key] as string).trim() : fallback;
}

function json(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'On-chain request failed';
}

// --- Glacier path-segment validators (no path-traversal / SSRF) -------------
function safeAddr(v: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error('invalid EVM address (0x + 40 hex)');
  return v.toLowerCase();
}
function safeTxHash(v: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error('invalid tx hash (0x + 64 hex)');
  return v.toLowerCase();
}
function safeId(v: string): string {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(v)) throw new Error('invalid id');
  return v;
}
function safeChainSeg(v: string): string {
  if (!/^\d{1,12}$/.test(v)) throw new Error('invalid chainId');
  return v;
}

function detectKind(value: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return 'address';
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return 'transaction';
  if (/^NodeID-/i.test(value)) return 'validator';
  if (/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value)) return 'subnet';
  return 'chain';
}

const KINDS = ['auto', 'address', 'contract', 'token', 'nft', 'transaction', 'subnet', 'validator', 'chain'] as const;
const SCOPES = ['address', 'chain', 'token', 'contract', 'primary'] as const;
const FEEDS = ['transactions', 'transfers', 'erc20Transfers', 'nftTransfers'] as const;
const TARGETS = ['chain', 'contract', 'network'] as const;
const WINDOWS = ['series', 'recent'] as const;
const TIME_INTERVALS = ['hour', 'day', 'week', 'month'] as const;
const BUCKET_FN: Record<string, string> = {
  hour: 'toStartOfHour',
  day: 'toStartOfDay',
  week: 'toStartOfWeek',
  month: 'toStartOfMonth',
};

// ---------------------------------------------------------------------------
// onchain_lookup
// ---------------------------------------------------------------------------

async function onchainLookup(args: Record<string, unknown>): Promise<ToolResult> {
  const value = getString(args, 'value');
  if (!value) return errorResult('Error: value is required');
  const network = getNetwork(args);
  let kind = getString(args, 'kind', 'auto');
  if (kind === 'auto') kind = detectKind(value);

  try {
    switch (kind) {
      case 'address': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const include = Array.isArray(args.include) ? (args.include as unknown[]).map(String) : ['balances'];
        const [chains, native, erc20] = await Promise.all([
          glacierFetch<unknown>(`/v1/address/${addr}/chains`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/balances:getNative`).catch(() => null),
          fetchErc20Balances(chainId, addr).then((r) => r.erc20TokenBalances).catch(() => []),
        ]);
        const out: Record<string, unknown> = { kind: 'address', address: addr, chainId, network, chainsTouched: chains, nativeBalance: native, erc20Balances: erc20 };
        if (include.includes('nfts')) {
          out.collectibles = await glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/balances:listCollectibles`).catch(() => null);
        }
        return json(out);
      }
      case 'contract':
      case 'token': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const [meta, deployment] = await Promise.all([
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/contracts/${addr}/transactions:getDeployment`).catch(() => null),
        ]);
        return json({ kind, address: addr, chainId, metadata: meta, deployment });
      }
      case 'nft': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const tokenId = getString(args, 'tokenId');
        const path = tokenId
          ? `/v1/chains/${chainId}/nfts/collections/${addr}/tokens/${safeId(tokenId)}`
          : `/v1/chains/${chainId}/nfts/collections/${addr}/tokens`;
        const result = await glacierFetch<unknown>(path, tokenId ? {} : { pageSize: '10' });
        return json({ kind: 'nft', collection: addr, chainId, tokenId: tokenId || undefined, result });
      }
      case 'transaction': {
        const hash = safeTxHash(value);
        const chainId = safeChainSeg(getChainId(args));
        const result = await glacierFetch<unknown>(`/v1/chains/${chainId}/transactions/${hash}`);
        return json({ kind: 'transaction', txHash: hash, chainId, result });
      }
      case 'subnet': {
        const subnetId = safeId(value);
        const result = await withCache(`mcp:subnet:${network}:${subnetId}`, CACHE_TTL.CHAINS, () =>
          glacierFetch<unknown>(`/v1/networks/${network}/subnets/${subnetId}`)
        );
        return json({ kind: 'subnet', subnetId, network, result });
      }
      case 'validator': {
        const nodeId = safeId(value);
        const result = await glacierFetch<unknown>(`/v1/networks/${network}/validators/${nodeId}`);
        return json({ kind: 'validator', nodeId, network, result });
      }
      case 'chain': {
        // Resolve a chain by name or numeric id via the Glacier chain list.
        const list = await withCache(`mcp:chains:${network}`, CACHE_TTL.CHAINS, () =>
          glacierFetch<{ chains?: Array<Record<string, unknown>> }>(`/v1/chains`, { network })
        );
        const needle = value.toLowerCase();
        const match = (list.chains || []).find(
          (c) => String(c.chainId) === value || String(c.chainName || '').toLowerCase() === needle
        );
        return json({ kind: 'chain', query: value, network, match: match ?? null });
      }
      default:
        return errorResult(`Unknown kind "${kind}". One of: ${KINDS.join(', ')}.`);
    }
  } catch (err) {
    return errorResult(asMessage(err));
  }
}

// ---------------------------------------------------------------------------
// onchain_activity
// ---------------------------------------------------------------------------

async function onchainActivity(args: Record<string, unknown>): Promise<ToolResult> {
  const scope = getString(args, 'scope');
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return errorResult(`Error: scope is required (one of: ${SCOPES.join(', ')}).`);
  }
  const feed = getString(args, 'feed', 'transactions');
  const network = getNetwork(args);

  try {
    // ClickHouse — EVM raw transactions, time-windowed ("last N hours on chain X").
    if ((scope === 'chain' || scope === 'address') && feed === 'transactions') {
      const cid = assertChainId(getChainId(args));
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 2), 24 * 30);
      const limit = clampLimit(args.pageSize, 100, 25);
      let where = `chain_id = ${cid} AND block_time >= now() - INTERVAL ${hours} HOUR`;
      if (scope === 'address') {
        const addr = toSafeHexAddr(getString(args, 'value'));
        where += ` AND (\`from\` = unhex('${addr}') OR to = unhex('${addr}'))`;
      }
      const rows = await chSelect(
        `SELECT lower(concat('0x', hex(hash))) AS hash, toUnixTimestamp(block_time) AS timestamp, ` +
          `lower(concat('0x', hex(\`from\`))) AS \`from\`, lower(concat('0x', hex(to))) AS \`to\`, ` +
          `toString(gas_used) AS gasUsed, toString(gas_price) AS gasPrice ` +
          `FROM raw_txs WHERE ${where} ORDER BY block_time DESC LIMIT ${limit}`
      );
      return json({
        source: 'clickhouse',
        scope,
        chainId: cid,
        windowHours: hours,
        count: rows.length,
        ...(isFrozenChain(cid) ? { note: 'chain_id 43113 (Fuji) has a frozen ingestion watermark — counts may be stale' } : {}),
        transactions: rows,
      });
    }

    // Glacier — P/X-chain primary network feed (native timestamp filtering).
    if (scope === 'primary') {
      const blockchainId = safeId(getString(args, 'blockchainId'));
      const params: Record<string, string> = { pageSize: String(clampLimit(args.pageSize, 100, 25)) };
      if (args.fromTimestamp) params.startTimestamp = String(Number(args.fromTimestamp));
      if (args.toTimestamp) params.endTimestamp = String(Number(args.toTimestamp));
      const result = await glacierFetch<unknown>(`/v1/networks/${network}/blockchains/${blockchainId}/transactions`, params);
      return json({ source: 'glacier', scope, network, blockchainId, result });
    }

    // Glacier — asset transfer feeds (ERC-20 / NFT) and token-contract transfers.
    const chainId = safeChainSeg(getChainId(args));
    const pageSize = String(clampLimit(args.pageSize, 100, 25));
    if (scope === 'token' || scope === 'contract') {
      const addr = safeAddr(getString(args, 'value'));
      const result = await glacierFetch<unknown>(`/v1/chains/${chainId}/tokens/${addr}/transfers`, { pageSize });
      return json({ source: 'glacier', scope, chainId, address: addr, result });
    }
    // scope=address with an asset-transfer feed
    const addr = safeAddr(getString(args, 'value'));
    const endpoint = feed === 'nftTransfers' ? 'transactions:listErc721' : 'transactions:listErc20';
    const result = await glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/${endpoint}`, { pageSize });
    return json({ source: 'glacier', scope, feed, chainId, address: addr, result });
  } catch (err) {
    return errorResult(asMessage(err));
  }
}

// ---------------------------------------------------------------------------
// chain_stats
// ---------------------------------------------------------------------------

async function chainStats(args: Record<string, unknown>): Promise<ToolResult> {
  const target = getString(args, 'target', 'chain');
  const network = getNetwork(args);

  try {
    if (target === 'chain') {
      const cid = assertChainId(getChainId(args));
      const window = getString(args, 'window', 'recent');
      if (window === 'series') {
        const days = assertSafeDays(typeof args.days === 'number' ? args.days : Number(args.days || 30), 365);
        const interval = getString(args, 'timeInterval', 'day');
        const bucket = BUCKET_FN[interval] || 'toStartOfDay';
        const rows = await chSelect(
          `SELECT toUnixTimestamp(${bucket}(block_time)) AS bucket, count() AS txCount, ` +
            `toString(sum(gas_used)) AS gasUsed, sum(toFloat64(gas_used)*toFloat64(gas_price))/1e18 AS feesPaidAvax, ` +
            `uniqExact(\`from\`) AS activeSenders FROM raw_txs WHERE chain_id = ${cid} ` +
            `AND block_time >= now() - INTERVAL ${days} DAY GROUP BY bucket ORDER BY bucket`
        );
        return json({
          source: 'clickhouse',
          target,
          chainId: cid,
          timeInterval: interval,
          days,
          ...(isFrozenChain(cid) ? { note: 'Fuji (43113) ingestion is frozen — series may be stale' } : {}),
          series: rows,
        });
      }
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 24), 24 * 30);
      const rows = await chSelect(
        `SELECT count() AS txCount, toString(sum(gas_used)) AS gasUsed, ` +
          `sum(toFloat64(gas_used)*toFloat64(gas_price))/1e18 AS feesPaidAvax, ` +
          `uniqExact(\`from\`) AS activeSenders, round(avg(toFloat64(gas_price))) AS avgGasPrice ` +
          `FROM raw_txs WHERE chain_id = ${cid} AND block_time >= now() - INTERVAL ${hours} HOUR`
      );
      return json({
        source: 'clickhouse',
        target,
        chainId: cid,
        windowHours: hours,
        ...(isFrozenChain(cid) ? { note: 'Fuji (43113) ingestion is frozen — counts may be stale' } : {}),
        metrics: rows[0] ?? {},
      });
    }

    if (target === 'contract') {
      const cid = assertChainId(getChainId(args));
      const addr = toSafeHexAddr(getString(args, 'value') || getString(args, 'contract'));
      const days = assertSafeDays(typeof args.days === 'number' ? args.days : Number(args.days || 30), 365);
      const rows = await chSelect(
        `SELECT count() AS txCount, uniqExact(\`from\`) AS uniqueSenders, toString(sum(gas_used)) AS gasUsed ` +
          `FROM raw_txs WHERE chain_id = ${cid} AND to = unhex('${addr}') AND block_time >= now() - INTERVAL ${days} DAY`
      );
      return json({ source: 'clickhouse', target, chainId: cid, contract: `0x${addr}`, days, stats: rows[0] ?? {} });
    }

    // target === 'network' → Glacier P-chain validator snapshot (ClickHouse holds EVM data only).
    const result = await glacierFetch<unknown>(`/v1/networks/${network}/validators`, { pageSize: '100' });
    return json({
      source: 'glacier',
      target: 'network',
      network,
      note: 'P-chain validator/delegator metrics are a current snapshot — ClickHouse holds EVM data only, so no historical P-chain time-series here.',
      result,
    });
  } catch (err) {
    return errorResult(asMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Tool domain
// ---------------------------------------------------------------------------

export const dataTools: ToolDomain = {
  tools: [
    {
      name: 'onchain_lookup',
      description:
        'Resolve and describe any on-chain identifier in one call: paste an EVM address (balances + tokens, optional NFTs), a contract/token address (metadata + deployment), an NFT (collection + tokenId), a tx hash, a subnet ID, a NodeID validator, or a chain name/id. `kind` defaults to auto-detect. Indexed (Glacier) — fast, historical, no rate limiting.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'The identifier: 0x address / 0x tx hash / NodeID-… / subnetId / chain name or id' },
          kind: { type: 'string', enum: [...KINDS], description: 'Entity kind (default: auto-detect from value)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          chainId: { type: 'string', description: 'EVM chain ID for EVM kinds (default: C-Chain for the network)' },
          tokenId: { type: 'string', description: 'NFT token ID (kind=nft)' },
          include: { type: 'array', items: { type: 'string', enum: ['balances', 'nfts'] }, description: 'Extra data for an address (e.g. ["nfts"])' },
        },
        required: ['value'],
      },
    },
    {
      name: 'onchain_activity',
      description:
        'Time-windowed on-chain activity feed — answers "what happened on chain X in the last N hours" and address/contract/token history. EVM transaction feeds come from the indexed raw-tx store (ClickHouse, timestamped); P/X-chain (scope=primary) and ERC-20/NFT transfer feeds come from Glacier. Paginated.',
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: [...SCOPES], description: 'address | chain | token | contract | primary' },
          value: { type: 'string', description: 'Address/contract/token (omit for scope=chain)' },
          feed: { type: 'string', enum: [...FEEDS], description: 'transactions (default) | transfers | erc20Transfers | nftTransfers' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the network)' },
          blockchainId: { type: 'string', description: 'Blockchain ID (required for scope=primary)' },
          hours: { type: 'number', description: 'Look-back window in hours for EVM transaction feeds (default: 2 for chain, max 720)' },
          fromTimestamp: { type: 'number', description: 'Unix start time (scope=primary)' },
          toTimestamp: { type: 'number', description: 'Unix end time (scope=primary)' },
          pageSize: { type: 'number', minimum: 1, maximum: 100, description: 'Max rows (default: 25)' },
        },
        required: ['scope'],
      },
    },
    {
      name: 'chain_stats',
      description:
        'On-chain statistics. target=chain: tx count, gas used, fees, active senders, avg gas price over a recent window or as a time-series (from ClickHouse raw_txs). target=contract: per-contract tx/sender/gas totals. target=network: current P-chain validator snapshot (Glacier). No external metrics API.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: [...TARGETS], description: 'chain (default) | contract | network' },
          window: { type: 'string', enum: [...WINDOWS], description: 'chain: recent aggregate (default) or series' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the network)' },
          value: { type: 'string', description: 'Contract address (target=contract)' },
          timeInterval: { type: 'string', enum: [...TIME_INTERVALS], description: 'Bucket size for window=series (default: day)' },
          hours: { type: 'number', description: 'Look-back hours for window=recent (default: 24, max 720)' },
          days: { type: 'number', description: 'Look-back days for series / contract (default: 30, max 365)' },
          network: { type: 'string', enum: ['mainnet', 'fuji'], description: 'Network (default: mainnet)' },
        },
        required: [],
      },
    },
  ],

  handlers: {
    onchain_lookup: onchainLookup,
    onchain_activity: onchainActivity,
    chain_stats: chainStats,
  },
};
