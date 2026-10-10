// What the C/P bridge (CrossChainTransfer.tsx) can import from shared memory, and the most it can export.
//
// Anyone can export a UTXO to an address: a locked one, one with more owners, one of another asset, or one too small
// to pay for its own input. The wallet cannot import such a UTXO alone, or the import burns more than the UTXO adds. If
// the page counted it, the page would show a pending import, start an import that fails, and hide Export. So one
// import (selectImport) takes only the address's own unlocked AVAX, by these rules:
// - Each UTXO holds more than the fee of its own input (the gas that its input adds, times the price). A dust UTXO
//   never enters, so a dust flood cannot raise the fee of the import above the user's own export.
// - The largest UTXOs first, as many as fit in the gas limit of one import: 100,000 gas on the C-Chain (coreth's gas
//   limit for an atomic tx), and half the P-Chain's maxCapacity on the P-Chain (the SDK refuses a P-Chain import above
//   the current capacity of the P-Chain).
// - The total of the selection is above the fee of the import. Else the page imports nothing on that side (dust).
// The page counts every other UTXO as blocked. It reads at most MAX_UTXO_PAGES pages of getUTXOs for each side
// (readSharedMemory), and shows MORE_UTXOS_TEXT when shared memory holds more.
//
// The page gives the SDK this set (the `utxos` of prepareImportTxn). Without it, the SDK reads every UTXO at the
// address again. evm.newImportTx of avalanchejs adds the amount of each AVAX UTXO to the fee before it checks that the
// wallet can spend the UTXO. So a foreign UTXO before the wallet's own makes an import that burns less than its fee,
// and coreth refuses it. The chain tests use the same rules (tests/e2e/chain/lib/atomic.ts isOurAvax, atomicUtxos and
// importSelection, and importProblems in tests/e2e/chain/lib/bridge-cp.ts).

import {
  avaxSerial,
  Bytes,
  evm,
  Id,
  Int,
  pvm,
  pvmSerial,
  TransferableInput,
  TransferableOutput,
  TransferInput,
  TransferOutput,
  utils,
  Utxo,
  type Context,
} from '@avalabs/avalanchejs';
import type { Utxo as SdkUtxo } from '@avalanche-sdk/client/serializable';
import { getUtxoFromBytes } from '@avalanche-sdk/client/utils';
import { formatUnits } from 'viem';
import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';

/** The chain that imports. 'P': AVAX that the C-Chain exported. 'C': AVAX that the P-Chain exported. */
export type ImportSide = 'P' | 'C';

const WEI_PER_NANO_AVAX = 1_000_000_000n;

/**
 * coreth's gas limit for an atomic tx in its mempool (ap5.AtomicGasLimit, plugin/evm/atomic/vm/vm.go). The mempool
 * refuses a larger C-Chain import, so the import never lands.
 */
export const MAX_ATOMIC_TX_GAS = 100_000n;

/** The gas limit of one P-Chain import when the context has no P-Chain maxCapacity: half of 1,000,000 (Fuji, Mainnet). */
export const DEFAULT_MAX_P_IMPORT_GAS = 500_000n;

/** The most UTXOs that one getUTXOs call returns (avalanchego platform.getUTXOs and coreth avax.getUTXOs). */
export const UTXO_PAGE_SIZE = 1_024;

/** The most pages of getUTXOs that the page reads for one side of shared memory (readSharedMemory). */
export const MAX_UTXO_PAGES = 10;

/** The line that the page shows when one side of shared memory holds more UTXOs than readSharedMemory reads. */
export const MORE_UTXOS_TEXT = 'Shared memory holds more UTXOs than this page reads.';

/** The 20 address bytes of 'P-fuji1...' or 'C-fuji1...', or null when the address does not parse. */
export function addressBytes(address: string): Uint8Array | null {
  try {
    return utils.bech32ToBytes(address);
  } catch {
    return null;
  }
}

