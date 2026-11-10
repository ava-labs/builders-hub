import { describe, expect, it } from 'vitest';
import {
  avaxSerial,
  BigIntPr,
  Common,
  evm,
  Id,
  Int,
  OutputOwners,
  pvm,
  pvmSerial,
  secp256k1,
  TransferOutput,
  utils,
  Utxo,
  type Context,
} from '@avalabs/avalanchejs';
import { prepareImportTxn as prepareCImport } from '@avalanche-sdk/client/methods/wallet/cChain';
import { prepareImportTxn as preparePImport } from '@avalanche-sdk/client/methods/wallet/pChain';
import { Utxo as SdkUtxo } from '@avalanche-sdk/client/serializable';
import {
  addressBytes,
  baseFeeNanoAvax,
  blockedUtxosText,
  cImportGas,
  DEFAULT_MAX_P_IMPORT_GAS,
  importableShare,
  importFeeNanoAvax,
  importGas,
  inputGas,
  isOwnAvax,
  MAX_ATOMIC_TX_GAS,
  MAX_UTXO_PAGES,
  maxPImportGas,
  maxSpendableNanoAvax,
  MORE_UTXOS_TEXT,
  nanoAvaxText,
  newImportFeeCache,
  pImportGas,
  readImportableShare,
  readSharedMemory,
  selectImport,
  splitSharedMemory,
  toSdkUtxos,
  totalNanoAvax,
  UTXO_PAGE_SIZE,
  type UtxoIndex,
} from '@/components/toolbox/utils/sharedMemoryImport';

const AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
// Any other 32-byte ID works as another asset
const OTHER_ASSET = Id.fromHex(`0x${'22'.repeat(32)}`).toString();
const OWNER = new Uint8Array(20).fill(7);
const STRANGER = new Uint8Array(20).fill(9);
const P_ADDRESS = `P-${utils.formatBech32('fuji', OWNER)}`;
const C_ADDRESS = `C-${utils.formatBech32('fuji', OWNER)}`;
const NANO_AVAX = 1_000_000_000n;

// Fuji: the P-Chain fee weights and the chain IDs (the fields the import builders read)
const CONTEXT = {
  networkID: 5,
  hrp: 'fuji',
  xBlockchainID: '2JVSBoinj9C2J33VntvzYtVJNZdN2NKiwwKjcumHUWEb5DbBrm',
  pBlockchainID: '11111111111111111111111111111111LpoYY',
  cBlockchainID: 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp',
  avaxAssetID: AVAX,
  baseTxFee: 1_000_000n,
  createAssetTxFee: 10_000_000n,
  platformFeeConfig: {
    weights: Common.createDimensions({ bandwidth: 1, dbRead: 1_000, dbWrite: 1_000, compute: 4 }),
    maxCapacity: 1_000_000n,
    maxPerSecond: 100_000n,
    targetPerSecond: 50_000n,
    minPrice: 1n,
    excessConversionConstant: 2_164_043n,
  },
} as Context.Context;

let nextTx = 1;

/** A UTXO in shared memory. Each call gets its own tx ID. */
function utxo(
  amount: bigint,
  o: { owners?: Uint8Array[]; threshold?: number; locktime?: bigint; asset?: string } = {},
): Utxo<TransferOutput> {
  const txId = Id.fromHex(`0x${(nextTx++).toString(16).padStart(64, '0')}`);
  const owners = OutputOwners.fromNative(o.owners ?? [OWNER], o.locktime ?? 0n, o.threshold ?? 1);
  return new Utxo(
    new avaxSerial.UTXOID(txId, new Int(0)),
    Id.fromString(o.asset ?? AVAX),
    new TransferOutput(new BigIntPr(amount), owners),
  );
}

/** A stakeable locked output: not a TransferOutput. */
function lockedStake(amount: bigint): Utxo {
  const txId = Id.fromHex(`0x${(nextTx++).toString(16).padStart(64, '0')}`);
  const inner = new TransferOutput(new BigIntPr(amount), OutputOwners.fromNative([OWNER], 0n, 1));
  return new Utxo(
    new avaxSerial.UTXOID(txId, new Int(0)),
    Id.fromString(AVAX),
    new pvmSerial.StakeableLockOut(new BigIntPr(4_000_000_000n), inner),
  );
}

