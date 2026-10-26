/**
 * P-Chain balances from platform.getUTXOs.
 *
 * Replaces platform.getBalance, which avalanchego deprecated in v1.9.12 (ava-labs/avalanchego#6239 removes its client
 * before the method goes). It reads the same UTXOs, page by page, and sums them as GetBalance does, per asset:
 * - a secp256k1fx TransferOutput is unlocked when its locktime <= now, else lockedNotStakeable;
 * - a stakeable.LockOut is lockedNotStakeable when its inner locktime > now, else unlocked when its stakeable locktime
 *   <= now, else lockedStakeable;
 * - any other output type is skipped and not listed.
 * `balance` is the three summed. "Now" is the local clock; GetBalance used the node's.
 *
 * It runs in the browser, in Node routes and in the MCP server, so it imports only @avalabs/avalanchejs.
 */

import { Utxo, utils } from '@avalabs/avalanchejs';

/** AVAX on the P-Chain, by network. */
export const AVAX_ASSET_ID = {
  mainnet: 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z',
  fuji: 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK',
} as const;

/** One P-Chain JSON-RPC call: resolves to `result`, throws on a transport or RPC error. */
export type PChainRpc = (method: string, params: Record<string, unknown>) => Promise<unknown>;

export interface AssetAmounts {
  unlocked: bigint;
  lockedStakeable: bigint;
  lockedNotStakeable: bigint;
}

export interface PChainBalance extends AssetAmounts {
  /** AVAX: unlocked + lockedStakeable + lockedNotStakeable. The other fields of AssetAmounts are AVAX too. */
  balance: bigint;
  /** Every asset, by asset ID. */
  byAsset: Map<string, AssetAmounts>;
  /** Every counted UTXO, any asset. */
  utxoIDs: { txID: string; outputIndex: number }[];
}

/** The most UTXOs platform.getUTXOs returns in one page. */
const UTXO_PAGE_SIZE = 1024;
/** By default, a read throws rather than ask for more pages than this. */
const MAX_UTXO_PAGES = 20;

const pvmManager = utils.getManagerForVM('PVM');

/** One page of platform.getUTXOs. Its endIndex is the next page's startIndex. */
interface UtxoPage {
  utxos: string[];
  endIndex?: { address: string; utxo: string };
}

const NO_AMOUNTS: AssetAmounts = { unlocked: 0n, lockedStakeable: 0n, lockedNotStakeable: 0n };

