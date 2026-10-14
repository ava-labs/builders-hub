// Atomic (shared memory) reads for the C/P bridge test (chain/bridge-cp.e2e.ts, lib/bridge-cp.ts) and teardown.ts.
//
// An atomic transfer is two txs. The export takes AVAX from one chain and puts it in shared memory as a UTXO that the
// other chain can import. The import takes that UTXO and gives the AVAX to an address on the other chain. Between the
// two, the AVAX is in shared memory, and the key still owns it.
//
// Node only: no page, no e2e runner. Reads go through chain.ts (public Fuji endpoints, 2 requests per second, a stop
// at the first 429).

import {
  avaxSerial,
  Bytes,
  evm,
  evmSerial,
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
import { readSignedTx } from '../wallet/codec.ts';
import { FUJI, RpcError, chainShows, freshParams, jsonRpc, waitForPTx } from './chain.ts';

/** The public API returns at most 1,024 UTXOs per call (sharedMemoryImport.ts UTXO_PAGE_SIZE). */
export const UTXO_PAGE = 1_024;
/** The most pages of getUTXOs that atomicUtxos reads for one side, as the page (sharedMemoryImport.ts). */
export const MAX_UTXO_PAGES = 10;

/**
 * coreth's gas limit for an atomic tx in its mempool (ap5.AtomicGasLimit). The mempool refuses a larger C-Chain
 * import. The page's C-Chain import takes at most the UTXOs that fit (sharedMemoryImport.ts MAX_ATOMIC_TX_GAS).
 */
export const MAX_ATOMIC_TX_GAS = 100_000n;

/**
 * The gas limit of one P-Chain import when the context has no P-Chain maxCapacity (sharedMemoryImport.ts
 * DEFAULT_MAX_P_IMPORT_GAS). Else the limit is half of maxCapacity (maxPImportGas).
 */
export const DEFAULT_MAX_P_IMPORT_GAS = 500_000n;

/**
 * What the page's selection rule needs on one side: the network context (its P-Chain fee config) and the fee price.
 * P-Chain: the gas price (platform.getFeeState). C-Chain: the base fee in nAVAX per gas.
 */
export interface ImportRule {
  context: Context.Context;
  price: bigint;
}

// The fields of the Fuji context that evm.newImportTx reads (avalanchejs 5.1.0). The gas of an import depends only on
// its size, so these give the gas that the page gets with its full context.
const C_IMPORT_CONTEXT = {
  networkID: FUJI.networkId,
  cBlockchainID: FUJI.cBlockchainId,
  avaxAssetID: FUJI.avaxAssetId,
} as Context.Context;

/**
 * The chain that can import the UTXO. 'P': AVAX that the C-Chain exported to the P-Chain (platform.getUTXOs with
 * sourceChain C). 'C': AVAX that the P-Chain exported to the C-Chain (avax.getUTXOs with sourceChain P).
 */
export type ImportSide = 'P' | 'C';

export interface AtomicUtxo {
  utxoId: string;
  assetId: string;
  /** nAVAX. 0 when the output is not a secp256k1 TransferOutput. */
  amount: bigint;
  transferOutput: boolean;
  /** Locktime 0, threshold 1, and the key's address alone. */
  ours: boolean;
  /** The UTXO itself, for an import tx (teardown.ts). */
  utxo: Utxo;
}

/**
 * The UTXOs in shared memory that `side` can import to this address (P-fuji1...). Public RPC, throttled. It reads page
 * by page, as the page does (sharedMemoryImport.ts readSharedMemory): until a page with fewer than UTXO_PAGE UTXOs,
 * or MAX_UTXO_PAGES pages. Past that, it prints one line and keeps what it read. Anyone can export a UTXO to the key's
 * address, so most of a full page can be UTXOs that the key cannot import: the callers ignore those (isOurAvax).
 */
export async function atomicUtxos(side: ImportSide, pChainAddress: string): Promise<AtomicUtxo[]> {
  const own = utils.bech32ToBytes(pChainAddress);
  // The C-Chain names the same 20 bytes C-fuji1...
  const read =
    side === 'P'
      ? { url: FUJI.pRpc, method: 'platform.getUTXOs', address: pChainAddress, sourceChain: 'C', vm: 'PVM' as const }
      : {
          url: FUJI.cAvax,
          method: 'avax.getUTXOs',
          address: pChainAddress.replace(/^P-/, 'C-'),
          sourceChain: 'P',
          vm: 'EVM' as const,
        };
  // A page starts at its startIndex, the last UTXO of the page before it, so each UTXO ID is kept once.
  const byId = new Map<string, AtomicUtxo>();
  let startIndex: { address: string; utxo: string } | undefined;
  for (let page = 1; ; page++) {
    const { utxos, endIndex } = await jsonRpc<{ utxos: string[]; endIndex?: { address: string; utxo: string } }>(
      read.url,
      read.method,
      {
        addresses: [read.address],
        sourceChain: read.sourceChain,
        limit: UTXO_PAGE,
        encoding: 'hex',
        ...(startIndex ? { startIndex } : {}),
      },
    );
    for (const u of readHexUtxos(read.vm, utxos, own)) byId.set(u.utxoId, u);
    if (utxos.length < UTXO_PAGE) break;
    if (page >= MAX_UTXO_PAGES || !endIndex) {
      console.warn(
        `${read.method}: shared memory holds more UTXOs for ${read.address} than ${page} pages. ` +
          `The test reads ${byId.size} of them, as the page does.`,
      );
      break;
    }
    startIndex = endIndex;
  }
  return [...byId.values()];
}

/**
 * The UTXOs of a getUTXOs answer with hex encoding (platform.getUTXOs: 'PVM', avax.getUTXOs: 'EVM'), read for the key
 * whose address bytes are `own`.
 */
export function readHexUtxos(vm: 'PVM' | 'EVM', hexes: string[], own: Uint8Array): AtomicUtxo[] {
  const manager = utils.getManagerForVM(vm);
  return hexes.map((hex) => readAtomicUtxo(manager.unpack(utils.hexToBuffer(hex), Utxo), own));
}

/** One UTXO of shared memory, read for the key whose address bytes are `own`. */
export function readAtomicUtxo(utxo: Utxo, own: Uint8Array): AtomicUtxo {
  const base = { utxoId: utxo.ID(), assetId: utxo.getAssetId(), utxo };
  if (!(utxo.output instanceof TransferOutput)) return { ...base, amount: 0n, transferOutput: false, ours: false };
  const out = utxo.output;
  const owners = out.getOwners();
  const ours =
    out.getLocktime() === 0n && out.getThreshold() === 1 && owners.length === 1 && utils.bytesEqual(owners[0], own);
  return { ...base, amount: out.amount(), transferOutput: true, ours };
}

/** The UTXOs of both sides. */
export async function strandedUtxos(pChainAddress: string): Promise<Record<ImportSide, AtomicUtxo[]>> {
  return { P: await atomicUtxos('P', pChainAddress), C: await atomicUtxos('C', pChainAddress) };
}

/**
 * Unlocked AVAX of this key alone: what the page, the e2e wallet and teardown.ts import. Anyone can export another
 * UTXO to this address (locked, another asset, more owners). The key cannot import it alone, so the tests and the
 * teardown leave it, and only print it.
 */
export const isOurAvax = (u: AtomicUtxo) => u.transferOutput && u.ours && u.assetId === FUJI.avaxAssetId;

/** The key's own unlocked AVAX on both sides (isOurAvax). */
export async function ourStrandedAvax(pChainAddress: string): Promise<Record<ImportSide, AtomicUtxo[]>> {
  const { P, C } = await strandedUtxos(pChainAddress);
  return { P: P.filter(isOurAvax), C: C.filter(isOurAvax) };
}

/** Why the key cannot import this UTXO alone, or undefined when it is the key's unlocked AVAX. */
export function notOursReason(u: AtomicUtxo): string | undefined {
  if (!u.transferOutput) return 'not a secp256k1 transfer output';
  if (u.assetId !== FUJI.avaxAssetId) return `asset ${u.assetId}`;
  if (!u.ours) return 'locked, or other owners';
  return undefined;
}

export const sumOf = (utxos: AtomicUtxo[]) => utxos.reduce((sum, u) => sum + u.amount, 0n);

// The 20 address bytes of the key: each UTXO of the key (isOurAvax) names them alone. The size of an import, so its
// gas, does not depend on the address, so an empty list takes any 20 bytes.
const ownerOf = (utxos: AtomicUtxo[]) =>
  utxos.length > 0 ? (utxos[0].utxo.output as TransferOutput).getOwners()[0] : new Uint8Array(20);

/** The gas of a C-Chain ImportTx of these UTXOs of the key (utils.costCorethTx), as the page computes it. */
export function cImportGas(utxos: AtomicUtxo[], context: Context.Context = C_IMPORT_CONTEXT): bigint {
  // The address that gets the AVAX does not change the size of the tx.
  const tx = evm.newImportTx(
    context,
    new Uint8Array(20),
    [ownerOf(utxos)],
    utxos.map((u) => u.utxo),
    FUJI.pBlockchainId,
  );
  return utils.costCorethTx(tx);
}

/**
 * The gas of a P-Chain ImportTx of these UTXOs of the key with one output, as pvm.newImportTx builds it and the page
 * computes it (sharedMemoryImport.ts pImportGas): the fee at a gas price of 1.
 */
export function pImportGas(utxos: AtomicUtxo[], context: Context.Context): bigint {
  const imported = utxos.map(
    (u) => new TransferableInput(u.utxo.utxoId, u.utxo.assetId, TransferInput.fromNative(u.amount, [0])),
  );
  const change = TransferableOutput.fromNative(context.avaxAssetID, sumOf(utxos), [ownerOf(utxos)]);
  const tx = new pvmSerial.ImportTx(
    new avaxSerial.BaseTx(
      new Int(context.networkID),
      Id.fromString(context.pBlockchainID),
      [change],
      [],
      new Bytes(new Uint8Array()),
    ),
    Id.fromString(context.cBlockchainID),
    imported,
  );
  return pvm.calculateFee(tx, context.platformFeeConfig.weights, 1n);
}

/** The gas of an import of these UTXOs of the key on `side`. */
export function importGas(side: ImportSide, utxos: AtomicUtxo[], context: Context.Context): bigint {
  return side === 'C' ? cImportGas(utxos, context) : pImportGas(utxos, context);
}

/** The fee in nAVAX of an import of these UTXOs of the key on `side`: its gas times the rule's price. */
export function importFeeOf(side: ImportSide, utxos: AtomicUtxo[], rule: ImportRule): bigint {
  return importGas(side, utxos, rule.context) * rule.price;
}

/**
 * The gas limit of one import on `side` (sharedMemoryImport.ts importGasLimit). C-Chain: MAX_ATOMIC_TX_GAS. P-Chain:
 * half the P-Chain's maxCapacity, because the SDK refuses an import above the current capacity of the P-Chain.
 */
export function importGasLimit(side: ImportSide, context: Context.Context): bigint {
  if (side === 'C') return MAX_ATOMIC_TX_GAS;
  const maxCapacity = context.platformFeeConfig?.maxCapacity;
  return typeof maxCapacity === 'bigint' && maxCapacity > 0n ? maxCapacity / 2n : DEFAULT_MAX_P_IMPORT_GAS;
}

/**
 * The fee in nAVAX of one more input in an import on `side` (sharedMemoryImport.ts inputGas times the price). Each UTXO
 * of the key gives an input of the same size, so `sample` is any one of them.
 */
export function inputFee(side: ImportSide, sample: AtomicUtxo, rule: ImportRule): bigint {
  // The same output under another UTXO ID: a second input of the same size.
  const index = sample.utxo.utxoId.outputIdx.value();
  const twinUtxo = new Utxo(
    new avaxSerial.UTXOID(sample.utxo.utxoId.txID, new Int(index === 0 ? 1 : 0)),
    sample.utxo.assetId,
    sample.utxo.output,
  );
  const twin = { ...sample, utxoId: twinUtxo.ID(), utxo: twinUtxo };
  return (importGas(side, [sample, twin], rule.context) - importGas(side, [sample], rule.context)) * rule.price;
}

/** The larger amount first. For the same amount, the UTXO IDs in order (as sharedMemoryImport.ts sorts them). */
function largestFirst(a: AtomicUtxo, b: AtomicUtxo): number {
  if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
  return a.utxoId < b.utxoId ? -1 : a.utxoId > b.utxoId ? 1 : 0;
}

/**
 * The key's own AVAX on `side` that holds more than the fee of its own input (inputFee), the largest first. The page
 * never imports another UTXO of the key: a UTXO that does not pay for its input would only raise the fee.
 */
export function worthImporting(side: ImportSide, utxos: AtomicUtxo[], rule: ImportRule): AtomicUtxo[] {
  const ours = utxos.filter(isOurAvax).sort(largestFirst);
  if (ours.length === 0) return [];
  const fee = inputFee(side, ours[0], rule);
  return ours.filter((u) => u.amount > fee);
}

/**
 * The key's own AVAX that the page's next import takes on `side` (components/toolbox/utils/sharedMemoryImport.ts
 * selectImport): the UTXOs that hold more than the fee of their own input (worthImporting), the largest first, as many
 * as fit in importGasLimit. The page gives the SDK exactly these UTXOs, so the import spends them and no other UTXO.
 * The page imports them only when their total is above the import fee (importFeeOf).
 */
export function importSelection(side: ImportSide, utxos: AtomicUtxo[], rule: ImportRule): AtomicUtxo[] {
  const worth = worthImporting(side, utxos, rule);
  if (worth.length === 0) return [];
  const limit = importGasLimit(side, rule.context);
  const fits = (count: number) => importGas(side, worth.slice(0, count), rule.context) <= limit;
  if (fits(worth.length)) return worth;
  // Each input adds gas, so a bisection finds the longest list that fits. `over` is a count that does not fit.
  let fit = 0;
  let over = worth.length;
  while (over - fit > 1) {
    const mid = Math.floor((fit + over) / 2);
    if (fits(mid)) fit = mid;
    else over = mid;
  }
  return worth.slice(0, fit);
}

/**
 * How many imports of the page take all of the key's AVAX that the page imports on `side` (worthImporting), when each
 * one pays its fee.
 */
export function importsToClear(side: ImportSide, utxos: AtomicUtxo[], rule: ImportRule): number {
  let rest = utxos.filter(isOurAvax);
  let imports = 0;
  while (rest.length > 0) {
    const taken = new Set(importSelection(side, rest, rule).map((u) => u.utxoId));
    if (taken.size === 0) break;
    rest = rest.filter((u) => !taken.has(u.utxoId));
    imports++;
  }
  return imports;
}

/**
 * The UTXO IDs that an accepted import spent, from the chain: platform.getTx (P-Chain, past the cache of the public
 * API) or avax.getAtomicTx (C-Chain).
 */
export async function importedUtxoIds(side: ImportSide, txId: string): Promise<string[]> {
  const { tx } =
    side === 'P'
      ? await jsonRpc<{ tx: string }>(FUJI.pRpc, 'platform.getTx', freshParams({ txID: txId, encoding: 'hex' }))
      : await jsonRpc<{ tx: string }>(FUJI.cAvax, 'avax.getAtomicTx', { txID: txId, encoding: 'hex' });
  // The hex ends with a 4-byte checksum.
  const decoded = readSignedTx(side === 'P' ? 'PVM' : 'EVM', utils.hexToBuffer(tx).slice(0, -4)).tx;
  if (side === 'P' && pvmSerial.isImportTx(decoded)) return decoded.ins.map((input) => input.utxoID.ID());
  if (side === 'C' && evmSerial.isImportTx(decoded)) return decoded.importedInputs.map((input) => input.utxoID.ID());
  throw new Error(`Tx ${txId} is a ${decoded._type}, not an ImportTx of the ${side}-Chain`);
}

/** The block height of a C-Chain atomic tx (avax.getAtomicTx), or null while a node does not show it. */
export async function cAtomicTxHeight(txId: string): Promise<string | null> {
  try {
    const { blockHeight } = await jsonRpc<{ blockHeight?: string }>(FUJI.cAvax, 'avax.getAtomicTx', {
      txID: txId,
      encoding: 'hex',
    });
    return blockHeight ?? null;
  } catch (error) {
    if (error instanceof RpcError && /not found|could not find/i.test(error.message)) return null;
    throw error;
  }
}

/**
 * Waits until the chain accepted an atomic tx. P-Chain: platform.getTxStatus is Committed. C-Chain: avax.getAtomicTx
 * gives a block height (the public nodes stopped serving avax.getAtomicTxStatus after Helicon).
 */
export async function confirmAtomic(chain: ImportSide, txId: string): Promise<Record<string, string>> {
  if (chain === 'P') {
    await waitForPTx(txId);
    return { status: 'Committed' };
  }
  const blockHeight = await chainShows(`the C-Chain accepted atomic tx ${txId}`, () => cAtomicTxHeight(txId), 180_000);
  return { blockHeight };
}
