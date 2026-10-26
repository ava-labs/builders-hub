import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avaxSerial,
  BigIntPr,
  Id,
  Int,
  OutputOwners,
  pvmSerial,
  TransferOutput,
  utils,
  Utxo,
} from '@avalabs/avalanchejs';
import {
  AVAX_ASSET_ID,
  getPChainBalanceFromNode,
  readPChainBalance,
  sumPChainUtxos,
  utxoPageParams,
  type ReadUtxoPage,
} from '@/components/toolbox/utils/pChainNodeBalance';
import { MAX_UTXO_PAGES, UTXO_PAGE_SIZE } from '@/components/toolbox/utils/sharedMemoryImport';

const AVAX = AVAX_ASSET_ID.fuji;
const OTHER_ASSET = Id.fromHex(`0x${'22'.repeat(32)}`).toString();
const OWNER = new Uint8Array(20).fill(7);
const STRANGER = new Uint8Array(20).fill(9);
const NOW = 1_800_000_000n;

let nextTx = 1;

function utxoId(): avaxSerial.UTXOID {
  return new avaxSerial.UTXOID(Id.fromHex(`0x${(nextTx++).toString(16).padStart(64, '0')}`), new Int(0));
}

/** A secp256k1 TransferOutput UTXO. */
function plain(
  amount: bigint,
  o: { locktime?: bigint; asset?: string; owners?: Uint8Array[]; threshold?: number } = {},
) {
  const owners = OutputOwners.fromNative(o.owners ?? [OWNER], o.locktime ?? 0n, o.threshold ?? 1);
  return new Utxo(utxoId(), Id.fromString(o.asset ?? AVAX), new TransferOutput(new BigIntPr(amount), owners));
}

/** A StakeableLockOut UTXO: `stakeLock` is its stakeable locktime, `locktime` the locktime of the inner output. */
function stakeable(amount: bigint, stakeLock: bigint, locktime = 0n) {
  const inner = new TransferOutput(new BigIntPr(amount), OutputOwners.fromNative([OWNER], locktime, 1));
  return new Utxo(utxoId(), Id.fromString(AVAX), new pvmSerial.StakeableLockOut(new BigIntPr(stakeLock), inner));
}

/** The UTXO as platform.getUTXOs encodes it with encoding 'hex': codec version, UTXO, checksum. */
function toNodeHex(utxo: Utxo): string {
  const manager = utils.getManagerForVM('PVM');
  const bytes = utils.concatBytes(manager.getDefaultCodecId().toBytes(), utxo.toBytes(manager.getDefaultCodec()));
  return utils.bufferToHex(utils.addChecksum(bytes));
}

describe('sumPChainUtxos', () => {
  it('splits TransferOutputs by their locktime, as platform.getBalance does', () => {
    const b = sumPChainUtxos([plain(1n), plain(2n, { locktime: NOW }), plain(4n, { locktime: NOW + 1n })], AVAX, NOW);
    expect(b).toMatchObject({ unlocked: 3n, lockedStakeable: 0n, lockedNotStakeable: 4n, balance: 7n });
  });

  it('splits StakeableLockOuts by the inner locktime first, then by the stakeable locktime', () => {
    const b = sumPChainUtxos(
      [
        stakeable(1n, NOW + 100n),
        stakeable(2n, NOW),
        stakeable(4n, NOW - 100n, NOW + 1n),
        stakeable(8n, NOW + 100n, NOW + 1n),
      ],
      AVAX,
      NOW,
    );
    expect(b).toMatchObject({ unlocked: 2n, lockedStakeable: 1n, lockedNotStakeable: 12n, balance: 15n });
  });

  it('puts AVAX in the top-level fields, splits each asset apart, and lists the UTXOs of every asset', () => {
    const avax = plain(5n);
    const other = plain(100n, { asset: OTHER_ASSET, locktime: NOW + 1n });
    const b = sumPChainUtxos([avax, other], AVAX, NOW);
    expect(b).toMatchObject({ balance: 5n, unlocked: 5n, lockedNotStakeable: 0n });
    expect(b.byAsset[OTHER_ASSET]).toEqual({ unlocked: 0n, lockedStakeable: 0n, lockedNotStakeable: 100n });
    expect(b.utxoIDs).toEqual([
      { txID: avax.utxoId.txID.toString(), outputIndex: 0 },
      { txID: other.utxoId.txID.toString(), outputIndex: 0 },
    ]);
  });

  it('counts a UTXO whatever the threshold of its owners, as platform.getBalance does', () => {
    const b = sumPChainUtxos([plain(3n, { owners: [OWNER, STRANGER], threshold: 2 })], AVAX, NOW);
    expect(b.unlocked).toBe(3n);
  });
});

