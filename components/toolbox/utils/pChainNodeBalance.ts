/**
 * P-Chain balance straight from an AvalancheGo node.
 *
 * The indexed Data API (Glacier) is the wrong source of truth for a wallet
 * balance: it can and does fall behind the chain. On 2026-07-28 the Fuji
 * P-Chain indexer stalled for ~24h, so the console showed a balance that
 * predated the user's last two imports while Core showed an atomic-memory
 * entry that an ImportTx had already consumed. Neither number matched the
 * node. So read the node first and treat the indexer as a fallback only.
 *
 * AvalancheGo deprecated `platform.getBalance` and removes it in a coming
 * release; its Go client says to use GetUTXOs instead. So the balance here is
 * the sum of the address's UTXOs from `platform.getUTXOs`, split by the same
 * rules as `platform.getBalance` (GetBalance in avalanchego
 * vms/platformvm/service.go), so each field equals the one that method gave.
 */

import { utils, Utxo } from '@avalabs/avalanchejs';
import { getPChainRpcUrl } from './avalancheEndpoints';
import { readSharedMemory, UTXO_PAGE_SIZE, type UtxoIndex } from './sharedMemoryImport';

/** The AVAX asset ID of each network: the asset of platform.getBalance's top-level fields. */
export const AVAX_ASSET_ID = {
  mainnet: 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z',
  fuji: 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK',
} as const;

/** An amount split by lock state, as platform.getBalance splits it. */
export interface LockSplit {
  /** Spendable now: it can pay a tx fee. */
  unlocked: bigint;
  /** Under a stakeable lock: it can be staked, not spent. */
  lockedStakeable: bigint;
  /** Under a plain locktime: it can be neither staked nor spent yet. */
  lockedNotStakeable: bigint;
}

/** The balance of P-Chain addresses with the fields of platform.getBalance: the top-level split is AVAX, in nAVAX. */
export interface PChainBalance extends LockSplit {
  /** unlocked + lockedStakeable + lockedNotStakeable. */
  balance: bigint;
  /** The split of each asset that the UTXOs hold, AVAX included (platform.getBalance's per-asset maps). */
  byAsset: Record<string, LockSplit>;
  /** Every UTXO that the split counts, of any asset, as platform.getBalance listed them. */
  utxoIDs: { txID: string; outputIndex: number }[];
  /** False when the addresses hold more UTXOs than the read gets (readSharedMemory): the amounts are then a lower bound. */
  complete: boolean;
}

/** One platform.getUTXOs call with encoding 'hex', from `startIndex` (undefined for the first page). */
export type ReadUtxoPage = (startIndex: UtxoIndex | undefined) => Promise<{ utxos: string[]; endIndex?: UtxoIndex }>;

/** The params of one page of platform.getUTXOs for `addresses`. */
export function utxoPageParams(
  addresses: readonly string[],
  startIndex: UtxoIndex | undefined,
): Record<string, unknown> {
  return {
    addresses: addresses.map(withPChainPrefix),
    limit: UTXO_PAGE_SIZE,
    encoding: 'hex',
    ...(startIndex ? { startIndex } : {}),
  };
}

/** The node rejects a bech32 address without its chain prefix. */
function withPChainPrefix(address: string): string {
  return address.includes('-') ? address : `P-${address}`;
}

/**
 * Splits UTXOs the way platform.getBalance does, at `now` (Unix seconds):
 * - A TransferOutput is unlocked when its locktime has passed, else locked and not stakeable.
 * - A StakeableLockOut is locked and not stakeable while its inner TransferOutput's locktime has not passed. Else it
 *   is unlocked when its stakeable locktime has passed, and locked but stakeable until then.
 * - Other outputs do not count.
 * Like platform.getBalance, it counts every UTXO that lists the address, whatever the threshold of its owners.
 */
