/**
 * On-chain data tool domain (consolidated).
 *
 * Three parameterized tools replace the eight PR-#4302 data/stats tools:
 *  - onchain_lookup:   resolve any identifier (address / contract / token / NFT /
 *                      tx / subnet / validator / chain) from the Stats API and RPC.
 *  - onchain_activity: recent feeds: EVM transactions and transfers, with the
 *                      chain's window count, and P-/X-Chain feeds, all from the
 *                      Stats API; token-contract transfers from RPC logs.
 *  - chain_stats:      chain metrics and the P-chain validator snapshot from the Stats API.
 *
 * Backend split: indexed data (tx history, transfers, aggregates, P-/X-Chain
 * records) comes from the public Stats API (stats-api.avax.network), whose
 * aggregates serve closed periods only. Live reads (balances, contract
 * metadata, recent logs) use each chain's public RPC. The MCP holds no
 * database credentials and no API key.
 */

import type { Address, Hash } from 'viem';
import { statsApi } from '@/lib/stats-api';
import { nAvaxToAvax } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';
import {
  assertChainId,
  assertSafeHours,
  assertSafeDays,
  clampLimit,
} from './lib/clickhouse-safe';
import { P_CHAIN_ID, X_CHAIN_ID, C_CHAIN_ID, C_CHAIN_EVM_ID, NETWORKS, networkSchemaProp } from './lib/constants';
import {
  CHAIN_CATALOG,
  LOG_BLOCK_WINDOW,
  readContractInfo,
  readErc20Balances,
  readNativeBalance,
  readNft,
  readRecentTransfers,
  readTransaction,
  statsGet,
  type CatalogChain,
} from './lib/onchain-sources';
import { getString, errorResult, readPChainBalanceJson, rejectBadEnum } from './lib/tool-helpers';

interface StatsPoint {
  value: number;
  timestamp: number;
}

// The Stats API's page limit: 90 days of hourly buckets.
const STATS_MAX_PAGE = 2160;
const STATS_METRICS = ['txCount', 'gasUsed', 'feesPaid', 'activeSenders', 'avgGasPrice'] as const;
const STATS_UNITS = 'gasUsed in gas units, feesPaid in the native token, avgGasPrice in gwei';

/** One metric's buckets from startSec on, oldest first; null when the Stats API has no data for it. */
async function statsMetric(chainId: number, metric: string, interval: string, startSec: number): Promise<StatsPoint[] | null> {
  const page = await statsApi<{ results?: StatsPoint[] }>(
    `/v2/chains/${chainId}/metrics/${metric}?timeInterval=${interval}&startTimestamp=${startSec}&pageSize=${STATS_MAX_PAGE}`,
  );
  return page?.results ? [...page.results].reverse() : null;
}

function sumOf(points: StatsPoint[] | null): number | undefined {
  return points ? points.reduce((n, p) => n + p.value, 0) : undefined;
}

function getNetwork(args: Record<string, unknown>): Network {
  return args.network === 'fuji' ? 'fuji' : 'mainnet';
}

/** EVM chainId as a string: explicit arg wins, else C-Chain. */
function getChainId(args: Record<string, unknown>): string {
  const explicit = typeof args.chainId === 'string' && args.chainId.trim() ? args.chainId.trim() : '';
  if (typeof args.chainId === 'number') return String(Math.floor(args.chainId));
  return explicit || C_CHAIN_EVM_ID[getNetwork(args)];
}

function json(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function asMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'On-chain request failed';
  // viem keeps the request body and URL out of shortMessage.
  const message = (err as { shortMessage?: unknown }).shortMessage;
  // Strip internal API paths/URLs so surfaced errors never leak the upstream surface.
  return (typeof message === 'string' ? message : err.message)
    .replace(/\s+for\s+\/\S*/i, '')
    .replace(/https?:\/\/\S+/gi, 'the data API');
}

// --- Path-segment validators (no path-traversal / SSRF) ---------------------
function safeAddr(v: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error('invalid EVM address (0x + 40 hex)');
  return v.toLowerCase() as Address;
}
function safeTxHash(v: string): Hash {
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error('invalid tx hash (0x + 64 hex)');
  return v.toLowerCase() as Hash;
}
function safeId(v: string): string {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(v)) throw new Error('invalid id');
  return v;
}
function safeChainSeg(v: string): string {
  if (!/^\d{1,12}$/.test(v)) throw new Error('invalid chainId');
  return v;
}
function safeTokenId(v: string): bigint {
  if (!/^\d{1,78}$/.test(v)) throw new Error('invalid tokenId (a decimal integer)');
  return BigInt(v);
}

function detectKind(value: string): string {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return 'address';
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return 'transaction';
  if (/^NodeID-/i.test(value)) return 'validator';
  if (PX_ADDRESS.test(value)) return 'pchain'; // P-/X-chain bech32 account (bare avax1…/fuji1… included)
  if (/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value)) return 'subnet';
  // The Primary Network subnet id is a short (37-char) cb58 the 40-60 rule misses.
  if (value === P_CHAIN_ID) return 'subnet';
  return 'chain';
}

