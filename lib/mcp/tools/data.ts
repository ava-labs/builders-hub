/**
 * On-chain data tool domain (consolidated).
 *
 * Three parameterized tools replace the eight PR-#4302 data/stats tools:
 *  - onchain_lookup   — resolve any identifier (address / contract / token / NFT /
 *                       tx / subnet / validator / chain) via the indexed Glacier API.
 *  - onchain_activity — time-windowed feeds ("what happened in the last N hours");
 *                       EVM activity via the query gateway, P-chain + asset
 *                       transfers from Glacier.
 *  - chain_stats      — chain/contract metrics via the query gateway,
 *                       P-chain validator snapshot from Glacier.
 *
 * Backend split: indexed EVM flow data (tx counts, gas, fees, time-series) goes
 * through the hardened query gateway, whose CATEGORY ROUTER picks the most
 * accurate live source PER FIELD (ClickHouse for exact counts/senders, settled
 * stats-api buckets for window gas/fees, Glacier for exact per-tx detail rows)
 * and stamps every field + flags every caveat in the envelope (sources/warnings)
 * — the wrappers pass those through verbatim (gatewayMeta). Direct identifier
 * lookups (tx validation, balances, metadata) stay MCP-side on Glacier: exact,
 * real-time, no extra hop. The MCP never touches ClickHouse or its creds;
 * `onchain_query` exposes the gateway's typed intents directly.
 */

import { glacierFetch, fetchErc20Balances } from '@/lib/rwa/glacier/client';
import { avalancheRPC, nAvaxToAvax } from '../rpc';
import { withCache, CACHE_TTL } from '../cache';
import type { ToolDomain, ToolResult, Network } from '../types';
import {
  assertChainId,
  toSafeHexAddr,
  assertSafeHours,
  assertSafeDays,
  clampLimit,
} from './lib/clickhouse-safe';
import { gatewayQuery, gatewayConfigured } from './lib/gateway-client';
import type { GatewayResult } from './lib/gateway-client';
import { P_CHAIN_ID, X_CHAIN_ID, C_CHAIN_EVM_ID, NETWORKS, networkSchemaProp } from './lib/constants';
import { getString, errorResult, rejectBadEnum } from './lib/tool-helpers';

/**
 * Pass the gateway's routing metadata through to the model VERBATIM: per-field
 * source stamps, mandatory caveat flags (warnings), settle coverage, degrade
 * reasons, and staleness stamps. The model is instructed (tool descriptions) to
 * relay any warning to the user — a flagged number must never be presented as
 * exact. Dropping these here would silently undo the gateway's routing honesty.
 */
function gatewayMeta(gw: GatewayResult): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (gw.sources) out.sources = gw.sources;
  if (gw.warnings?.length) out.warnings = gw.warnings;
  if (gw.settledFromSec) out.settledFromSec = gw.settledFromSec;
  if (gw.settledThroughSec) out.settledThroughSec = gw.settledThroughSec;
  if (gw.degraded) {
    out.degraded = gw.degraded;
    out.note = gw.message;
  }
  if (gw.servedStale) {
    out.servedStale = true;
    out.asOf = gw.asOf;
  }
  return out;
}

function getNetwork(args: Record<string, unknown>): Network {
  return args.network === 'fuji' ? 'fuji' : 'mainnet';
}

/** EVM chainId as a string for Glacier paths: explicit arg wins, else C-Chain. */
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
  // Strip internal API paths/URLs so surfaced errors never leak the upstream
  // surface (e.g. "Glacier API error: 404 Not Found for /v1/networks/...").
  return err.message
    .replace(/\s+for\s+\/\S*/i, '')
    .replace(/https?:\/\/\S+/gi, 'the data API');
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
  if (PX_ADDRESS.test(value)) return 'pchain'; // P-/X-chain bech32 account (bare avax1…/fuji1… included)
  if (/^[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(value)) return 'subnet';
  // The Primary Network subnet id is a short (37-char) cb58 the 40-60 rule misses.
  if (value === P_CHAIN_ID) return 'subnet';
  return 'chain';
}