export function sumPChainUtxos(
  utxos: readonly Utxo[],
  avaxAssetId: string,
  now: bigint,
): Omit<PChainBalance, 'complete'> {
  const byAsset: Record<string, LockSplit> = {};
  const utxoIDs: PChainBalance['utxoIDs'] = [];
  for (const utxo of utxos) {
    const out = utxo.output;
    let state: keyof LockSplit;
    if (utils.isTransferOut(out)) {
      state = out.getLocktime() <= now ? 'unlocked' : 'lockedNotStakeable';
    } else if (utils.isStakeableLockOut(out) && utils.isTransferOut(out.transferOut)) {
      if (out.transferOut.getLocktime() > now) state = 'lockedNotStakeable';
      else state = out.getStakeableLocktime() <= now ? 'unlocked' : 'lockedStakeable';
    } else {
      continue;
    }
    const split = (byAsset[utxo.getAssetId()] ??= { unlocked: 0n, lockedStakeable: 0n, lockedNotStakeable: 0n });
    split[state] += out.amount();
    utxoIDs.push({ txID: utxo.utxoId.txID.toString(), outputIndex: utxo.utxoId.outputIdx.value() });
  }
  const avax = byAsset[avaxAssetId] ?? { unlocked: 0n, lockedStakeable: 0n, lockedNotStakeable: 0n };
  return {
    balance: avax.unlocked + avax.lockedStakeable + avax.lockedNotStakeable,
    ...avax,
    byAsset,
    utxoIDs,
  };
}

/**
 * The balance of the addresses that `readPage` reads, page by page (readSharedMemory: it stops at a short page, keeps
 * each UTXO once, and reads at most MAX_UTXO_PAGES pages). Throws when a page fails or a UTXO does not decode.
 * platform.getBalance read the UTXOs at one height. A read of more than one page is not atomic, like avalanchego's own
 * wallet read (AddAllUTXOs): a tx accepted between two pages can make the sum miss or repeat its UTXOs once.
 */
export async function readPChainBalance(
  readPage: ReadUtxoPage,
  avaxAssetId: string,
  now: bigint = BigInt(Math.floor(Date.now() / 1000)),
): Promise<PChainBalance> {
  const manager = utils.getManagerForVM('PVM');
  const { utxos, complete } = await readSharedMemory(async (startIndex) => {
    const page = await readPage(startIndex);
    if (!Array.isArray(page?.utxos)) throw new Error('platform.getUTXOs returned no utxos');
    return { utxos: page.utxos.map((hex) => manager.unpack(utils.hexToBuffer(hex), Utxo)), endIndex: page.endIndex };
  });
  return { ...sumPChainUtxos(utxos, avaxAssetId, now), complete };
}

/**
 * The balance of a P-Chain address from the public API node of the network.
 *
 * Throws on transport or RPC error so the caller can fall back. Also throws when the address holds more UTXOs than the
 * read gets: platform.getBalance counted every UTXO, and a lower bound shown as the balance would mislead.
 */
export async function getPChainBalanceFromNode(isTestnet: boolean, pChainAddress: string): Promise<PChainBalance> {
  // A stale balance is worse than a missing one, so don't let a hung node
  // hold the header's loading state open indefinitely.
  const signal = AbortSignal.timeout(10_000);
  const readPage: ReadUtxoPage = async (startIndex) => {
    const response = await fetch(getPChainRpcUrl(isTestnet), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'platform.getUTXOs',
        params: utxoPageParams([pChainAddress], startIndex),
      }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`platform.getUTXOs failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as {
      result?: { utxos: string[]; endIndex?: UtxoIndex };
      error?: { message?: string };
    };
    if (json.error || !json.result) {
      throw new Error(`platform.getUTXOs error: ${json.error?.message ?? 'no result'}`);
    }
    return json.result;
  };
  const balance = await readPChainBalance(readPage, isTestnet ? AVAX_ASSET_ID.fuji : AVAX_ASSET_ID.mainnet);
  if (!balance.complete) throw new Error('platform.getUTXOs: the address holds more UTXOs than the read gets');
  return balance;
}

/**
 * Spendable (unlocked, unstaked) nAVAX for a P-Chain address.
 *
 * Returns `unlocked` rather than `balance`: `balance` includes stakeable-locked
 * and platform-locked funds that can't pay a tx fee, which would let the UI
 * green-light a transaction the node then rejects for insufficient funds.
 *
 * Throws on transport or RPC error so the caller can fall back.
 */
export async function getPChainUnlockedNAvax(isTestnet: boolean, pChainAddress: string): Promise<bigint> {
  return (await getPChainBalanceFromNode(isTestnet, pChainAddress)).unlocked;
}