/**
 * True for unlocked AVAX that `owner` alone can spend: a secp256k1 TransferOutput of AVAX with locktime 0, threshold 1
 * and `owner` as its only address.
 */
export function isOwnAvax(utxo: Utxo, avaxAssetId: string, owner: Uint8Array): utxo is Utxo<TransferOutput> {
  if (!(utxo.output instanceof TransferOutput) || utxo.getAssetId() !== avaxAssetId) return false;
  const out = utxo.output;
  const owners = out.getOwners();
  return (
    out.getLocktime() === 0n && out.getThreshold() === 1 && owners.length === 1 && utils.bytesEqual(owners[0], owner)
  );
}

/** The UTXOs of one side of shared memory, split by isOwnAvax. */
export interface SharedMemory {
  /** The owner's unlocked AVAX. */
  own: Utxo<TransferOutput>[];
  /** Every other UTXO. The wallet cannot import it alone. */
  others: Utxo[];
}

/** Splits the UTXOs at an address. With no owner (the address does not parse), every UTXO is in `others`. */
export function splitSharedMemory(utxos: readonly Utxo[], avaxAssetId: string, owner: Uint8Array | null): SharedMemory {
  const own: Utxo<TransferOutput>[] = [];
  const others: Utxo[] = [];
  for (const utxo of utxos) {
    if (owner && isOwnAvax(utxo, avaxAssetId, owner)) own.push(utxo);
    else others.push(utxo);
  }
  return { own, others };
}

/** The start of a page of getUTXOs: the endIndex of the page before it. */
export interface UtxoIndex {
  address: string;
  utxo: string;
}

/**
 * Reads one side of shared memory page by page. `readPage` is one getUTXOs call from `startIndex` (undefined for the
 * first page). The read stops at a page with fewer than UTXO_PAGE_SIZE UTXOs, or after MAX_UTXO_PAGES pages. The
 * node starts a page at the last UTXO of the page before it, so the read keeps each UTXO ID once. `complete` is false
 * when shared memory can hold more UTXOs than the read got.
 */
export async function readSharedMemory(
  readPage: (startIndex: UtxoIndex | undefined) => Promise<{ utxos: Utxo[]; endIndex?: UtxoIndex }>,
): Promise<{ utxos: Utxo[]; complete: boolean }> {
  const byId = new Map<string, Utxo>();
  let startIndex: UtxoIndex | undefined;
  for (let page = 0; page < MAX_UTXO_PAGES; page++) {
    const { utxos, endIndex } = await readPage(startIndex);
    for (const utxo of utxos) byId.set(utxo.ID(), utxo);
    if (utxos.length < UTXO_PAGE_SIZE) return { utxos: [...byId.values()], complete: true };
    if (!endIndex) break;
    startIndex = endIndex;
  }
  return { utxos: [...byId.values()], complete: false };
}

/** The total of the UTXOs in nAVAX. */
export function totalNanoAvax(utxos: readonly Utxo<TransferOutput>[]): bigint {
  return utxos.reduce((sum, utxo) => sum + utxo.output.amount(), 0n);
}

/** The C-Chain base fee (eth_baseFee, in wei per gas) in nAVAX per gas, rounded up. At least 1. */
export function baseFeeNanoAvax(baseFeeWei: bigint): bigint {
  const nAvax = (baseFeeWei + WEI_PER_NANO_AVAX - 1n) / WEI_PER_NANO_AVAX;
  return nAvax > 0n ? nAvax : 1n;
}

/** The gas of a C-Chain ImportTx of the owner's AVAX in `utxos` (utils.costCorethTx, the gas that coreth charges). */
export function cImportGas(
  utxos: readonly Utxo<TransferOutput>[],
  owner: Uint8Array,
  context: Context.Context,
): bigint {
  // The size of the tx sets the gas. Any 20-byte address gives the same size.
  const sized = evm.newImportTx(context, new Uint8Array(20), [owner], [...utxos], context.pBlockchainID);
  return utils.costCorethTx(sized);
}