const KINDS = ['auto', 'address', 'contract', 'token', 'nft', 'transaction', 'subnet', 'validator', 'chain', 'pchain'] as const;
const SCOPES = ['address', 'chain', 'token', 'contract', 'primary'] as const;
const FEEDS = ['transactions', 'transfers', 'erc20Transfers', 'nftTransfers'] as const;
const TARGETS = ['chain', 'network'] as const;
const WINDOWS = ['series', 'recent'] as const;
const TIME_INTERVALS = ['hour', 'day', 'week', 'month'] as const;

// Accept both the prefixed tooling form (P-avax1…/X-fuji1…) and the BARE bech32 that
// Core wallet actually copies (avax1…/fuji1…). HRP is pinned to Avalanche networks so a
// bare match can't misfire on an arbitrary string.
const PX_ADDRESS = /^(?:[PX]-)?(?:avax|fuji|local|custom)1[a-z0-9]{30,}$/i;
function pxNetwork(addr: string, fallback: Network): Network {
  const hrp = (addr.match(/^(?:[PX]-)?([a-z0-9]+?)1/i)?.[1] || '').toLowerCase();
  return hrp === 'fuji' ? 'fuji' : hrp === 'avax' ? 'mainnet' : fallback;
}
function stripChainPrefix(addr: string): string {
  return addr.replace(/^[PX]-/i, ''); // the Stats API wants the bech32 part (avax1…/fuji1…)
}

/** The Stats API has no record of the Primary Network subnet; its chains are fixed. */
function primaryNetworkSubnet(network: Network) {
  return {
    subnetId: P_CHAIN_ID,
    isPrimaryNetwork: true,
    isL1: false,
    blockchains: [
      { blockchainId: P_CHAIN_ID, blockchainName: 'P-Chain', vmId: 'platformvm' },
      { blockchainId: X_CHAIN_ID[network], blockchainName: 'X-Chain', vmId: 'jvYyfQTxGMJLuGWa55kdP2p2zSUYsQ5Raupu4TW34ZAUBAbtq' },
      {
        blockchainId: C_CHAIN_ID[network],
        blockchainName: 'C-Chain',
        vmId: 'mgj786NP7uDwBCcq6YwThhaN8FLyybkCa4zBWTQbNgmK6k9A6',
        evmChainId: Number(C_CHAIN_EVM_ID[network]),
      },
    ],
  };
}

interface TimedPage<T> {
  rows: T[];
  next?: string;
}

// The MCP route stops at 30 s, and one cold Stats API address page can take 25 s.
const FEED_BUDGET_MS = 25_000;

/**
 * Newest-first rows inside [startSec, endSec]. The Stats API address feeds take no
 * time filter, so this pages back and filters by timestamp until the window starts,
 * `want` rows are found, or the time budget runs out (truncated).
 */
async function rowsInWindow<T>(
  load: (cursor: string | undefined, timeoutMs: number) => Promise<TimedPage<T>>,
  timeOf: (row: T) => number,
  want: number,
  startSec?: number,
  endSec?: number,
  maxPages = 8,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  const deadline = Date.now() + FEED_BUDGET_MS;
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const left = deadline - Date.now();
    if (page > 0 && left < 1_000) break;
    let batch: TimedPage<T>;
    try {
      batch = await load(cursor, left);
    } catch (err) {
      if (page === 0) throw err;
      break;
    }
    for (const row of batch.rows) {
      const t = timeOf(row);
      if (endSec != null && t > endSec) continue;
      if (startSec != null && t < startSec) return { rows, truncated: false };
      rows.push(row);
      if (rows.length >= want) return { rows, truncated: false };
    }
    if (!batch.next) return { rows, truncated: false };
    cursor = batch.next;
  }
  return { rows, truncated: startSec != null };
}

interface StatsTransfer {
  token: string;
}

function compatibilityChainId(value: unknown): string {
  const chainId = typeof value === 'number' ? String(Math.floor(value)) : typeof value === 'string' ? value : '43114';
  if (chainId !== '43114' && chainId !== '43113') throw new Error('chainId must be 43114 (mainnet) or 43113 (Fuji)');
  return chainId;
}

async function compatibilityNativeBalance(addressRaw: unknown, chainIdRaw: unknown): Promise<Record<string, unknown>> {
  const address = safeAddr(typeof addressRaw === 'string' ? addressRaw : '');
  const chainId = compatibilityChainId(chainIdRaw);
  const native = await readNativeBalance(chainId, address);
  const balanceWei = BigInt(native.balance);
  const unit = 10n ** 18n;
  const formatted = `${balanceWei / unit}.${(balanceWei % unit).toString().padStart(18, '0').slice(0, 6)}`;
  return {
    address,
    chainId,
    balance: `0x${balanceWei.toString(16)}`,
    balanceFormatted: formatted,
    symbol: native.symbol || 'AVAX',
  };
}