/** A PChainRpc over fetch: POSTs JSON-RPC to `url`; `signal` aborts every page. Throws on HTTP and RPC errors. */
export function fetchPChainRpc(url: string, signal?: AbortSignal): PChainRpc {
  return async (method, params) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`${method} failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (json.error || json.result === undefined) {
      throw new Error(`${method} error: ${json.error?.message ?? 'no result'}`);
    }
    return json.result;
  };
}

/** Every UTXO that references one of the addresses, once each. A UTXO can open a page and close the page before. */
async function readUtxos(rpc: PChainRpc, addresses: readonly string[], maxPages: number): Promise<Utxo[]> {
  const byId = new Map<string, Utxo>();
  let startIndex: UtxoPage['endIndex'];
  for (let page = 0; page < maxPages; page++) {
    const { utxos, endIndex } = (await rpc('platform.getUTXOs', {
      addresses,
      limit: UTXO_PAGE_SIZE,
      encoding: 'hex',
      ...(startIndex && { startIndex }),
    })) as UtxoPage;
    for (const hex of utxos) {
      const utxo = pvmManager.unpack(utils.hexToBuffer(hex), Utxo);
      byId.set(utxo.ID(), utxo);
    }
    if (utxos.length < UTXO_PAGE_SIZE || !endIndex) return [...byId.values()];
    startIndex = endIndex;
  }
  const most = (maxPages * UTXO_PAGE_SIZE).toLocaleString('en-US');
  throw new Error(`platform.getUTXOs: more than ${maxPages} pages (${most} UTXOs)`);
}

/** GetBalance's bucket for an output with these locktimes (stakeableLocktime is 0 unless it is a lock). */
function bucketOf(locktime: bigint, stakeableLocktime: bigint, now: bigint): keyof AssetAmounts {
  if (locktime > now) return 'lockedNotStakeable';
  if (stakeableLocktime > now) return 'lockedStakeable';
  return 'unlocked';
}

/**
 * Pages platform.getUTXOs (hex, 1024 a page) and buckets the UTXOs as platform.getBalance did. Stops at a page with
 * fewer than 1024 UTXOs or no endIndex; dedupes by UTXO ID. Throws `readPChainBalance: no addresses` on an empty
 * list, and `platform.getUTXOs: more than 20 pages (20,480 UTXOs)` instead of reading a 21st page (`maxPages`, 20 by
 * default, sets the cap). `nowSeconds` defaults to the local clock.
 */
export async function readPChainBalance(
  rpc: PChainRpc,
  addresses: readonly string[],
  avaxAssetId: string,
  nowSeconds: bigint = BigInt(Math.floor(Date.now() / 1000)),
  maxPages: number = MAX_UTXO_PAGES,
): Promise<PChainBalance> {
  if (addresses.length === 0) throw new Error('readPChainBalance: no addresses');

  const byAsset = new Map<string, AssetAmounts>();
  const utxoIDs: PChainBalance['utxoIDs'] = [];
  for (const utxo of await readUtxos(rpc, addresses, maxPages)) {
    if (!utils.isTransferOut(utxo.output) && !utils.isStakeableLockOut(utxo.output)) continue;
    const { amount, assetId, locktime, stakeableLocktime } = utils.getUtxoInfo(utxo);
    const bucket = bucketOf(locktime, stakeableLocktime, nowSeconds);
    const amounts = byAsset.get(assetId) ?? NO_AMOUNTS;
    byAsset.set(assetId, { ...amounts, [bucket]: amounts[bucket] + amount });
    utxoIDs.push({ txID: utxo.utxoId.txID.toString(), outputIndex: utxo.utxoId.outputIdx.value() });
  }

  const avax = byAsset.get(avaxAssetId) ?? NO_AMOUNTS;
  return { ...avax, balance: avax.unlocked + avax.lockedStakeable + avax.lockedNotStakeable, byAsset, utxoIDs };
}

/**
 * platform.getBalance's JSON shape for callers that passed it through: amounts as decimal strings; `balances`,
 * `unlockeds`, `lockedStakeables` and `lockedNotStakeables` keyed by asset ID, with only the non-zero entries.
 */
export function toGetBalanceJson(b: PChainBalance): {
  balance: string;
  unlocked: string;
  lockedStakeable: string;
  lockedNotStakeable: string;
  balances: Record<string, string>;
  unlockeds: Record<string, string>;
  lockedStakeables: Record<string, string>;
  lockedNotStakeables: Record<string, string>;
  utxoIDs: { txID: string; outputIndex: number }[];
} {
  const perAsset = (amountOf: (a: AssetAmounts) => bigint): Record<string, string> =>
    Object.fromEntries(
      [...b.byAsset]
        .map(([assetId, amounts]) => [assetId, amountOf(amounts)] as const)
        .filter(([, amount]) => amount > 0n)
        .map(([assetId, amount]) => [assetId, amount.toString()]),
    );
  return {
    balance: b.balance.toString(),
    unlocked: b.unlocked.toString(),
    lockedStakeable: b.lockedStakeable.toString(),
    lockedNotStakeable: b.lockedNotStakeable.toString(),
    balances: perAsset((a) => a.unlocked + a.lockedStakeable + a.lockedNotStakeable),
    unlockeds: perAsset((a) => a.unlocked),
    lockedStakeables: perAsset((a) => a.lockedStakeable),
    lockedNotStakeables: perAsset((a) => a.lockedNotStakeable),
    utxoIDs: b.utxoIDs,
  };
}