describe('isOwnAvax', () => {
  it('takes unlocked AVAX with the owner as the only address and threshold 1', () => {
    expect(isOwnAvax(utxo(NANO_AVAX), AVAX, OWNER)).toBe(true);
  });

  it('refuses each UTXO that the wallet cannot import alone', () => {
    expect(isOwnAvax(utxo(NANO_AVAX, { locktime: 4_000_000_000n }), AVAX, OWNER)).toBe(false);
    expect(isOwnAvax(utxo(NANO_AVAX, { owners: [OWNER, STRANGER], threshold: 2 }), AVAX, OWNER)).toBe(false);
    expect(isOwnAvax(utxo(NANO_AVAX, { owners: [OWNER, STRANGER], threshold: 1 }), AVAX, OWNER)).toBe(false);
    expect(isOwnAvax(utxo(NANO_AVAX, { owners: [STRANGER] }), AVAX, OWNER)).toBe(false);
    expect(isOwnAvax(utxo(NANO_AVAX, { asset: OTHER_ASSET }), AVAX, OWNER)).toBe(false);
    expect(isOwnAvax(lockedStake(NANO_AVAX), AVAX, OWNER)).toBe(false);
  });
});

describe('addressBytes', () => {
  it('reads the same 20 bytes from the P-Chain and the C-Chain address', () => {
    expect(addressBytes(P_ADDRESS)).toEqual(OWNER);
    expect(addressBytes(C_ADDRESS)).toEqual(OWNER);
  });

  it('gives null for an address that does not parse', () => {
    expect(addressBytes('')).toBeNull();
    expect(addressBytes('0x1234')).toBeNull();
  });
});

describe('splitSharedMemory and importableShare', () => {
  const own = [utxo(3_000_000n), utxo(2_000_000n)];
  const foreign = [utxo(NANO_AVAX, { owners: [STRANGER] }), utxo(NANO_AVAX, { locktime: 4_000_000_000n })];
  const memory = splitSharedMemory([...own, ...foreign], AVAX, OWNER);

  it('splits the owner AVAX from every other UTXO', () => {
    expect(memory.own).toEqual(own);
    expect(memory.others).toEqual(foreign);
    expect(totalNanoAvax(memory.own)).toBe(5_000_000n);
  });

  it('puts every UTXO in others when the address does not parse', () => {
    expect(splitSharedMemory(own, AVAX, null)).toEqual({ own: [], others: own });
  });

  it('imports the owner AVAX when its total is above the fee', () => {
    expect(importableShare(memory, memory.own, 4_999_999n)).toEqual({ utxos: own, amount: 5_000_000n, blocked: 2 });
  });

  it('counts the owner AVAX as blocked when its total does not pay the fee (dust)', () => {
    expect(importableShare(memory, memory.own, 5_000_000n)).toEqual({ utxos: [], amount: 0n, blocked: 4 });
  });

  it('imports nothing while the fee is not known, and blocks only the other UTXOs', () => {
    expect(importableShare(memory, memory.own, undefined)).toEqual({ utxos: [], amount: 0n, blocked: 2 });
  });

  it('blocks only the other UTXOs when the owner has no AVAX there', () => {
    const none = splitSharedMemory(foreign, AVAX, OWNER);
    expect(importableShare(none, [], 1n)).toEqual({ utxos: [], amount: 0n, blocked: 2 });
  });

  it('imports only the selected UTXOs, and counts the owner AVAX that the import does not take as blocked', () => {
    expect(importableShare(memory, [own[0]], 1n)).toEqual({ utxos: [own[0]], amount: 3_000_000n, blocked: 3 });
  });
});

// 0.001 AVAX: above the fee of its own input on both sides at the prices of these tests
const MILLI_AVAX = NANO_AVAX / 1_000n;