const KINDS = ['auto', 'address', 'contract', 'token', 'nft', 'transaction', 'subnet', 'validator', 'chain', 'pchain'] as const;
const SCOPES = ['address', 'chain', 'token', 'contract', 'primary'] as const;
const FEEDS = ['transactions', 'transfers', 'erc20Transfers', 'nftTransfers'] as const;
const TARGETS = ['chain', 'contract', 'network'] as const;
const WINDOWS = ['series', 'recent'] as const;
const TIME_INTERVALS = ['hour', 'day', 'week', 'month'] as const;
const DSL_OPS = [
  'chainStatsRecent',
  'chainStatsSeries',
  'addressActivity',
  'chainActivity',
  'contractStats',
  'protocolRanking',
  'contractGasFlow',
  'topUnknownContracts',
  'chainGasTotal',
] as const;

// Accept both the prefixed tooling form (P-avax1…/X-fuji1…) and the BARE bech32 that
// Core wallet actually copies (avax1…/fuji1…). HRP is pinned to Avalanche networks so a
// bare match can't misfire on an arbitrary string.
const PX_ADDRESS = /^(?:[PX]-)?(?:avax|fuji|local|custom)1[a-z0-9]{30,}$/i;
function pxNetwork(addr: string, fallback: Network): Network {
  const hrp = (addr.match(/^(?:[PX]-)?([a-z0-9]+?)1/i)?.[1] || '').toLowerCase();
  return hrp === 'fuji' ? 'fuji' : hrp === 'avax' ? 'mainnet' : fallback;
}
function stripChainPrefix(addr: string): string {
  return addr.replace(/^[PX]-/i, ''); // Glacier/RPC want the bech32 part (avax1…/fuji1…)
}
/** Glacier returns an address-metadata body for EOAs too (ercType UNKNOWN); only a real signal means it is a contract. */
function isRealContract(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  const erc = typeof m.ercType === 'string' ? m.ercType : '';
  return (!!erc && erc !== 'UNKNOWN') || !!m.deploymentDetails || !!m.name || !!m.symbol;
}

interface NativeBalanceResponse {
  nativeTokenBalance?: { balance?: string; symbol?: string };
}

function compatibilityChainId(value: unknown): string {
  const chainId = typeof value === 'number' ? String(Math.floor(value)) : typeof value === 'string' ? value : '43114';
  if (chainId !== '43114' && chainId !== '43113') throw new Error('chainId must be 43114 (mainnet) or 43113 (Fuji)');
  return chainId;
}

async function compatibilityNativeBalance(addressRaw: unknown, chainIdRaw: unknown): Promise<Record<string, unknown>> {
  const address = safeAddr(typeof addressRaw === 'string' ? addressRaw : '');
  const chainId = compatibilityChainId(chainIdRaw);
  const result = await glacierFetch<NativeBalanceResponse>(`/v1/chains/${chainId}/addresses/${address}/balances:getNative`);
  const balanceWei = BigInt(result.nativeTokenBalance?.balance || '0');
  const unit = 10n ** 18n;
  const formatted = `${balanceWei / unit}.${(balanceWei % unit).toString().padStart(18, '0').slice(0, 6)}`;
  return {
    address,
    chainId,
    balance: `0x${balanceWei.toString(16)}`,
    balanceFormatted: formatted,
    symbol: result.nativeTokenBalance?.symbol || 'AVAX',
  };
}