async function compatibilityContractInfo(addressRaw: unknown, chainIdRaw: unknown): Promise<Record<string, unknown>> {
  const address = safeAddr(typeof addressRaw === 'string' ? addressRaw : '');
  const chainId = compatibilityChainId(chainIdRaw);
  const info = await readContractInfo(chainId, address);
  return {
    address,
    chainId,
    isContract: info.isContract,
    ...(info.isContract ? {
      name: info.name,
      symbol: info.symbol,
      ercType: info.ercType,
    } : {}),
  };
}

async function compatibilityResult(load: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return json(await load());
  } catch (error) {
    return errorResult(asMessage(error));
  }
}

// ---------------------------------------------------------------------------
// onchain_lookup
// ---------------------------------------------------------------------------

/** EVM chains the Stats API indexes; its address and chain feeds are empty for any other chain. */
async function unindexedNote(chainId: string): Promise<string | undefined> {
  const chains = await withCache('mcp:stats-evm-chains', CACHE_TTL.CHAINS, () =>
    statsGet<Array<{ chainId: number }>>('/evm-api/chains'),
  ).catch(() => null);
  if (!chains || chains.some((c) => String(c.chainId) === chainId)) return undefined;
  return `The Stats API does not index chain ${chainId}, so its transaction and transfer fields are empty.`;
}

// The most tokens an address lookup reads balances for.
const MAX_BALANCE_TOKENS = 15;