describe('inputGas and the gas limits', () => {
  it('is the gas that one more input adds, the same for each own UTXO', () => {
    const own = Array.from({ length: 4 }, () => utxo(MILLI_AVAX));
    for (const side of ['P', 'C'] as const) {
      const gas = (count: number) => importGas(side, own.slice(0, count), OWNER, CONTEXT);
      const step = inputGas(side, own[0], OWNER, CONTEXT);
      expect(step).toBeGreaterThan(0n);
      expect([gas(2) - gas(1), gas(3) - gas(2), gas(4) - gas(3)]).toEqual([step, step, step]);
    }
    expect(inputGas('C', own[0], OWNER, CONTEXT)).toBe(1_088n);
    expect(inputGas('P', own[0], OWNER, CONTEXT)).toBe(2_961n);
  });

  it("P: half the P-Chain's maxCapacity, or 500,000 gas when the context has none", () => {
    expect(maxPImportGas(CONTEXT)).toBe(500_000n);
    const config = { ...CONTEXT.platformFeeConfig, maxCapacity: 600_000n };
    expect(maxPImportGas({ ...CONTEXT, platformFeeConfig: config })).toBe(300_000n);
    const none = { ...CONTEXT, platformFeeConfig: { ...CONTEXT.platformFeeConfig, maxCapacity: 0n } };
    expect(maxPImportGas(none)).toBe(DEFAULT_MAX_P_IMPORT_GAS);
    expect(maxPImportGas({ ...CONTEXT, platformFeeConfig: undefined } as unknown as Context.Context)).toBe(
      DEFAULT_MAX_P_IMPORT_GAS,
    );
  });
});

describe('selectImport', () => {
  it('P: takes all of the owner AVAX that fits, the largest first', () => {
    const own = [utxo(MILLI_AVAX), utxo(NANO_AVAX), utxo(2n * MILLI_AVAX)];
    expect(selectImport('P', own, OWNER, CONTEXT, 1n)).toEqual([own[1], own[2], own[0]]);
  });

  it('C: takes the largest UTXOs first, and the UTXO IDs in order for the same amount', () => {
    const [a, b, c] = [utxo(5n * MILLI_AVAX), utxo(7n * MILLI_AVAX), utxo(5n * MILLI_AVAX)];
    expect(selectImport('C', [a, b, c], OWNER, CONTEXT, 1n)).toEqual([
      b,
      ...[a, c].sort((x, y) => (x.ID() < y.ID() ? -1 : 1)),
    ]);
  });

  it('leaves each UTXO that does not hold more than the fee of its own input, on both sides', () => {
    for (const side of ['P', 'C'] as const) {
      const price = 25n;
      const inputFee = inputGas(side, utxo(1n), OWNER, CONTEXT) * price;
      const at = utxo(inputFee);
      const above = utxo(inputFee + 1n);
      const big = utxo(NANO_AVAX);
      expect(selectImport(side, [at, above, big, utxo(1n)], OWNER, CONTEXT, price)).toEqual([big, above]);
      // At a price of 1, the same UTXO holds more than the fee of its input
      expect(selectImport(side, [at], OWNER, CONTEXT, 1n)).toEqual([at]);
      // Only dust: no import
      expect(selectImport(side, [at, utxo(1n)], OWNER, CONTEXT, price)).toEqual([]);
    }
  });

  it("C: stops before the import goes above coreth's gas limit for an atomic tx", () => {
    const big = utxo(NANO_AVAX);
    const small = Array.from({ length: 90 }, () => utxo(MILLI_AVAX));
    const all = [...small, big];
    expect(cImportGas(all, OWNER, CONTEXT)).toBeGreaterThan(MAX_ATOMIC_TX_GAS);
    const selected = selectImport('C', all, OWNER, CONTEXT, 1n);
    expect(selected[0]).toBe(big);
    expect(selected).toHaveLength(82);
    expect(cImportGas(selected, OWNER, CONTEXT)).toBeLessThanOrEqual(MAX_ATOMIC_TX_GAS);
    // One more UTXO would not fit
    const next = all.find((u) => !selected.includes(u));
    expect(next).toBeDefined();
    expect(cImportGas([...selected, next!], OWNER, CONTEXT)).toBeGreaterThan(MAX_ATOMIC_TX_GAS);
  });

  it('P: stops before the import goes above half the P-Chain maxCapacity', () => {
    const big = utxo(NANO_AVAX / 10n);
    const small = Array.from({ length: 400 }, () => utxo(MILLI_AVAX));
    const all = [...small, big];
    expect(pImportGas(all, OWNER, CONTEXT)).toBeGreaterThan(CONTEXT.platformFeeConfig.maxCapacity);
    const selected = selectImport('P', all, OWNER, CONTEXT, 1n);
    expect(selected[0]).toBe(big);
    expect(selected).toHaveLength(168);
    expect(pImportGas(selected, OWNER, CONTEXT)).toBeLessThanOrEqual(maxPImportGas(CONTEXT));
    const next = all.find((u) => !selected.includes(u));
    expect(pImportGas([...selected, next!], OWNER, CONTEXT)).toBeGreaterThan(maxPImportGas(CONTEXT));
  });
});