/**
 * The gas of a P-Chain ImportTx of the owner's AVAX in `utxos` with one output, as pvm.newImportTx builds it: the fee
 * of the tx at a gas price of 1 (pvm.calculateFee).
 */
export function pImportGas(
  utxos: readonly Utxo<TransferOutput>[],
  owner: Uint8Array,
  context: Context.Context,
): bigint {
  const imported = utxos.map(
    (utxo) => new TransferableInput(utxo.utxoId, utxo.assetId, TransferInput.fromNative(utxo.output.amount(), [0])),
  );
  const output = TransferableOutput.fromNative(context.avaxAssetID, totalNanoAvax(utxos), [owner]);
  const tx = new pvmSerial.ImportTx(
    new avaxSerial.BaseTx(
      new Int(context.networkID),
      Id.fromString(context.pBlockchainID),
      [output],
      [],
      new Bytes(new Uint8Array()),
    ),
    Id.fromString(context.cBlockchainID),
    imported,
  );
  return pvm.calculateFee(tx, context.platformFeeConfig.weights, 1n);
}

/** The gas of an import of the owner's AVAX in `utxos` on `side`. */
export function importGas(
  side: ImportSide,
  utxos: readonly Utxo<TransferOutput>[],
  owner: Uint8Array,
  context: Context.Context,
): bigint {
  return side === 'C' ? cImportGas(utxos, owner, context) : pImportGas(utxos, owner, context);
}

/**
 * The most gas of one P-Chain import (MAX_P_IMPORT_GAS): half the P-Chain's maxCapacity (platform.getFeeConfig, in the
 * page's context), or DEFAULT_MAX_P_IMPORT_GAS when the context has none. The SDK's pvm.newImportTx refuses an import
 * above the current capacity of the P-Chain. That capacity is below maxCapacity while the P-Chain is busy, so the
 * page keeps half of it free.
 */
export function maxPImportGas(context: Context.Context): bigint {
  const maxCapacity = context.platformFeeConfig?.maxCapacity;
  return typeof maxCapacity === 'bigint' && maxCapacity > 0n ? maxCapacity / 2n : DEFAULT_MAX_P_IMPORT_GAS;
}

/** The gas limit of one import on `side`: MAX_ATOMIC_TX_GAS on the C-Chain, maxPImportGas on the P-Chain. */
export function importGasLimit(side: ImportSide, context: Context.Context): bigint {
  return side === 'C' ? MAX_ATOMIC_TX_GAS : maxPImportGas(context);
}

/**
 * The gas that one more input adds to an import on `side`. Each UTXO of the owner (isOwnAvax) gives an input of the
 * same size with one signature, so the gas is the same for each of them. `sample` is any one of them.
 */
export function inputGas(
  side: ImportSide,
  sample: Utxo<TransferOutput>,
  owner: Uint8Array,
  context: Context.Context,
): bigint {
  // The same output under another UTXO ID: a second input of the same size.
  const index = sample.utxoId.outputIdx.value();
  const twin = new Utxo(
    new avaxSerial.UTXOID(sample.utxoId.txID, new Int(index === 0 ? 1 : 0)),
    sample.assetId,
    sample.output,
  );
  return importGas(side, [sample, twin], owner, context) - importGas(side, [sample], owner, context);
}

/**
 * The larger amount first. For the same amount, the UTXO IDs in order, so the page and the tests agree. The keys are
 * read once: ID() encodes base58check, and a flood of equal amounts made the sort the slowest part of a poll.
 */