async function onchainLookup(args: Record<string, unknown>): Promise<ToolResult> {
  const value = getString(args, 'value');
  if (!value) return errorResult('Error: value is required');
  const enumErr = rejectBadEnum(args, 'network', NETWORKS);
  if (enumErr) return enumErr;
  const network = getNetwork(args);
  let kind = getString(args, 'kind', 'auto');
  if (kind === 'auto') kind = detectKind(value);

  try {
    switch (kind) {
      case 'address': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const include = Array.isArray(args.include) ? (args.include as unknown[]).map(String) : ['balances'];
        const [activity, recentTx, erc20Moves, nftTransfers, native, contract, indexNote] = await Promise.all([
          statsGet<unknown>(`/evm-api/${chainId}/address/${addr}`).catch(() => null),
          statsGet<unknown>(`/evm-api/${chainId}/address/${addr}/txs`, { limit: 5 }).catch(() => null),
          statsGet<{ transfers?: StatsTransfer[] }>(`/evm-api/${chainId}/address/${addr}/transfers`, { standard: 'erc20', limit: 100 }).catch(() => null),
          include.includes('nfts')
            ? statsGet<unknown>(`/evm-api/${chainId}/address/${addr}/transfers`, { standard: 'erc721', limit: 10 }).catch(() => null)
            : undefined,
          readNativeBalance(chainId, addr).catch(() => null),
          readContractInfo(chainId, addr).catch(() => null),
          unindexedNote(chainId),
        ]);
        // The Stats API has no holdings index: read live balances of the tokens the address moved recently.
        const tokens = [...new Set((erc20Moves?.transfers ?? []).map((t) => t.token))].slice(0, MAX_BALANCE_TOKENS) as Address[];
        const erc20 = tokens.length ? await readErc20Balances(chainId, addr, tokens).catch(() => null) : erc20Moves ? [] : null;
        return json({
          kind: 'address',
          address: addr,
          chainId,
          network,
          source: 'stats-api+rpc',
          isContract: contract ? contract.isContract : null,
          contractInfo: contract?.isContract ? contract : undefined,
          contractMetadataAvailable: contract !== null,
          nativeBalance: native,
          erc20Balances: erc20,
          activity,
          recentTransactions: recentTx,
          recentNftTransfers: nftTransfers,
          note: [
            `erc20Balances covers the tokens in the address's last 100 ERC-20 transfers (at most ${MAX_BALANCE_TOKENS}), with live balances from RPC; it is not a full holdings list.`,
            'chainsTouched is not available: no public index lists the chains an address used.',
            include.includes('nfts') ? 'NFT holdings are not available; recentNftTransfers lists the latest ERC-721 transfers.' : '',
            indexNote ?? '',
          ].filter(Boolean).join(' '),
        });
      }
      case 'contract':
      case 'token': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const [meta, recentTransfers] = await Promise.all([
          readContractInfo(chainId, addr).catch(() => null),
          readRecentTransfers(chainId, addr, 5).catch(() => null),
        ]);
        return json({
          kind,
          address: addr,
          chainId,
          source: 'rpc',
          metadata: meta,
          recentTransfers,
          note: `recentTransfers holds the Transfer logs of the last ${LOG_BLOCK_WINDOW} blocks only (the public RPC log cap). The deployment transaction is not available.`,
        });
      }
      case 'nft': {
        const addr = safeAddr(value);
        const chainId = safeChainSeg(getChainId(args));
        const tokenId = getString(args, 'tokenId');
        const result = await readNft(chainId, addr, tokenId ? safeTokenId(tokenId) : undefined);
        return json({
          kind: 'nft',
          collection: addr,
          chainId,
          tokenId: tokenId || undefined,
          source: 'rpc',
          result,
          note: tokenId
            ? 'tokenUri is the on-chain metadata URI; the metadata it points to is not fetched.'
            : 'The collection token list is not available. Pass tokenId for the owner and metadata URI of one token.',
        });
      }
      case 'transaction': {
        const hash = safeTxHash(value);
        const chainId = safeChainSeg(getChainId(args));
        const indexed = await statsGet<unknown>(`/evm-api/${chainId}/tx/${hash}`);
        if (indexed) return json({ kind: 'transaction', txHash: hash, chainId, source: 'stats-api', result: indexed });
        // Not indexed (yet, or on this chain): ask the chain's node.
        const live = await readTransaction(chainId, hash);
        if (!live) return errorResult(`Transaction ${hash} was not found on chain ${chainId}.`);
        return json({ kind: 'transaction', txHash: hash, chainId, source: 'rpc', result: live });
      }
      case 'subnet': {
        const subnetId = safeId(value);
        const result =
          subnetId === P_CHAIN_ID
            ? primaryNetworkSubnet(network)
            : await withCache(`mcp:subnet:${network}:${subnetId}`, CACHE_TTL.CHAINS, () =>
                statsGet<unknown>(`/v1/networks/${network}/subnets/${subnetId}`),
              );
        if (!result) return errorResult(`Subnet ${subnetId} was not found on ${network}.`);
        return json({ kind: 'subnet', subnetId, network, source: 'stats-api', result });
      }
      case 'validator': {
        const nodeId = safeId(value);
        const result = await statsGet<unknown>(`/v1/networks/${network}/validators/${nodeId}`);
        if (!result) return errorResult(`Validator ${nodeId} was not found on ${network}.`);
        // Stake and rewards are in nAVAX (1 AVAX = 1e9 nAVAX). Pre-convert to AVAX
        // so the model can't mis-scale into impossible "billions of AVAX" figures.
        const toAvax = (s: unknown) => (typeof s === 'string' && /^[0-9]+$/.test(s) ? Number(BigInt(s)) / 1e9 : undefined);
        const r = result as { validators?: Array<Record<string, unknown>> };
        const withAvax = Array.isArray(r.validators)
          ? {
              ...r,
              validators: r.validators.map((v) => {
                const pr = (v.potentialRewards ?? {}) as Record<string, unknown>;
                return {
                  ...v,
                  amountStakedAvax: toAvax(v.amountStaked),
                  amountDelegatedAvax: toAvax(v.amountDelegated),
                  validationRewardAvax: toAvax(pr.validationRewardAmount),
                  delegationRewardAvax: toAvax(pr.delegationRewardAmount),
                };
              }),
            }
          : result;
        return json({
          kind: 'validator',
          nodeId,
          network,
          source: 'stats-api',
          result: withAvax,
          unitsNote: 'Stake/reward are nAVAX (÷1e9 for AVAX); the *Avax fields are pre-converted. Total AVAX supply is ~472M, so any value above that is a unit error.',
          fieldNotes:
            'potentialRewards is an estimate from the index. For the exact potential reward, uptime and remaining delegation capacity of an active validator, use platform_get_current_validators.',
        });
      }
      case 'pchain': {
        // P-/X-chain bech32 account; network inferred from the address HRP.
        const net = pxNetwork(value, network);
        if (/^X-/i.test(value)) {
          const account = await statsGet<{ balances?: unknown; transactions?: unknown }>(
            `/x-api/${net}/address/${stripChainPrefix(value)}`,
            { limit: 5 },
          ).catch(() => null);
          return json({
            kind: 'xchain-address',
            address: value,
            network: net,
            source: 'stats-api',
            balances: account?.balances ?? null,
            recentTransactions: account?.transactions,
            note: account
              ? 'balance is in the smallest unit of the asset (see denomination). Atomic-memory balances are not included.'
              : 'No X-Chain balance data returned for this address.',
          });
        }
        // platform.getUTXOs requires the chain-prefixed form; a bare Core copy (avax1…) has none.
        const pAddr = `P-${stripChainPrefix(value)}`;
        const bal = await readPChainBalanceJson(net, [pAddr]);
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
        // Resolve a chain by numeric id, blockchainId, or (fuzzy) name in the local L1 catalog.
        // ChainIds are globally unique, so when the caller didn't pin a network and the
        // default one has no hit, also try the other network before giving up — otherwise a
        // Fuji chainId like 43113 comes back not-found just because mainnet is the default.
        const explicitNetwork = getString(args, 'network');
        const netsToTry: Network[] = explicitNetwork
          ? [network]
          : [network, network === 'mainnet' ? 'fuji' : 'mainnet'];
        const needle = value.toLowerCase().trim();
        const nameOf = (c: CatalogChain) => String(c.chainName || '').toLowerCase();
        let match: CatalogChain | undefined;
        let matchedNetwork: Network = network;
        let lastChains: CatalogChain[] = [];
        for (const net of netsToTry) {
          lastChains = CHAIN_CATALOG.filter((c) => !!c.isTestnet === (net === 'fuji'));
          match =
            lastChains.find((c) => String(c.chainId) === value || String(c.blockchainId || '') === value) ||
            lastChains.find((c) => nameOf(c) === needle) ||
            lastChains.find((c) => nameOf(c).startsWith(needle)) ||
            lastChains.find((c) => nameOf(c).includes(needle));
          if (match) {
            matchedNetwork = net;
            break;
          }
        }
        const candidates = match ? undefined : lastChains.filter((c) => nameOf(c).includes(needle)).slice(0, 5);
        return json({ kind: 'chain', query: value, network: matchedNetwork, source: 'catalog', match: match ?? null, candidates });
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
  const enumErr = rejectBadEnum(args, 'network', NETWORKS) || rejectBadEnum(args, 'feed', FEEDS);
  if (enumErr) return enumErr;
  const feed = getString(args, 'feed', 'transactions');
  const network = getNetwork(args);

  // Reject an inverted explicit time range up-front (all scopes), rather than silently falling
  // back to a default window and returning data for a different period than was asked for.
  const fromTs = args.fromTimestamp != null ? Number(args.fromTimestamp) : undefined;
  const toTs = args.toTimestamp != null ? Number(args.toTimestamp) : undefined;
  if (fromTs != null && toTs != null && Number.isFinite(fromTs) && Number.isFinite(toTs) && fromTs >= toTs) {
    return errorResult(`Invalid time range: fromTimestamp (${fromTs}) must be earlier than toTimestamp (${toTs}).`);
  }

  try {
    // P-/X-chain account activity from the Stats API, filtered to a time window.
    // Handles "what did P-avax1… do in the last N hours" (fractional hours OK).
    const pxValue = getString(args, 'value');
    if (PX_ADDRESS.test(pxValue)) {
      const net = pxNetwork(pxValue, network);
      const isX = /^X-/i.test(pxValue);
      const bare = stripChainPrefix(pxValue);
      const want = clampLimit(args.pageSize, 100, 25);
      const nowSec = Math.floor(Date.now() / 1000);
      const h = Number(args.hours);
      const windowed = Number.isFinite(h) && h > 0;
      const startSec = windowed ? nowSec - Math.floor(Math.min(h, 24 * 90) * 3600) : fromTs;
      const endSec = windowed ? nowSec : toTs;
      // A window can skip rows, so read full pages; else one page of the size asked for.
      const limit = startSec != null || endSec != null ? 100 : want;
      const { rows, truncated } = isX
        ? await rowsInWindow(
            async (cursor, timeoutMs) => {
              const page = await statsGet<{ transactions?: Array<{ timestamp: number }>; nextCursor?: string }>(
                `/x-api/${net}/address/${bare}`,
                { limit, cursor },
                timeoutMs,
              );
              return { rows: page?.transactions ?? [], next: page?.nextCursor };
            },
            (tx) => tx.timestamp,
            want,
            startSec,
            endSec,
          )
        : await rowsInWindow(
            async (before, timeoutMs) => {
              const page = await statsGet<{ txs?: Array<{ blockTimestamp: number }>; nextBefore?: number }>(
                `/api/${net}/address/${bare}/txs`,
                { limit, before },
                timeoutMs,
              );
              return { rows: page?.txs ?? [], next: page?.nextBefore ? String(page.nextBefore) : undefined };
            },
            (tx) => tx.blockTimestamp,
            want,
            startSec,
            endSec,
          );
      return json({
        source: 'stats-api',
        scope: 'primary',
        chain: isX ? 'X-Chain' : 'P-Chain',
        network: net,
        address: pxValue,
        windowHours: windowed ? h : undefined,
        note: [
          isX ? '' : 'received, sent and net are nAVAX (÷1e9 for AVAX).',
          truncated ? 'The search stopped before the start of the window, so its oldest transactions may be missing.' : '',
        ].filter(Boolean).join(' ') || undefined,
        result: { transactions: rows },
      });
    }

    // EVM transaction feeds from the Stats API. For scope=chain it adds the transaction
    // count over the last `hours` (closed hours only). There is no per-address window
    // count, so an address feed is the latest page only.
    if ((scope === 'chain' || scope === 'address') && feed === 'transactions') {
      const cid = assertChainId(getChainId(args));
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 2), 24 * 30);
      const chainSeg = safeChainSeg(String(cid));
      const limit = clampLimit(args.pageSize, 100, 25);
      // This feed cannot apply a timestamp range; say so instead of answering as if it matched.
      const rangeNote =
        fromTs != null || toTs != null
          ? ' The fromTimestamp/toTimestamp you passed were not applied. For a timestamp-range feed, query a P-/X-Chain address with scope=primary.'
          : '';
      if (scope === 'address') {
        const addr = safeAddr(getString(args, 'value'));
        const [result, indexNote] = await Promise.all([
          statsGet<unknown>(`/evm-api/${chainSeg}/address/${addr}/txs`, { limit }),
          unindexedNote(chainSeg),
        ]);
        return json({
          source: 'stats-api',
          scope,
          chainId: chainSeg,
          address: addr,
          note: `Latest transactions for the address. No time window applies to address feeds.${rangeNote}${indexNote ? ` ${indexNote}` : ''}`,
          result,
        });
      }
      const [result, hourly, indexNote] = await Promise.all([
        statsGet<unknown>(`/evm-api/${chainSeg}/txs`, { limit }),
        statsMetric(cid, 'txCount', 'hour', Math.floor(Date.now() / 1000) - hours * 3600),
        unindexedNote(chainSeg),
      ]);
      return json({
        source: 'stats-api',
        scope,
        chainId: chainSeg,
        windowHours: hours,
        txCountInWindow: sumOf(hourly),
        note:
          (hourly
            ? 'txCountInWindow counts closed hours only. The sample is the latest transactions.'
            : 'The Stats API has no hourly data for this chain, so there is no window count. The sample is the latest transactions.') +
          rangeNote +
          (indexNote ? ` ${indexNote}` : ''),
        result,
      });
    }

    // P-/X-/C-Chain primary network feed.
    if (scope === 'primary') {
      // Default to P-Chain when no blockchainId is given, so "last N P-chain transactions" just works.
      const blockchainId = safeId(getString(args, 'blockchainId') || P_CHAIN_ID);
      const limit = clampLimit(args.pageSize, 100, 25);
      // A chain-wide feed is the latest page only: only the address feed above filters by time.
      const windowRequested = args.fromTimestamp != null || args.toTimestamp != null;
      let result: unknown;
      if (blockchainId === P_CHAIN_ID || blockchainId === 'p-chain') {
        result = await statsGet<unknown>(`/v1/networks/${network}/blockchains/p-chain/transactions`, { pageSize: limit });
      } else if (blockchainId === X_CHAIN_ID[network]) {
        result = await statsGet<unknown>(`/x-api/${network}/txs`, { limit });
      } else if (blockchainId === C_CHAIN_ID[network]) {
        result = await statsGet<unknown>(`/evm-api/${C_CHAIN_EVM_ID[network]}/atomic-txs`, { limit });
      } else {
        return errorResult(`Error: blockchainId must be the ${network} P-Chain, X-Chain or C-Chain id for scope=primary.`);
      }
      return json({
        source: 'stats-api',
        scope,
        network,
        blockchainId,
        note: windowRequested
          ? 'Chain-wide primary-network feed returns the LATEST transactions only; the requested time window was NOT applied. For a windowed P-/X-Chain feed, pass a P-/X-Chain address as `value`.'
          : undefined,
        result,
      });
    }

    const chainId = safeChainSeg(getChainId(args));
    const limit = clampLimit(args.pageSize, 100, 25);
    // Token-contract transfers: Transfer logs from RPC, for the latest blocks only.
    if (scope === 'token' || scope === 'contract') {
      const addr = safeAddr(getString(args, 'value'));
      const result = await readRecentTransfers(chainId, addr, limit);
      // A token contract has a single transfer standard (ERC-20 or ERC-721); this returns that
      // standard's transfers as recorded and does NOT re-filter by `feed`. Surface that so an
      // explicit feed (e.g. nftTransfers on an ERC-20) isn't silently answered with the wrong type.
      const explicitFeed = getString(args, 'feed');
      return json({
        source: 'rpc',
        scope,
        feed: explicitFeed || undefined,
        chainId,
        address: addr,
        note: [
          `Transfer logs of the last ${LOG_BLOCK_WINDOW} blocks only (the public RPC log cap); an empty list means no transfer in those blocks.`,
          explicitFeed && explicitFeed !== 'transactions'
            ? `A token contract has one transfer standard (ERC-20 or ERC-721); this returns that standard's transfers and the requested feed "${explicitFeed}" was not applied as a filter. Rows with tokenId are ERC-721, rows with value are ERC-20.`
            : '',
        ].filter(Boolean).join(' '),
        result,
      });
    }
    // scope=address with an asset-transfer feed: transfers covers every token standard.
    const addr = safeAddr(getString(args, 'value'));
    const standard = feed === 'nftTransfers' ? 'erc721' : feed === 'erc20Transfers' ? 'erc20' : undefined;
    const [result, indexNote] = await Promise.all([
      statsGet<unknown>(`/evm-api/${chainId}/address/${addr}/transfers`, { standard, limit }),
      unindexedNote(chainId),
    ]);
    return json({ source: 'stats-api', scope, feed, chainId, address: addr, note: indexNote, result });
  } catch (err) {
    return errorResult(asMessage(err));
  }
}