describe('readSharedMemory', () => {
  // A node with `count` UTXOs at one address. Like avalanchego's shared memory index, a page starts at its startIndex
  // (the last UTXO of the page before it), so each page after the first repeats one UTXO.
  function node(count: number) {
    const all = Array.from({ length: count }, () => utxo(1n));
    const starts: (UtxoIndex | undefined)[] = [];
    const readPage = async (startIndex: UtxoIndex | undefined) => {
      starts.push(startIndex);
      const from = startIndex ? all.findIndex((u) => u.ID() === startIndex.utxo) : 0;
      const utxos = all.slice(from, from + UTXO_PAGE_SIZE);
      const last = utxos.at(-1);
      return { utxos, endIndex: { address: P_ADDRESS, utxo: last ? last.ID() : '' } };
    };
    return { all, starts, readPage };
  }

  it('reads every page until a short page, and keeps each UTXO once', async () => {
    for (const [count, pages] of [
      [0, 1],
      [5, 1],
      [UTXO_PAGE_SIZE, 2],
      [2 * UTXO_PAGE_SIZE - 1, 3],
      [3_000, 3],
    ] as const) {
      const { all, starts, readPage } = node(count);
      const read = await readSharedMemory(readPage);
      expect(read.complete).toBe(true);
      expect(read.utxos.map((u) => u.ID()).sort()).toEqual(all.map((u) => u.ID()).sort());
      expect(starts).toHaveLength(pages);
    }
  });

  it('starts each page at the endIndex of the page before it', async () => {
    const { all, starts, readPage } = node(2_500);
    await readSharedMemory(readPage);
    expect(starts).toEqual([
      undefined,
      { address: P_ADDRESS, utxo: all[UTXO_PAGE_SIZE - 1].ID() },
      { address: P_ADDRESS, utxo: all[2 * UTXO_PAGE_SIZE - 2].ID() },
    ]);
  });

  it('stops after MAX_UTXO_PAGES pages and says that shared memory holds more', async () => {
    const { starts, readPage } = node(12_000);
    const read = await readSharedMemory(readPage);
    expect(read.complete).toBe(false);
    expect(starts).toHaveLength(MAX_UTXO_PAGES);
    expect(read.utxos).toHaveLength(UTXO_PAGE_SIZE + (MAX_UTXO_PAGES - 1) * (UTXO_PAGE_SIZE - 1));
    expect(MORE_UTXOS_TEXT).toBe('Shared memory holds more UTXOs than this page reads.');
  });
});

describe('toSdkUtxos', () => {
  it("gives the same UTXOs as objects of the SDK's avalanchejs", () => {
    const list = [utxo(NANO_AVAX), utxo(NANO_AVAX, { owners: [OWNER, STRANGER], threshold: 2 })];
    for (const side of ['P', 'C'] as const) {
      const vm = side === 'P' ? 'PVM' : 'EVM';
      const codec = utils.getManagerForVM(vm).getDefaultCodec();
      const converted = toSdkUtxos(side, list);
      expect(converted.every((u) => u instanceof SdkUtxo)).toBe(true);
      expect(converted.map((u) => u.ID())).toEqual(list.map((u) => u.ID()));
      expect(converted.map((u) => utils.bufferToHex(u.toBytes(codec)))).toEqual(
        list.map((u) => utils.bufferToHex(u.toBytes(codec))),
      );
    }
  });
});