function largestFirst(utxos: readonly Utxo<TransferOutput>[]): Utxo<TransferOutput>[] {
  return utxos
    .map((utxo) => ({ utxo, amount: utxo.output.amount(), id: utxo.ID() }))
    .sort((a, b) => {
      if (a.amount !== b.amount) return a.amount < b.amount ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map(({ utxo }) => utxo);
}

/**
 * The owner's AVAX that one import takes, at `price` (importFeeNanoAvax). Only the UTXOs that hold more than the fee of
 * their own input (inputGas times `price`), the largest first, as many as fit in importGasLimit. The others wait or
 * stay: the page counts them as blocked.
 */
export function selectImport(
  side: ImportSide,
  own: readonly Utxo<TransferOutput>[],
  owner: Uint8Array,
  context: Context.Context,
  price: bigint,
): Utxo<TransferOutput>[] {
  if (own.length === 0) return [];
  const gasPerInput = inputGas(side, own[0], owner, context);
  const inputFee = gasPerInput * price;
  // Drop the dust before the sort: a flood of dust then costs one pass, not a sort.
  const worth = largestFirst(own.filter((utxo) => utxo.output.amount() > inputFee));
  if (worth.length === 0) return [];
  const limit = importGasLimit(side, context);
  const firstGas = importGas(side, worth.slice(0, 1), owner, context);
  if (firstGas > limit) return [];
  // Each input adds the same gas, so no list longer than this fits. The bisection below checks the exact gas on it.
  const most = Math.min(worth.length, 1 + Number((limit - firstGas) / gasPerInput));
  const fits = (count: number) => importGas(side, worth.slice(0, count), owner, context) <= limit;
  if (fits(most)) return worth.slice(0, most);
  // A bisection finds the longest list that fits. `over` is a count that does not fit.
  let fit = 1;
  let over = most;
  while (over - fit > 1) {
    const mid = Math.floor((fit + over) / 2);
    if (fits(mid)) fit = mid;
    else over = mid;
  }
  return worth.slice(0, fit);
}

/**
 * The fee in nAVAX of an import of `utxos` to `owner`, as the SDK builds the import: importGas times `price`.
 * - 'P': `price` is the P-Chain gas price (platform.getFeeState). The fee equals pvm.calculateFee of the ImportTx.
 * - 'C': `price` is the C-Chain base fee in nAVAX per gas (baseFeeNanoAvax).
 */
export function importFeeNanoAvax(
  side: ImportSide,
  utxos: readonly Utxo<TransferOutput>[],
  owner: Uint8Array,
  context: Context.Context,
  price: bigint,
): bigint {
  return importGas(side, utxos, owner, context) * price;
}

/** What the page can import from one side of shared memory. */
export interface ImportableShare {
  /** The UTXOs of one import (selectImport) when their total is above its fee. Else empty. */
  utxos: Utxo<TransferOutput>[];
  /** The total of `utxos` in nAVAX. */
  amount: bigint;
  /**
   * The UTXOs that the wallet cannot import now: every other UTXO, the owner's AVAX that one import does not take,
   * and all of the owner's AVAX when the import cannot pay its fee.
   */
  blocked: number;
}

/**
 * The share that the page imports: `selected` (selectImport of memory.own) when its total is above `fee`, the fee of
 * an import of `selected`. An empty `selected` imports nothing. `fee` undefined: the price is not known yet, so the
 * page imports nothing and does not count the owner's AVAX as blocked.
 */
export function importableShare(
  memory: SharedMemory,
  selected: readonly Utxo<TransferOutput>[],
  fee: bigint | undefined,
): ImportableShare {
  const amount = totalNanoAvax(selected);
  if (fee !== undefined && selected.length > 0 && amount > fee) {
    return { utxos: [...selected], amount, blocked: memory.others.length + memory.own.length - selected.length };
  }
  const dust = fee !== undefined ? memory.own.length : 0;
  return { utxos: [], amount: 0n, blocked: memory.others.length + dust };
}

/**
 * What readImportableShare keeps between the polls of the page. `prices`: the fee price of a side for each set of the
 * owner's UTXOs there, so the page reads the price once per set. `fees`: the fee of an import by side, price and
 * selected UTXOs.
 */
export interface ImportFeeCache {
  prices: Map<string, bigint>;
  fees: Map<string, bigint>;
}

export function newImportFeeCache(): ImportFeeCache {
  return { prices: new Map(), fees: new Map() };
}

// Each poll can add a key, so a map that gets this large starts again.
const CACHE_ENTRIES = 64;

function remember(map: Map<string, bigint>, key: string, value: bigint): void {
  if (map.size >= CACHE_ENTRIES) map.clear();
  map.set(key, value);
}

const utxoSetKey = (side: ImportSide, utxos: readonly Utxo[]) =>
  `${side}:${utxos
    .map((utxo) => utxo.ID())
    .sort()
    .join(',')}`;

/**
 * Reads the share that the page imports from one side. `readPrice` gives the fee price of the side (importFeeNanoAvax).
 * The selection needs the price, so it runs before the selection, and only when the owner has AVAX there. A failed
 * price read gives an unknown fee: the next read tries again.
 */
export async function readImportableShare(o: {
  side: ImportSide;
  utxos: readonly Utxo[];
  address: string;
  context: Context.Context;
  readPrice: () => Promise<bigint>;
  feeCache: ImportFeeCache;
}): Promise<ImportableShare> {
  const owner = addressBytes(o.address);
  const memory = splitSharedMemory(o.utxos, o.context.avaxAssetID, owner);
  if (!owner || memory.own.length === 0) return importableShare(memory, [], undefined);
  const setKey = utxoSetKey(o.side, memory.own);
  let price = o.feeCache.prices.get(setKey);
  if (price === undefined) {
    try {
      price = await o.readPrice();
    } catch {
      return importableShare(memory, [], undefined);
    }
    remember(o.feeCache.prices, setKey, price);
  }
  const selected = selectImport(o.side, memory.own, owner, o.context, price);
  if (selected.length === 0) return importableShare(memory, [], 0n);
  const feeKey = `${price}:${utxoSetKey(o.side, selected)}`;
  let fee = o.feeCache.fees.get(feeKey);
  if (fee === undefined) {
    fee = importFeeNanoAvax(o.side, selected, owner, o.context, price);
    remember(o.feeCache.fees, feeKey, fee);
  }
  return importableShare(memory, selected, fee);
}

/**
 * The UTXOs as objects of the SDK's own avalanchejs, for the `utxos` of prepareImportTxn. @avalanche-sdk/client has
 * its own copy of avalanchejs, in another version, so the page's objects do not have the SDK's types. Each UTXO goes
 * through its bytes: the codec version, then the UTXO (getUtxoFromBytes reads that).
 */
export function toSdkUtxos(side: ImportSide, utxos: readonly Utxo[]): SdkUtxo[] {
  const manager = utils.getManagerForVM(side === 'P' ? 'PVM' : 'EVM');
  const codec = manager.getDefaultCodec();
  const version = manager.getDefaultCodecId().toBytes();
  return utxos.map((utxo) => getUtxoFromBytes(utils.concatBytes(version, utxo.toBytes(codec)), side));
}

/** The line about the UTXOs that the wallet cannot import, or null when there are none. */
export function blockedUtxosText(count: number): string | null {
  if (count <= 0) return null;
  return `This wallet cannot import ${count} ${count === 1 ? 'UTXO' : 'UTXOs'} in shared memory.`;
}

/**
 * The most that the page can export from a balance in AVAX, in nAVAX: the balance less `feeBufferNanoAvax`, so the
 * wallet keeps AVAX for the fee. 0 when the balance is not above the buffer or is not a number.
 */
export function maxSpendableNanoAvax(balanceAvax: number, feeBufferNanoAvax: bigint): bigint {
  if (!Number.isFinite(balanceAvax) || balanceAvax <= 0) return 0n;
  const spendable = toNanoAvax(balanceAvax) - feeBufferNanoAvax;
  return spendable > 0n ? spendable : 0n;
}

/** nAVAX as an AVAX decimal with no trailing zeros, for example 20.012999274. */
export function nanoAvaxText(nAvax: bigint): string {
  return formatUnits(nAvax, 9);
}
