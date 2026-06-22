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
import { avalancheRPC, nAvaxToAvax } from '../rpc';
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
  if (/^[PX]-[a-z0-9]{2,}1[a-z0-9]{30,}$/i.test(value)) return 'pchain'; // P-/X-chain bech32 account
  if (/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value)) return 'subnet';
  return 'chain';
}

const KINDS = ['auto', 'address', 'contract', 'token', 'nft', 'transaction', 'subnet', 'validator', 'chain', 'pchain'] as const;
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

// Canonical primary-network blockchain IDs. P-Chain is the zero-ID (same on both networks).
const P_CHAIN_ID = '11111111111111111111111111111111LpoYY';
const X_CHAIN_ID: Record<Network, string> = {
  mainnet: '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM',
  fuji: '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm',
};
const PX_ADDRESS = /^[PX]-[a-z0-9]{2,}1[a-z0-9]{30,}$/i;
function pxNetwork(addr: string, fallback: Network): Network {
  const hrp = (addr.match(/^[PX]-([a-z0-9]+)1/i)?.[1] || '').toLowerCase();
  return hrp === 'fuji' ? 'fuji' : hrp === 'avax' ? 'mainnet' : fallback;
}
function stripChainPrefix(addr: string): string {
  return addr.replace(/^[PX]-/i, ''); // Glacier wants the bech32 part (avax1…/fuji1…)
}
/** Glacier returns an address-metadata body for EOAs too (ercType UNKNOWN); only a real signal means it is a contract. */
function isRealContract(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  const erc = typeof m.ercType === 'string' ? m.ercType : '';
  return (!!erc && erc !== 'UNKNOWN') || !!m.deploymentDetails || !!m.name || !!m.symbol;
}

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
        const [chains, native, erc20, recentTx, contractMeta] = await Promise.all([
          glacierFetch<unknown>(`/v1/address/${addr}/chains`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/balances:getNative`).catch(() => null),
          fetchErc20Balances(chainId, addr).then((r) => r.erc20TokenBalances).catch(() => []),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/transactions`, { pageSize: '5' }).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}`).catch(() => null), // contract metadata; null for an EOA
        ]);
        const realContract = isRealContract(contractMeta);
        const out: Record<string, unknown> = { kind: 'address', address: addr, chainId, network, isContract: realContract, contractInfo: realContract ? contractMeta : undefined, chainsTouched: chains, nativeBalance: native, erc20Balances: erc20, recentTransactions: recentTx };
        if (include.includes('nfts')) {
          out.collectibles = await glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/balances:listCollectibles`).catch(() => null);
        }
        return json(out);
      }
      case 'contract':
      case 'token': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const [meta, deployment, recentTransfers] = await Promise.all([
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/contracts/${addr}/transactions:getDeployment`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/tokens/${addr}/transfers`, { pageSize: '5' }).catch(() => null),
        ]);
        return json({ kind, address: addr, chainId, metadata: meta, deployment, recentTransfers });
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
      case 'pchain': {
        // P-/X-chain bech32 account. Infer network from the HRP (avax=mainnet, fuji=fuji).
        const hrp = (value.match(/^[PX]-([a-z0-9]+)1/i)?.[1] || '').toLowerCase();
        const net: Network = hrp === 'fuji' ? 'fuji' : hrp === 'avax' ? 'mainnet' : network;
        if (/^X-/i.test(value)) {
          const balances = await glacierFetch<unknown>(
            `/v1/networks/${net}/blockchains/${X_CHAIN_ID[net]}/balances`,
            { addresses: stripChainPrefix(value) }
          ).catch(() => null);
          return json({
            kind: 'xchain-address',
            address: value,
            network: net,
            balances,
            note: balances ? undefined : 'No X-Chain balance data returned for this address.',
          });
        }
        const bal = (await avalancheRPC(net, 'pchain', 'platform.getBalance', { addresses: [value] })) as Record<string, unknown>;
        const toAvax = (v: unknown) => (typeof v === 'string' ? nAvaxToAvax(v) : undefined);
        return json({
          kind: 'pchain-address',
          address: value,
          network: net,
          balanceAvax: toAvax(bal.balance),
          unlockedAvax: toAvax(bal.unlocked),
          lockedStakeableAvax: toAvax(bal.lockedStakeable),
          utxoCount: Array.isArray(bal.utxoIDs) ? (bal.utxoIDs as unknown[]).length : undefined,
          raw: bal,
          note: 'P-Chain account. For validator/subnet/UTXO detail use platform_get_current_validators / platform_get_subnets / platform_get_utxos.',
        });
      }
      case 'chain': {
        // Resolve a chain by numeric id, blockchainId, or (fuzzy) name via the Glacier chain list.
        const list = await withCache(`mcp:chains:${network}`, CACHE_TTL.CHAINS, () =>
          glacierFetch<{ chains?: Array<Record<string, unknown>> }>(`/v1/chains`, { network })
        );
        const chains = list.chains || [];
        const needle = value.toLowerCase().trim();
        const nameOf = (c: Record<string, unknown>) => String(c.chainName || '').toLowerCase();
        const match =
          chains.find((c) => String(c.chainId) === value || String(c.blockchainId || '') === value) ||
          chains.find((c) => nameOf(c) === needle) ||
          chains.find((c) => nameOf(c).startsWith(needle)) ||
          chains.find((c) => nameOf(c).includes(needle));
        const candidates = match ? undefined : chains.filter((c) => nameOf(c).includes(needle)).slice(0, 5);
        return json({ kind: 'chain', query: value, network, match: match ?? null, candidates });
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
  let scope = getString(args, 'scope');
  if (!scope) scope = getString(args, 'value') ? 'address' : 'chain'; // forgiving default
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return errorResult(`Error: scope must be one of: ${SCOPES.join(', ')}.`);
  }
  const feed = getString(args, 'feed', 'transactions');
  const network = getNetwork(args);

  try {
    // P-/X-chain account activity — Glacier primary network (address filter + time window).
    // Handles "what did P-avax1… do in the last N hours" (fractional hours OK).
    const pxValue = getString(args, 'value');
    if (PX_ADDRESS.test(pxValue)) {
      const net = pxNetwork(pxValue, network);
      const isX = /^X-/i.test(pxValue);
      const bcId = isX ? X_CHAIN_ID[net] : P_CHAIN_ID;
      const nowSec = Math.floor(Date.now() / 1000);
      const params: Record<string, string> = {
        pageSize: String(clampLimit(args.pageSize, 100, 25)),
        addresses: stripChainPrefix(pxValue),
      };
      const h = Number(args.hours);
      if (Number.isFinite(h) && h > 0) {
        params.startTimestamp = String(nowSec - Math.floor(Math.min(h, 24 * 90) * 3600));
        params.endTimestamp = String(nowSec);
      } else {
        if (args.fromTimestamp) params.startTimestamp = String(Number(args.fromTimestamp));
        if (args.toTimestamp) params.endTimestamp = String(Number(args.toTimestamp));
      }
      const result = await glacierFetch<unknown>(`/v1/networks/${net}/blockchains/${bcId}/transactions`, params);
      return json({
        source: 'glacier',
        scope: 'primary',
        chain: isX ? 'X-Chain' : 'P-Chain',
        network: net,
        address: pxValue,
        windowHours: Number.isFinite(h) && h > 0 ? h : undefined,
        result,
      });
    }

    // EVM time-windowed activity. Prefer ClickHouse (timestamped raw_txs) — return a
    // COUNT over the window so "last N hours" is meaningful, plus a recent sample. If
    // ClickHouse is unavailable (CLICKHOUSE_URL unset, or an outage), fall back to
    // Glacier latest so the tool still answers (the time window is not applied there).
    if ((scope === 'chain' || scope === 'address') && feed === 'transactions') {
      const cid = assertChainId(getChainId(args));
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 2), 24 * 30);
      const limit = clampLimit(args.pageSize, 100, 25);
      const addrHex = scope === 'address' ? toSafeHexAddr(getString(args, 'value')) : '';
      const addrClause = addrHex ? ` AND (\`from\` = unhex('${addrHex}') OR to = unhex('${addrHex}'))` : '';
      try {
        const where = `chain_id = ${cid} AND block_time >= now() - INTERVAL ${hours} HOUR${addrClause}`;
        const [countRow] = await chSelect<{ n: number }>(`SELECT count() AS n FROM raw_txs WHERE ${where}`);
        const sample = await chSelect(
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
          txCountInWindow: Number(countRow?.n ?? sample.length),
          sampleSize: sample.length,
          ...(isFrozenChain(cid) ? { note: 'chain_id 43113 (Fuji) ingestion is frozen — counts may be stale' } : {}),
          sampleTransactions: sample,
        });
      } catch {
        // ClickHouse unavailable → Glacier fallback (latest; time window NOT applied).
        const chainSeg = safeChainSeg(String(cid));
        const pageSize = String(limit);
        if (scope === 'address') {
          const addr = safeAddr(getString(args, 'value'));
          const result = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/addresses/${addr}/transactions`, { pageSize });
          return json({ source: 'glacier-fallback', scope, chainId: chainSeg, address: addr, note: 'ClickHouse unavailable — latest transactions from Glacier; the time window was NOT applied.', result });
        }
        const result = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/transactions`, { pageSize });
        return json({ source: 'glacier-fallback', scope: 'chain', chainId: chainSeg, note: 'ClickHouse unavailable — latest chain transactions from Glacier; the time window was NOT applied.', result });
      }
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
      try {
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
      } catch {
        // ClickHouse unavailable → Glacier latest-block snapshot (no time-window aggregation).
        const chainSeg = safeChainSeg(String(cid));
        const latest = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/blocks`, { pageSize: '1' }).catch(() => null);
        return json({ source: 'glacier-fallback', target: 'chain', chainId: chainSeg, note: 'ClickHouse unavailable — latest-block snapshot from Glacier (no time-window aggregation).', latestBlock: latest });
      }
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
        'Resolve and describe any on-chain identifier in one call: an EVM address (native + token balances, recent txs, and contract metadata + isContract if it is a contract), a contract/token (metadata + deployment + recent transfers), an NFT (collection + tokenId), a tx hash, a subnet ID, a NodeID validator, a P-/X-Chain account (P-…/X-… → P-Chain balance), or a chain name/id. `kind` defaults to auto-detect; network is inferred from P-/X-Chain address prefixes. Backed by Glacier + P-Chain RPC.',
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
        'Time-windowed on-chain activity. scope=chain/address returns the transaction COUNT over the last `hours` plus a recent sample (indexed raw-tx store; auto-falls back to Glacier latest if that store is unavailable). For a token/contract address use scope=token to get its transfers; scope=primary covers P/X-chain (native timestamps). If you pass a value with no scope, it defaults to address.',
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