describe('importFeeNanoAvax', () => {
  it('P: equals the fee that pvm.newImportTx burns for the same UTXOs', () => {
    const own = [utxo(NANO_AVAX), utxo(2n * NANO_AVAX)];
    const price = 37n;
    const fee = importFeeNanoAvax('P', own, OWNER, CONTEXT, price);
    const tx = pvm.newImportTx(
      {
        fromAddressesBytes: [OWNER],
        toAddressesBytes: [OWNER],
        sourceChainId: CONTEXT.cBlockchainID,
        utxos: own,
        feeState: { capacity: 1_000_000n, excess: 0n, price, timestamp: '0' },
      },
      CONTEXT,
    );
    const burned = utils
      .getBurnedAmountByTx(tx.getTx() as Parameters<typeof utils.getBurnedAmountByTx>[0], CONTEXT)
      .get(AVAX);
    expect(fee).toBeGreaterThan(0n);
    expect(fee).toBe(burned);
  });

  it('C: is the gas of the import times the base fee in nAVAX', () => {
    const own = [utxo(NANO_AVAX)];
    const gas = utils.costCorethTx(evm.newImportTx(CONTEXT, new Uint8Array(20), [OWNER], own, CONTEXT.pBlockchainID));
    expect(gas).toBeGreaterThan(10_000n);
    expect(importFeeNanoAvax('C', own, OWNER, CONTEXT, 2n)).toBe(gas * 2n);
  });

  it('rounds the C-Chain base fee up to whole nAVAX, at least 1', () => {
    expect(baseFeeNanoAvax(25_000_000_000n)).toBe(25n);
    expect(baseFeeNanoAvax(25_000_000_001n)).toBe(26n);
    expect(baseFeeNanoAvax(1n)).toBe(1n);
    expect(baseFeeNanoAvax(0n)).toBe(1n);
  });
});

describe('readImportableShare', () => {
  it('reads the price once per set of UTXOs, and only when the owner has AVAX there', async () => {
    const feeCache = newImportFeeCache();
    let reads = 0;
    const readPrice = async () => {
      reads++;
      return 1n;
    };
    const own = [utxo(NANO_AVAX)];
    const foreign = [utxo(NANO_AVAX, { owners: [STRANGER] })];

    const none = await readImportableShare({
      side: 'C',
      utxos: foreign,
      address: C_ADDRESS,
      context: CONTEXT,
      readPrice,
      feeCache,
    });
    expect(none).toEqual({ utxos: [], amount: 0n, blocked: 1 });
    expect(reads).toBe(0);

    const args = { side: 'C' as const, utxos: [...own, ...foreign], address: C_ADDRESS, context: CONTEXT };
    const first = await readImportableShare({ ...args, readPrice, feeCache });
    const second = await readImportableShare({ ...args, readPrice, feeCache });
    expect(first).toEqual({ utxos: own, amount: NANO_AVAX, blocked: 1 });
    expect(second).toEqual(first);
    expect(reads).toBe(1);

    // A new UTXO of the owner is a new set: the page reads the price again
    const more = [...own, utxo(NANO_AVAX)];
    await readImportableShare({ ...args, utxos: more, readPrice, feeCache });
    expect(reads).toBe(2);
  });

  it('selects at the price that it reads: a higher price leaves the UTXOs that do not pay for their input', async () => {
    const big = utxo(NANO_AVAX);
    const small = utxo(100_000n);
    const share = (price: bigint) =>
      readImportableShare({
        side: 'C',
        utxos: [big, small],
        address: C_ADDRESS,
        context: CONTEXT,
        readPrice: async () => price,
        feeCache: newImportFeeCache(),
      });
    // 1,088 gas per input: 1,088 nAVAX at a price of 1, 108,800 nAVAX at a price of 100
    expect(await share(1n)).toEqual({ utxos: [big, small], amount: NANO_AVAX + 100_000n, blocked: 0 });
    expect(await share(100n)).toEqual({ utxos: [big], amount: NANO_AVAX, blocked: 1 });
  });

  it('keys the fee by the price and the selected UTXOs', async () => {
    const feeCache = newImportFeeCache();
    const own = [utxo(NANO_AVAX)];
    await readImportableShare({
      side: 'P',
      utxos: own,
      address: P_ADDRESS,
      context: CONTEXT,
      readPrice: async () => 37n,
      feeCache,
    });
    expect([...feeCache.fees.entries()]).toEqual([
      [`37:P:${own[0].ID()}`, importFeeNanoAvax('P', own, OWNER, CONTEXT, 37n)],
    ]);
    expect([...feeCache.prices.entries()]).toEqual([[`P:${own[0].ID()}`, 37n]]);
  });

  it('gives an unknown fee when the price read fails, and reads again next time', async () => {
    const feeCache = newImportFeeCache();
    const own = [utxo(NANO_AVAX)];
    const args = { side: 'P' as const, utxos: own, address: P_ADDRESS, context: CONTEXT, feeCache };
    const failed = await readImportableShare({
      ...args,
      readPrice: async () => {
        throw new Error('HTTP 429');
      },
    });
    expect(failed).toEqual({ utxos: [], amount: 0n, blocked: 0 });
    const next = await readImportableShare({ ...args, readPrice: async () => 1n });
    expect(next).toEqual({ utxos: own, amount: NANO_AVAX, blocked: 0 });
  });

  it('blocks dust: own AVAX that does not pay the fee', async () => {
    const read = (utxos: Utxo[]) =>
      readImportableShare({
        side: 'P',
        utxos,
        address: P_ADDRESS,
        context: CONTEXT,
        readPrice: async () => 1n,
        feeCache: newImportFeeCache(),
      });
    // Not above the fee of its own input (2,961 nAVAX at a price of 1)
    expect(await read([utxo(1n)])).toEqual({ utxos: [], amount: 0n, blocked: 1 });
    // Above the fee of its input, but not above the fee of the whole import (4,135 nAVAX)
    expect(await read([utxo(4_000n)])).toEqual({ utxos: [], amount: 0n, blocked: 1 });
  });
});