describe('utxoPageParams', () => {
  it('asks for hex pages of the most UTXOs that one call gives, from the start index', () => {
    expect(utxoPageParams(['fuji1abc', 'P-fuji1def'], undefined)).toEqual({
      addresses: ['P-fuji1abc', 'P-fuji1def'],
      limit: UTXO_PAGE_SIZE,
      encoding: 'hex',
    });
    const startIndex = { address: 'P-fuji1abc', utxo: 'x' };
    expect(utxoPageParams(['P-fuji1abc'], startIndex)).toMatchObject({ startIndex });
  });
});

describe('readPChainBalance', () => {
  // Two UTXOs from api.avax.network for P-avax144wptphlhsdy8yu423acq6m29mvfgnz4het0u4 (2026-10-26): 33,000 AVAX each
  // under a stakeable lock to 1856304000 and to 1910736000.
  const MAINNET_STAKEABLE = [
    '0x0000e825c18e7e444ad010ae742eb29c09f1a68bb7b4daad1884835dd411251204d30000002921e67317cbc4be2aeb00677ad6462778a8f52274b9d605df2591b23027a87dff000000160000000071e384800000000700001e036947100000000000000000000000000100000001ad5c1586ffbc1a439395547b806b6a2ed8944c55b96027e4',
    '0x00005f7c074ffe4fb9d19fe155300e6f89d9673dfb656f071542df35e90e8928b9d20000000f21e67317cbc4be2aeb00677ad6462778a8f52274b9d605df2591b23027a87dff00000016000000006ea4f3800000000700001e036947100000000000000000000000000100000001ad5c1586ffbc1a439395547b806b6a2ed8944c55bf9eb9c6',
  ];
  const onePage: ReadUtxoPage = async () => ({ utxos: MAINNET_STAKEABLE });

  it('decodes the node bytes, and moves each stakeable lock to unlocked when it passes', async () => {
    const before = await readPChainBalance(onePage, AVAX_ASSET_ID.mainnet, 1_793_000_000n);
    expect(before).toMatchObject({ unlocked: 0n, lockedStakeable: 66_000_000_000_000n, complete: true });
    expect(before.utxoIDs).toHaveLength(2);
    const between = await readPChainBalance(onePage, AVAX_ASSET_ID.mainnet, 1_856_304_000n);
    expect(between).toMatchObject({ unlocked: 33_000_000_000_000n, lockedStakeable: 33_000_000_000_000n });
    const after = await readPChainBalance(onePage, AVAX_ASSET_ID.mainnet, 1_910_736_000n);
    expect(after).toMatchObject({ unlocked: 66_000_000_000_000n, lockedStakeable: 0n });
  });

  it('reads every page, counts the UTXO that starts the next page once, and stops at a short page', async () => {
    const utxos = Array.from({ length: UTXO_PAGE_SIZE + 10 }, () => plain(1n));
    const starts: (string | undefined)[] = [];
    const readPage: ReadUtxoPage = async (startIndex) => {
      starts.push(startIndex?.utxo);
      // The node starts a page at the last UTXO of the page before it.
      const from = startIndex ? utxos.findIndex((u) => u.ID() === startIndex.utxo) : 0;
      const page = utxos.slice(from, from + UTXO_PAGE_SIZE);
      return { utxos: page.map(toNodeHex), endIndex: { address: 'P-fuji1x', utxo: page[page.length - 1].ID() } };
    };
    const b = await readPChainBalance(readPage, AVAX, NOW);
    expect(b).toMatchObject({ unlocked: BigInt(UTXO_PAGE_SIZE + 10), complete: true });
    expect(b.utxoIDs).toHaveLength(UTXO_PAGE_SIZE + 10);
    expect(starts).toEqual([undefined, utxos[UTXO_PAGE_SIZE - 1].ID()]);
  });

  it('says the balance is a lower bound when the address holds more UTXOs than the read gets', async () => {
    let calls = 0;
    const fullPages: ReadUtxoPage = async () => {
      calls++;
      return {
        utxos: Array.from({ length: UTXO_PAGE_SIZE }, () => toNodeHex(plain(1n))),
        endIndex: { address: 'P-fuji1x', utxo: 'y' },
      };
    };
    const b = await readPChainBalance(fullPages, AVAX, NOW);
    expect(b.complete).toBe(false);
    expect(calls).toBe(MAX_UTXO_PAGES);
  });

  it('throws when a page has no utxos, so the caller can fall back', async () => {
    await expect(readPChainBalance(async () => ({}) as never, AVAX, NOW)).rejects.toThrow(/no utxos/);
  });
});

describe('getPChainBalanceFromNode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws on a read that stops before the last page, so the Console falls back to the indexer', async () => {
    const page = Array.from({ length: UTXO_PAGE_SIZE }, () => toNodeHex(plain(1n)));
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { utxos: page, endIndex: { address: 'P-fuji1x', utxo: 'y' } },
          }),
        ),
    );
    await expect(getPChainBalanceFromNode(true, 'P-fuji1x')).rejects.toThrow(/more UTXOs than the read gets/);
  });

  it('throws on an RPC error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'boom' } })),
    );
    await expect(getPChainBalanceFromNode(false, 'P-avax1x')).rejects.toThrow(/boom/);
  });
});