// ---------------------------------------------------------------------------
// chain_stats
// ---------------------------------------------------------------------------

async function chainStats(args: Record<string, unknown>): Promise<ToolResult> {
  if (getString(args, 'target') === 'contract') {
    return errorResult(
      'Error: per-contract stats are not available. Run SQL on the indexed data in the Builder Hub explorer Query page: https://build.avax.network/explorer/mainnet/query',
    );
  }
  const enumErr =
    rejectBadEnum(args, 'network', NETWORKS) ||
    rejectBadEnum(args, 'target', TARGETS) ||
    rejectBadEnum(args, 'window', WINDOWS) ||
    rejectBadEnum(args, 'timeInterval', TIME_INTERVALS);
  if (enumErr) return enumErr;
  const target = getString(args, 'target', 'chain');
  const network = getNetwork(args);

  try {
    if (target === 'chain') {
      const cid = assertChainId(getChainId(args));
      const window = getString(args, 'window', 'recent');
      const nowSec = Math.floor(Date.now() / 1000);
      if (window === 'series') {
        const days = assertSafeDays(typeof args.days === 'number' ? args.days : Number(args.days || 30), 365);
        const rawInterval = getString(args, 'timeInterval', 'day');
        const interval = (TIME_INTERVALS as readonly string[]).includes(rawInterval) ? rawInterval : 'day';
        if (interval === 'hour' && days > 90) {
          return errorResult('Error: timeInterval=hour supports at most 90 days. Use day, week or month for a longer window.');
        }
        const all = await Promise.all(STATS_METRICS.map((m) => statsMetric(cid, m, interval, nowSec - days * 86400)));
        if (all.every((points) => !points)) {
          return errorResult(`Error: the Stats API has no ${interval} data for chain ${cid}.`);
        }
        // One row per bucket, with each metric as a field.
        const rows = new Map<number, Record<string, number>>();
        STATS_METRICS.forEach((metric, i) => {
          for (const p of all[i] ?? []) {
            const row = rows.get(p.timestamp) ?? { timestamp: p.timestamp };
            row[metric] = p.value;
            rows.set(p.timestamp, row);
          }
        });
        return json({
          source: 'stats-api',
          target,
          chainId: cid,
          timeInterval: interval,
          days,
          units: STATS_UNITS,
          note: 'Closed periods only: the current period is not included.',
          series: [...rows.values()].sort((a, b) => a.timestamp - b.timestamp),
        });
      }
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 24), 24 * 30);
      const startSec = nowSec - hours * 3600;
      const [tx, gas, fees, price] = await Promise.all(
        ['txCount', 'gasUsed', 'feesPaid', 'avgGasPrice'].map((m) => statsMetric(cid, m, 'hour', startSec)),
      );
      if (!tx) return errorResult(`Error: the Stats API has no hourly data for chain ${cid}.`);
      const txCount = sumOf(tx) ?? 0;
      // An hour's avgGasPrice is a per-transaction mean, so weight it by that hour's txCount.
      const txByHour = new Map(tx.map((p) => [p.timestamp, p.value]));
      const weightedPrice = price?.reduce((n, p) => n + p.value * (txByHour.get(p.timestamp) ?? 0), 0);
      return json({
        source: 'stats-api',
        target,
        chainId: cid,
        windowHours: hours,
        coveredFromSec: tx[0]?.timestamp,
        coveredThroughSec: tx.length ? tx[tx.length - 1].timestamp + 3600 : undefined,
        units: STATS_UNITS,
        note: 'Closed hours only: the current hour is not in the sums. Unique senders do not add up across hours, so activeSenders is not here; use window=series with timeInterval=day.',
        metrics: {
          txCount,
          gasUsed: sumOf(gas),
          feesPaid: sumOf(fees),
          avgGasPrice: txCount && weightedPrice != null ? weightedPrice / txCount : undefined,
        },
      });
    }

    // target === 'network' → P-chain validator snapshot.
    const result = await statsGet<unknown>(`/v1/networks/${network}/validators`, { pageSize: 100 });
    return json({
      source: 'stats-api',
      target: 'network',
      network,
      note: 'P-chain validator/delegator metrics are a current snapshot — there is no historical P-chain time-series here.',
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
      name: 'blockchain_get_native_balance',
      description: 'Compatibility alias for onchain_lookup address balances. Prefer onchain_lookup for new clients.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: { type: 'string', default: '43114', description: '43114 for C-Chain mainnet, 43113 for Fuji' },
        },
        required: ['address'],
      },
    },
    {
      name: 'blockchain_get_contract_info',
      description: 'Compatibility alias for onchain_lookup contract metadata. Prefer onchain_lookup for new clients.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Contract address (0x...)' },
          chainId: { type: 'string', default: '43114', description: '43114 for C-Chain mainnet, 43113 for Fuji' },
        },
        required: ['address'],
      },
    },
    {
      name: 'blockchain_lookup_address',
      description: 'Compatibility alias for onchain_lookup address details. Prefer onchain_lookup for new clients.',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'EVM address (0x...)' },
          chainId: { type: 'string', default: '43114', description: '43114 for C-Chain mainnet, 43113 for Fuji' },
        },
        required: ['address'],
      },
    },
    {
      name: 'onchain_lookup',
      description:
        'PRIMARY lookup tool: use this (not raw RPC) to resolve/describe any on-chain identifier in one call: an EVM address (native balance, live balances of the ERC-20 tokens it moved recently, recent txs, contract metadata + isContract), a contract/token (metadata + Transfer logs of the last 100 blocks), an NFT (collection, or the owner and metadata URI of one tokenId), a tx hash, a subnet ID, a NodeID validator, a P-/X-Chain account (P-… → P-Chain balance, X-… → X-Chain balances), or a chain name/id. Use this for any address balance / contract-info / token / identity question. `kind` auto-detects; network is inferred from P-/X-Chain prefixes. Backed by the Avalanche Stats API and public RPC. Not available: the deployment tx of a contract, NFT holdings, the token list of a collection, and the chains an address used.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'The identifier: 0x address / 0x tx hash / NodeID-… / subnetId / chain name or id' },
          kind: { type: 'string', enum: [...KINDS], description: 'Entity kind (default: auto-detect from value)' },
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
          chainId: { type: 'string', description: 'EVM chain ID for EVM kinds (default: C-Chain for the network)' },
          tokenId: { type: 'string', description: 'NFT token ID (kind=nft)' },
          include: { type: 'array', items: { type: 'string', enum: ['balances', 'nfts'] }, description: 'Extra data for an address (["nfts"] adds its latest ERC-721 transfers)' },
        },
        required: ['value'],
      },
    },
    {
      name: 'onchain_activity',
      description:
        'Recent on-chain activity. scope=chain returns the transaction COUNT over the last `hours` (closed hours, max 720h = 30 days; for longer windows use chain_stats window=series) plus the latest transactions. scope=address returns the latest transactions of the address, with no time window. For a token/contract use scope=token (Transfer logs of the last 100 blocks). scope=primary covers the P-Chain, the X-Chain and C-Chain atomic txs, and DEFAULTS to P-Chain when no blockchainId is given (so "last N P-chain transactions" just works). A value with no scope defaults to address.',
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: [...SCOPES], description: 'address | chain | token | contract | primary' },
          value: { type: 'string', description: 'Address/contract/token (omit for scope=chain)' },
          feed: { type: 'string', enum: [...FEEDS], description: 'transactions (default) | transfers (all token standards) | erc20Transfers | nftTransfers (ERC-721)' },
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the network)' },
          blockchainId: { type: 'string', description: 'Blockchain ID for scope=primary (default: P-Chain)' },
          hours: { type: 'number', description: 'Look-back window in hours for the scope=chain count (default: 2, max 720)' },
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
        'Chain statistics from the Avalanche Stats API (pre-aggregated; closed periods only, so the current hour or day is not included). target=chain: tx count, gas used, fees paid and average gas price over the last `hours` (window=recent, max 720h = 30 days), or a time-series that also has active senders (window=series, `days` max 365; timeInterval=hour max 90 days). target=network: current P-chain validator snapshot. There are no per-contract stats here; for those, run SQL in the Builder Hub explorer Query page. Note: C-Chain gasUsed is gas-target-regulated, so daily gas is about stable even as tx count varies. That is expected, not an error.',
      inputSchema: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: [...TARGETS], description: 'chain (default) | network' },
          window: { type: 'string', enum: [...WINDOWS], description: 'chain: recent aggregate (default) or series' },
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the network)' },
          timeInterval: { type: 'string', enum: [...TIME_INTERVALS], description: 'Bucket size for window=series (default: day)' },
          hours: { type: 'number', description: 'Look-back hours for window=recent (default: 24, max 720)' },
          days: { type: 'number', description: 'Look-back days for window=series (default: 30, max 365; max 90 with timeInterval=hour)' },
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
        },
        required: [],
      },
    },
  ],

  handlers: {
    blockchain_get_native_balance: (args) => compatibilityResult(
      () => compatibilityNativeBalance(args.address, args.chainId)
    ),
    blockchain_get_contract_info: (args) => compatibilityResult(
      () => compatibilityContractInfo(args.address, args.chainId)
    ),
    blockchain_lookup_address: (args) => compatibilityResult(async () => {
      const chainId = compatibilityChainId(args.chainId);
      const [balance, contract] = await Promise.all([
        compatibilityNativeBalance(args.address, chainId),
        compatibilityContractInfo(args.address, chainId),
      ]);
      const address = balance.address as string;
      return {
        address,
        chainId,
        network: chainId === '43113' ? 'Fuji Testnet' : 'C-Chain Mainnet',
        balance: `${balance.balanceFormatted} ${balance.symbol}`,
        isContract: contract.isContract,
        contractInfo: contract.isContract
          ? { name: contract.name, symbol: contract.symbol, ercType: contract.ercType }
          : null,
        explorerUrl: chainId === '43113'
          ? `https://testnet.snowtrace.io/address/${address}`
          : `https://snowtrace.io/address/${address}`,
      };
    }),
    onchain_lookup: onchainLookup,
    onchain_activity: onchainActivity,
    chain_stats: chainStats,
  },
};