// The SDK's own prepareImportTxn, with the UTXOs that the page gives it (CrossChainTransfer.tsx handleImport). The
// client answers the base fee, the account key and the P-Chain fee state, and fails on any UTXO read.
describe('the SDK import of the page share', () => {
  // 25 nAVAX per gas: the SDK's fee (floor of base fee times gas) and the page's fee (baseFeeNanoAvax) agree.
  const BASE_FEE_WEI = 25_000_000_000n;
  const P_PRICE = 37n;
  const P_CAPACITY = 1_000_000n;
  const TO_ADDRESS = `0x${'11'.repeat(20)}`;
  // Any valid public key: the SDK derives an address from it, but uses `fromAddresses`.
  const PUBLIC_KEY = utils.bufferToHex(
    secp256k1.getPublicKey(Uint8Array.from({ length: 32 }, (_, i) => (i === 31 ? 1 : 0))),
  );
  const refuse = async ({ method }: { method: string }) => {
    throw new Error(`the SDK read ${method}`);
  };
  const client = {
    request: async ({ method }: { method: string }) => {
      if (method === 'eth_baseFee') return `0x${BASE_FEE_WEI.toString(16)}`;
      if (method === 'avalanche_getAccountPubKey') return { xp: PUBLIC_KEY, evm: PUBLIC_KEY };
      return refuse({ method });
    },
    pChainClient: {
      request: async ({ method }: { method: string }) =>
        method === 'platform.getFeeState'
          ? { capacity: P_CAPACITY.toString(), excess: '0', price: P_PRICE.toString(), timestamp: '0' }
          : refuse({ method }),
    },
    cChainClient: { request: refuse },
  };

  /** The C-Chain ImportTx that the SDK builds from `utxos`: its inputs, the nAVAX it burns, and its gas. */
  async function cImport(utxos: Utxo<TransferOutput>[]) {
    const { tx, importTx } = await prepareCImport(client as unknown as Parameters<typeof prepareCImport>[0], {
      sourceChain: 'P',
      toAddress: TO_ADDRESS,
      fromAddresses: [C_ADDRESS],
      utxos: toSdkUtxos('C', utxos),
      context: CONTEXT,
    });
    const imported = importTx.importedInputs.reduce((sum, input) => sum + input.amount(), 0n);
    const credited = importTx.Outs.reduce((sum, out) => sum + out.amount.value(), 0n);
    return { inputs: importTx.importedInputs.length, burned: imported - credited, gas: utils.costCorethTx(tx) };
  }

  /** The P-Chain ImportTx that the SDK builds from `utxos`: the UTXO IDs of its inputs and the nAVAX it burns. */
  async function pImport(utxos: Utxo<TransferOutput>[]) {
    const { importTx } = await preparePImport(client as unknown as Parameters<typeof preparePImport>[0], {
      sourceChain: 'C',
      importedOutput: { addresses: [P_ADDRESS] },
      fromAddresses: [P_ADDRESS],
      utxos: toSdkUtxos('P', utxos),
      context: CONTEXT,
    });
    const imported = importTx.ins.reduce((sum, input) => sum + input.amount(), 0n);
    const credited = importTx.baseTx.outputs.reduce((sum, out) => sum + out.amount(), 0n);
    return { ids: importTx.ins.map((input) => input.utxoID.ID()), burned: imported - credited };
  }

  const share = (side: 'P' | 'C', utxos: Utxo[]) =>
    readImportableShare({
      side,
      utxos,
      address: side === 'P' ? P_ADDRESS : C_ADDRESS,
      context: CONTEXT,
      readPrice: async () => (side === 'P' ? P_PRICE : baseFeeNanoAvax(BASE_FEE_WEI)),
      feeCache: newImportFeeCache(),
    });

  it('C: with a foreign threshold-2 UTXO first, the import burns the full fee', async () => {
    const foreign = utxo(NANO_AVAX, { owners: [OWNER, STRANGER], threshold: 2 });
    const own = utxo(NANO_AVAX);
    const page = await share('C', [foreign, own]);
    expect(page).toEqual({ utxos: [own], amount: NANO_AVAX, blocked: 1 });

    const built = await cImport(page.utxos);
    expect(built.inputs).toBe(1);
    expect(built.burned).toBe(importFeeNanoAvax('C', [own], OWNER, CONTEXT, 25n));
    expect(built.burned).toBe(built.gas * 25n);

    // Without the page's UTXOs, the SDK reads every UTXO at the address. evm.newImportTx counts the foreign UTXO
    // toward the fee and then skips it, so the import burns nothing and coreth refuses it.
    const unfiltered = await cImport([foreign, own]);
    expect(unfiltered.inputs).toBe(1);
    expect(unfiltered.burned).toBe(0n);
  });

  it('C: 100 one-nAVAX UTXOs do not dilute a 0.002 AVAX export at a price of 25', async () => {
    const dust = Array.from({ length: 100 }, () => utxo(1n));
    // Before the export: dust only. The page imports nothing and counts all 100 as blocked.
    expect(await share('C', dust)).toEqual({ utxos: [], amount: 0n, blocked: 100 });

    const exported = utxo(2n * MILLI_AVAX);
    const page = await share('C', [...dust, exported]);
    expect(page).toEqual({ utxos: [exported], amount: 2n * MILLI_AVAX, blocked: 100 });
    const built = await cImport(page.utxos);
    expect(built.inputs).toBe(1);
    expect(built.burned).toBe(built.gas * 25n);
    expect(built.burned).toBeLessThan(2n * MILLI_AVAX);

    // Round 4 took the 82 largest by amount alone: their fee was above the 0.002 AVAX, so the page imported nothing.
    const diluted = [exported, ...dust.slice(0, 81)];
    expect(importFeeNanoAvax('C', diluted, OWNER, CONTEXT, 25n)).toBeGreaterThan(totalNanoAvax(diluted));
  });

  it("C: with 90 more UTXOs of the owner, the import stays within coreth's gas limit", async () => {
    const small = Array.from({ length: 90 }, () => utxo(MILLI_AVAX));
    const exported = utxo(NANO_AVAX);
    const page = await share('C', [...small, exported]);
    expect(page.utxos[0]).toBe(exported);
    expect(page.utxos).toHaveLength(82);
    expect(page.blocked).toBe(91 - 82);
    const built = await cImport(page.utxos);
    expect(built.inputs).toBe(82);
    expect(built.gas).toBeLessThanOrEqual(MAX_ATOMIC_TX_GAS);
    expect(built.burned).toBe(built.gas * 25n);

    // All 91 UTXOs in one import: above the limit, so coreth's mempool refuses it.
    expect((await cImport([...small, exported])).gas).toBeGreaterThan(MAX_ATOMIC_TX_GAS);
  });

  it('P: with a foreign UTXO in shared memory, the import takes the own UTXO and burns the page fee', async () => {
    const foreign = utxo(NANO_AVAX, { owners: [OWNER, STRANGER], threshold: 2 });
    const own = utxo(NANO_AVAX);
    const page = await share('P', [foreign, own]);
    expect(page).toEqual({ utxos: [own], amount: NANO_AVAX, blocked: 1 });

    const built = await pImport(page.utxos);
    expect(built.ids).toEqual([own.ID()]);
    expect(built.burned).toBe(importFeeNanoAvax('P', [own], OWNER, CONTEXT, P_PRICE));
  });

  it('P: 400 one-nAVAX UTXOs and a 0.1 AVAX export: the page imports the export, and the SDK builds it', async () => {
    const dust = Array.from({ length: 400 }, () => utxo(1n));
    const exported = utxo(NANO_AVAX / 10n);
    const page = await share('P', [...dust, exported]);
    expect(page).toEqual({ utxos: [exported], amount: NANO_AVAX / 10n, blocked: 400 });
    const built = await pImport(page.utxos);
    expect(built.ids).toEqual([exported.ID()]);
    expect(built.burned).toBe(importFeeNanoAvax('P', [exported], OWNER, CONTEXT, P_PRICE));

    // Round 4 gave the SDK all 401 UTXOs: above the capacity of the P-Chain, so the SDK refused the import.
    await expect(pImport([...dust, exported])).rejects.toThrow(/exceeds capacity/);
  });

  it('P: 400 UTXOs of 0.001 AVAX and a 0.1 AVAX export: the import stays within half the capacity', async () => {
    const small = Array.from({ length: 400 }, () => utxo(MILLI_AVAX));
    const exported = utxo(NANO_AVAX / 10n);
    const page = await share('P', [...small, exported]);
    expect(page.utxos[0]).toBe(exported);
    expect(page.utxos).toHaveLength(168);
    expect(page.blocked).toBe(401 - 168);
    expect(pImportGas(page.utxos, OWNER, CONTEXT)).toBeLessThanOrEqual(P_CAPACITY / 2n);
    const built = await pImport(page.utxos);
    expect(built.ids.sort()).toEqual(page.utxos.map((u) => u.ID()).sort());
    expect(built.burned).toBe(importFeeNanoAvax('P', page.utxos, OWNER, CONTEXT, P_PRICE));

    await expect(pImport([...small, exported])).rejects.toThrow(/exceeds capacity/);
  });
});