async function compatibilityContractInfo(addressRaw: unknown, chainIdRaw: unknown): Promise<Record<string, unknown>> {
  const address = safeAddr(typeof addressRaw === 'string' ? addressRaw : '');
  const chainId = compatibilityChainId(chainIdRaw);
  const metadata = await glacierFetch<Record<string, unknown>>(`/v1/chains/${chainId}/addresses/${address}`);
  const isContract = isRealContract(metadata);
  return {
    address,
    chainId,
    isContract,
    ...(isContract ? {
      name: metadata?.name,
      symbol: metadata?.symbol,
      ercType: metadata?.ercType,
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
        const [chains, native, erc20, recentTx, contractMeta] = await Promise.all([
          glacierFetch<unknown>(`/v1/address/${addr}/chains`).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/balances:getNative`).catch(() => null),
          fetchErc20Balances(chainId, addr).then((r) => r.erc20TokenBalances).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}/transactions`, { pageSize: '5' }).catch(() => null),
          glacierFetch<unknown>(`/v1/chains/${chainId}/addresses/${addr}`).catch(() => null), // contract metadata; null for an EOA
        ]);
        const realContract = contractMeta === null ? null : isRealContract(contractMeta);
        const out: Record<string, unknown> = {
          kind: 'address',
          address: addr,
          chainId,
          network,
          isContract: realContract,
          contractInfo: realContract ? contractMeta : undefined,
          contractMetadataAvailable: contractMeta !== null,
          chainsTouched: chains,
          nativeBalance: native,
          erc20Balances: erc20,
          recentTransactions: recentTx,
        };
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
        // Glacier returns stake/reward/capacity in nAVAX (1 AVAX = 1e9 nAVAX). Pre-convert
        // to AVAX so the model can't mis-scale into impossible "billions of AVAX" figures.
        const toAvax = (s: unknown) => (typeof s === 'string' && /^[0-9]+$/.test(s) ? Number(BigInt(s)) / 1e9 : undefined);
        const r = result as { validators?: Array<Record<string, unknown>> } | null;
        const withAvax =
          r && Array.isArray(r.validators)
            ? {
                ...r,
                validators: r.validators.map((v) => {
                  const pr = (v.potentialRewards ?? {}) as Record<string, unknown>;
                  return {
                    ...v,
                    amountStakedAvax: toAvax(v.amountStaked),
                    amountDelegatedAvax: toAvax(v.amountDelegated),
                    delegationCapacityAvax: toAvax(v.delegationCapacity),
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
          result: withAvax,
          unitsNote: 'Stake/reward/capacity are nAVAX (÷1e9 for AVAX); the *Avax fields are pre-converted. Total AVAX supply is ~472M — any value above that is a unit error.',
          fieldNotes:
            "delegationCapacity (and delegationCapacityAvax) is the REMAINING delegation capacity — already net of amountDelegated, so do not subtract again. If present, stakePercentage is this validator's share of TOTAL network stake, not of any returned page.",
        });
      }
      case 'pchain': {
        // P-/X-chain bech32 account; network inferred from the address HRP.
        const net = pxNetwork(value, network);
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
        // platform.getBalance requires the chain-prefixed form; a bare Core copy (avax1…) has none.
        const pAddr = `P-${stripChainPrefix(value)}`;
        const bal = (await avalancheRPC(net, 'pchain', 'platform.getBalance', { addresses: [pAddr] })) as Record<string, unknown>;
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
        // Resolve a chain by numeric id, blockchainId, or (fuzzy) name via the Glacier chain
        // list. ChainIds are globally unique, so when the caller didn't pin a network and the
        // default one has no hit, also try the other network before giving up — otherwise a
        // Fuji chainId like 43113 comes back not-found just because mainnet is the default.
        const explicitNetwork = getString(args, 'network');
        const netsToTry: Network[] = explicitNetwork
          ? [network]
          : [network, network === 'mainnet' ? 'fuji' : 'mainnet'];
        const needle = value.toLowerCase().trim();
        const nameOf = (c: Record<string, unknown>) => String(c.chainName || '').toLowerCase();
        let match: Record<string, unknown> | undefined;
        let matchedNetwork: Network = network;
        let lastChains: Array<Record<string, unknown>> = [];
        for (const net of netsToTry) {
          const list = await withCache(`mcp:chains:${net}`, CACHE_TTL.CHAINS, () =>
            glacierFetch<{ chains?: Array<Record<string, unknown>> }>(`/v1/chains`, { network: net })
          );
          lastChains = list.chains || [];
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
        return json({ kind: 'chain', query: value, network: matchedNetwork, match: match ?? null, candidates });
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

    // EVM time-windowed activity — via the query gateway, which routes per field
    // (exact window count + detail rows from the best live source, each stamped).
    // Only if the GATEWAY ITSELF is unreachable, fall back to Glacier latest so
    // the tool still answers (the time window is not applied there).
    if ((scope === 'chain' || scope === 'address') && feed === 'transactions') {
      const cid = assertChainId(getChainId(args));
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 2), 24 * 30);
      const limit = clampLimit(args.pageSize, 100, 25);
      const addrHex = scope === 'address' ? toSafeHexAddr(getString(args, 'value')) : '';
      try {
        const op = addrHex ? 'addressActivity' : 'chainActivity';
        const params: Record<string, unknown> = { chainId: cid, hours, limit };
        if (addrHex) params.address = addrHex;
        const gw = await gatewayQuery(op, params);
        const sample = (gw.results.sample ?? []) as Array<Record<string, unknown>>;
        const countRow = (gw.results.count?.[0] ?? {}) as { n?: number };
        return json({
          source: gw.source,
          scope,
          chainId: cid,
          windowHours: hours,
          txCountInWindow: Number(countRow.n ?? sample.length),
          sampleSize: sample.length,
          // This EVM feed windows by `hours` only; if a timestamp range was passed it was not
          // applied — say so instead of returning the default-window data as if it matched.
          ...(fromTs != null || toTs != null
            ? { note: `This feed windows by \`hours\` (used the last ${hours}h); the fromTimestamp/toTimestamp you passed were not applied. For a timestamp-range feed, query a P-/X-Chain address with scope=primary.` }
            : {}),
          ...gatewayMeta(gw),
          sampleTransactions: sample,
        });
      } catch {
        // Data gateway unreachable → Glacier fallback (latest; time window NOT applied).
        const chainSeg = safeChainSeg(String(cid));
        const pageSize = String(limit);
        if (scope === 'address') {
          const addr = safeAddr(getString(args, 'value'));
          const result = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/addresses/${addr}/transactions`, { pageSize });
          return json({ source: 'glacier-fallback', scope, chainId: chainSeg, address: addr, note: 'Data gateway unreachable — latest transactions from Glacier; the time window was NOT applied.', result });
        }
        const result = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/transactions`, { pageSize });
        return json({ source: 'glacier-fallback', scope: 'chain', chainId: chainSeg, note: 'Data gateway unreachable — latest chain transactions from Glacier; the time window was NOT applied.', result });
      }
    }

    // Glacier — P/X-chain primary network feed.
    if (scope === 'primary') {
      // Default to P-Chain when no blockchainId is given, so "last N P-chain transactions" just works.
      const blockchainId = safeId(getString(args, 'blockchainId') || P_CHAIN_ID);
      // The chain-wide primary-network transactions route is a "latest transactions" feed:
      // Glacier 400s ("Latest transaction route does not support ... timestamp filters") if
      // startTimestamp/endTimestamp are sent here. Time filtering is only supported when the
      // query is scoped to an `addresses` value (the P-/X-chain address branch above handles
      // that). So return the latest page and, if a window was requested, say plainly that it
      // could not be applied — rather than leaking a raw upstream 400.
      const windowRequested = args.fromTimestamp != null || args.toTimestamp != null;
      const params: Record<string, string> = { pageSize: String(clampLimit(args.pageSize, 100, 25)) };
      const result = await glacierFetch<unknown>(`/v1/networks/${network}/blockchains/${blockchainId}/transactions`, params);
      return json({
        source: 'glacier',
        scope,
        network,
        blockchainId,
        note: windowRequested
          ? 'Chain-wide primary-network feed returns the LATEST transactions only; the requested time window was NOT applied (the Data API supports time filtering here only when the query is scoped to an address). For a windowed P-/X-Chain feed, pass a P-/X-Chain address as `value`.'
          : undefined,
        result,
      });
    }

    // Glacier — asset transfer feeds (ERC-20 / NFT) and token-contract transfers.
    const chainId = safeChainSeg(getChainId(args));
    const pageSize = String(clampLimit(args.pageSize, 100, 25));
    if (scope === 'token' || scope === 'contract') {
      const addr = safeAddr(getString(args, 'value'));
      const result = await glacierFetch<unknown>(`/v1/chains/${chainId}/tokens/${addr}/transfers`, { pageSize });
      // A token contract has a single transfer standard (ERC-20 or ERC-721); this returns that
      // standard's transfers as recorded and does NOT re-filter by `feed`. Surface that so an
      // explicit feed (e.g. nftTransfers on an ERC-20) isn't silently answered with the wrong type.
      const explicitFeed = getString(args, 'feed');
      return json({
        source: 'glacier',
        scope,
        feed: explicitFeed || undefined,
        chainId,
        address: addr,
        note:
          explicitFeed && explicitFeed !== 'transactions'
            ? `A token contract has one transfer standard (ERC-20 or ERC-721); this returns that standard's transfers and the requested feed "${explicitFeed}" was not applied as a filter. If these aren't the type you expected, this contract is the other standard.`
            : undefined,
        result,
      });
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
      // Validate window params BEFORE the gateway call so an out-of-range days/hours
      // surfaces as an honest validation error via the outer catch — not a false
      // "gateway unreachable" fallback. The inner catch is only for a real outage.
      const gwUnreachable = async () => {
        const chainSeg = safeChainSeg(String(cid));
        const latest = await glacierFetch<unknown>(`/v1/chains/${chainSeg}/blocks`, { pageSize: '1' }).catch(() => null);
        return json({ source: 'glacier-fallback', target: 'chain', chainId: chainSeg, note: 'Data gateway unreachable — latest-block snapshot from Glacier (no time-window aggregation).', latestBlock: latest });
      };
      if (window === 'series') {
        const days = assertSafeDays(typeof args.days === 'number' ? args.days : Number(args.days || 30), 365);
        const rawInterval = getString(args, 'timeInterval', 'day');
        const interval = (TIME_INTERVALS as readonly string[]).includes(rawInterval) ? rawInterval : 'day';
        try {
          const gw = await gatewayQuery('chainStatsSeries', { chainId: cid, days, bucket: interval });
          return json({
            source: gw.source,
            target,
            chainId: cid,
            timeInterval: interval,
            days,
            ...gatewayMeta(gw),
            series: gw.results.series ?? [],
          });
        } catch {
          return gwUnreachable();
        }
      }
      const hours = assertSafeHours(typeof args.hours === 'number' ? args.hours : Number(args.hours || 24), 24 * 30);
      try {
        const gw = await gatewayQuery('chainStatsRecent', { chainId: cid, hours });
        return json({
          source: gw.source,
          target,
          chainId: cid,
          windowHours: hours,
          ...gatewayMeta(gw),
          metrics: gw.results.metrics?.[0] ?? {},
        });
      } catch {
        return gwUnreachable();
      }
    }

    if (target === 'contract') {
      const cid = assertChainId(getChainId(args));
      const addr = toSafeHexAddr(getString(args, 'value') || getString(args, 'contract'));
      const days = assertSafeDays(typeof args.days === 'number' ? args.days : Number(args.days || 30), 365);
      const gw = await gatewayQuery('contractStats', { chainId: cid, contract: addr, days });
      // Per-contract stats are a days-based aggregate only — there is no per-contract
      // time-series or hourly granularity. Say so instead of silently ignoring
      // window:series / hours and returning the default-window aggregate as if it matched.
      const askedSeries = getString(args, 'window') === 'series';
      const askedHours = args.hours != null;
      const paramNote =
        askedSeries || askedHours
          ? `Per-contract stats are a ${days}-day aggregate — there is no per-contract time-series or hourly granularity.${askedSeries ? ' window:series was not applied.' : ''}${askedHours ? ' `hours` was not applied; use `days`.' : ''}`
          : undefined;
      return json({
        source: gw.source,
        target,
        chainId: cid,
        contract: `0x${addr}`,
        days,
        ...(paramNote ? { paramNote } : {}),
        ...gatewayMeta(gw),
        stats: gw.results.stats?.[0] ?? {},
      });
    }

    // target === 'network' → Glacier P-chain validator snapshot.
    const result = await glacierFetch<unknown>(`/v1/networks/${network}/validators`, { pageSize: '100' });
    return json({
      source: 'glacier',
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
// onchain_query — direct typed-DSL passthrough to the query gateway
// ---------------------------------------------------------------------------

async function onchainQuery(args: Record<string, unknown>): Promise<ToolResult> {
  const op = getString(args, 'op');
  if (!op || !(DSL_OPS as readonly string[]).includes(op)) {
    return errorResult(`Error: op must be one of: ${DSL_OPS.join(', ')}.`);
  }
  if (!gatewayConfigured()) return errorResult('Error: on-chain query gateway is not configured.');
  const params =
    args.params && typeof args.params === 'object' && !Array.isArray(args.params)
      ? (args.params as Record<string, unknown>)
      : {};
  try {
    // The gateway now decides Fuji freshness per-window and returns its own
    // degraded/message ONLY when data is genuinely unavailable — pass it through
    // verbatim. No blanket "frozen, query C-Chain" note: it contradicted the live
    // stats-api / Glacier responses Fuji now serves, and C-Chain can't serve Fuji.
    return json({ ...(await gatewayQuery(op, params)) });
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
        'PRIMARY lookup tool — use this (not raw RPC) to resolve/describe any on-chain identifier in one call: an EVM address (native + token balances, recent txs, contract metadata + isContract), a contract/token (metadata + deployment + recent transfers), an NFT (collection + tokenId), a tx hash, a subnet ID, a NodeID validator, a P-/X-Chain account (P-…/X-… → P-Chain balance), or a chain name/id. Use this for any address balance / contract-info / token / identity question. `kind` auto-detects; network is inferred from P-/X-Chain prefixes. Backed by Glacier + P-Chain RPC.',
      inputSchema: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'The identifier: 0x address / 0x tx hash / NodeID-… / subnetId / chain name or id' },
          kind: { type: 'string', enum: [...KINDS], description: 'Entity kind (default: auto-detect from value)' },
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
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
        'Time-windowed on-chain activity. scope=chain/address returns the transaction COUNT over the last `hours` (max 720h = 30 days; for longer windows use chain_stats series or onchain_query day-based ops) plus a recent sample. For a token/contract use scope=token (transfers). scope=primary covers P/X-chain and DEFAULTS to P-Chain when no blockchainId is given (so "last N P-chain transactions" just works). A value with no scope defaults to address.',
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: [...SCOPES], description: 'address | chain | token | contract | primary' },
          value: { type: 'string', description: 'Address/contract/token (omit for scope=chain)' },
          feed: { type: 'string', enum: [...FEEDS], description: 'transactions (default) | transfers | erc20Transfers | nftTransfers' },
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
          chainId: { type: 'string', description: 'EVM chain ID (default: C-Chain for the network)' },
          blockchainId: { type: 'string', description: 'Blockchain ID for scope=primary (default: P-Chain)' },
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
        'On-chain statistics via the query gateway, which picks the most accurate live source PER FIELD and stamps it (sources/warnings in the response). target=chain: tx count/gas/fees/active senders/avg gas price over a recent window (window=recent, `hours`, max 720h = 30 days) OR a time-series (window=series, `days`, max 365). target=contract: per-contract tx/sender/gas totals (`days`, max 365 — use this for contract activity beyond 30 days). target=network: current P-chain validator snapshot. IMPORTANT: relay any `warnings` notes to the user verbatim-in-substance (e.g. gas coverage windows or accuracy caveats) — never present a flagged value as exact. Note: C-Chain gasUsed is gas-target-regulated, so daily gas is ~stable even as tx count varies — expected, not an error.',
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
          network: networkSchemaProp({ description: 'Network (default: mainnet)' }),
        },
        required: [],
      },
    },
    {
      name: 'onchain_query',
      description:
        'PRIMARY tool for indexed on-chain stats/activity/totals — prefer this over raw RPC for chain data. Each `op` is a backend-agnostic intent: the query gateway selects the most accurate live source per field (indexed DB / pre-aggregated metrics / Data API), stamps every field (`sources`), and flags any caveat (`warnings`) — relay warnings to the user, never present a flagged value as exact. Pick an `op` and pass its `params`; `chainId` is an allowlisted EVM chain (43114 C-Chain, 43113 Fuji, + L1s). Lookback: hour-based ops (chainStatsRecent/chainActivity/addressActivity) max 720h (30 days); day-based ops (chainStatsSeries/contractStats/chainGasTotal/protocolRanking/contractGasFlow/topUnknownContracts) max 365 days — use a day-based op for windows over 30 days. Ops: ' +
        'chainStatsRecent {chainId, hours≤720} — tx count/gas/fees/active senders/avg gas price over the last N hours; ' +
        'chainStatsSeries {chainId, days≤365, bucket: hour|day|week|month} — bucketed time-series of the same; ' +
        'addressActivity {chainId, address, hours≤720, limit≤100} — tx count + recent sample for an address in a window; ' +
        'chainActivity {chainId, hours≤720, limit≤100} — tx count + recent sample chain-wide in a window; ' +
        'contractStats {chainId, contract, days≤365} — tx/unique-sender/gas totals for a contract; ' +
        'protocolRanking {chainId, contracts[≤25], days≤365, orderBy: txCount|gasUsed|uniqueSenders|feesPaidAvax, dir: asc|desc, limit≤100} — rank a set of contracts; ' +
        'contractGasFlow {chainId, contract, days≤365, limit≤100} — gas received/given per counterparty; ' +
        'topUnknownContracts {chainId, exclude[≤25], days≤365, limit≤100} — top contracts by gas excluding a set; ' +
        'chainGasTotal {chainId, days≤365} OR {chainId, fromDate, toDate} — total tx/gas/fees over N days or a YYYY-MM-DD range (≤365d). Note: C-Chain gasUsed is gas-target-regulated → ~stable day-to-day even as txCount varies (expected, not a bug).',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: [...DSL_OPS], description: 'The query operation' },
          params: { type: 'object', description: 'Op-specific parameters (see description); validated server-side.' },
        },
        required: ['op', 'params'],
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
    onchain_query: onchainQuery,
  },
};