describe('blockedUtxosText', () => {
  it('gives one line, or null when no UTXO is blocked', () => {
    expect(blockedUtxosText(0)).toBeNull();
    expect(blockedUtxosText(1)).toBe('This wallet cannot import 1 UTXO in shared memory.');
    expect(blockedUtxosText(3)).toBe('This wallet cannot import 3 UTXOs in shared memory.');
  });
});

describe('maxSpendableNanoAvax', () => {
  const BUFFER = 1_000_000n;

  it('is the balance less the fee buffer, as MAX fills it and the Max line shows it', () => {
    const max = maxSpendableNanoAvax(20.01399927415404, BUFFER);
    expect(max).toBe(20_012_999_274n);
    expect(nanoAvaxText(max)).toBe('20.012999274');
    expect(nanoAvaxText(maxSpendableNanoAvax(13.376494261, BUFFER))).toBe('13.375494261');
  });

  it('is 0 when the balance does not pay the buffer, or is not a number', () => {
    expect(maxSpendableNanoAvax(0.001, BUFFER)).toBe(0n);
    expect(maxSpendableNanoAvax(0.0005, BUFFER)).toBe(0n);
    expect(maxSpendableNanoAvax(0, BUFFER)).toBe(0n);
    expect(maxSpendableNanoAvax(Number.NaN, BUFFER)).toBe(0n);
    expect(nanoAvaxText(0n)).toBe('0');
  });
});
