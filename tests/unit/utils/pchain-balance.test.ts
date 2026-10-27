import { describe, expect, it } from 'vitest';
import { Id, MintOutput, OutputOwners, Utxo, avaxSerial } from '@avalanche-sdk/client/serializable';
import { utils } from '@avalanche-sdk/client/utils';
import { readPChainBalance, toGetBalanceJson, type PChainRpc } from '@/lib/pchain-balance';
import { TEST_ADDRESS, txId, utxoHex } from './pchain-utxo-fixture';

const AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
const OTHER_ASSET = txId(424_242); // any ID that is not AVAX
const NOW = 1_800_000_000n;

type Page = { utxos: string[]; endIndex?: { address: string; utxo: string } };

/** A PChainRpc that answers each call with the next scripted page (or throws the scripted error), and records it. */
function fakeNode(pages: (Page | Error)[]) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const rpc: PChainRpc = async (method, params) => {
    calls.push({ method, params });
    const page = pages[calls.length - 1];
    if (page === undefined) throw new Error(`unexpected call ${calls.length}`);
    if (page instanceof Error) throw page;
    return { numFetched: String(page.utxos.length), utxos: page.utxos, endIndex: page.endIndex, encoding: 'hex' };
  };
  return { rpc, calls };
}

function avaxUtxo(n: number, amount: bigint, lock: { locktime?: bigint; stakeableLocktime?: bigint } = {}): string {
  return utxoHex({ txID: txId(n), index: 0, assetId: AVAX, amount, address: TEST_ADDRESS, ...lock });
}

/** 1024 UTXOs of 1 nAVAX each: a full page. */
const FULL_PAGE = Array.from({ length: 1024 }, (_, i) => avaxUtxo(i + 1, 1n));
const END = { address: TEST_ADDRESS, utxo: txId(1024) };

describe('readPChainBalance', () => {
  it('buckets each UTXO as platform.getBalance does', async () => {
    const { rpc } = fakeNode([
      {
        utxos: [
          avaxUtxo(1, 1n, { locktime: NOW }), // transfer, unlocks at NOW: unlocked
          avaxUtxo(2, 2n, { locktime: NOW + 100n }), // transfer, locked until later: lockedNotStakeable
          avaxUtxo(3, 4n, { stakeableLocktime: NOW + 100n }), // lock, stakeable until later: lockedStakeable
          avaxUtxo(4, 8n, { stakeableLocktime: NOW - 1n }), // lock, stakeable period over: unlocked
          avaxUtxo(5, 16n, { locktime: NOW + 100n, stakeableLocktime: NOW + 100n }), // lock, inner locktime later
          avaxUtxo(6, 32n, { locktime: NOW + 100n, stakeableLocktime: NOW - 1n }), // lock, inner locktime later
          avaxUtxo(7, 64n, { stakeableLocktime: NOW }), // lock, stakeable until NOW: unlocked
        ],
      },
    ]);

    const balance = await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW);

    expect(balance.unlocked).toBe(73n);
    expect(balance.lockedStakeable).toBe(4n);
    expect(balance.lockedNotStakeable).toBe(50n);
    expect(balance.balance).toBe(127n);
  });

  it('counts another asset in byAsset and utxoIDs, not in the AVAX fields', async () => {
    // The second output of the same tx: a UTXO is its tx ID and its output index.
    const other = utxoHex({ txID: txId(1), index: 1, assetId: OTHER_ASSET, amount: 7n, address: TEST_ADDRESS });
    const { rpc } = fakeNode([{ utxos: [avaxUtxo(1, 5n), other] }]);

    const balance = await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW);

    expect(balance.balance).toBe(5n);
    expect(balance.unlocked).toBe(5n);
    expect(balance.byAsset.get(AVAX)).toEqual({ unlocked: 5n, lockedStakeable: 0n, lockedNotStakeable: 0n });
    expect(balance.byAsset.get(OTHER_ASSET)).toEqual({ unlocked: 7n, lockedStakeable: 0n, lockedNotStakeable: 0n });
    expect(balance.utxoIDs).toHaveLength(2);
    expect(balance.utxoIDs).toEqual(
      expect.arrayContaining([
        { txID: txId(1), outputIndex: 0 },
        { txID: txId(1), outputIndex: 1 },
      ]),
    );
  });

  it('skips an output that is neither a transfer nor a lock, as platform.getBalance did', async () => {
    const owners = OutputOwners.fromNative([utils.bech32ToBytes(TEST_ADDRESS)], 0n, 1);
    const mint = new Utxo(avaxSerial.UTXOID.fromNative(txId(9), 0), Id.fromString(AVAX), new MintOutput(owners));
    const codec = utils.getManagerForVM('PVM').getDefaultCodec();
    const mintHex = utils.bufferToHex(utils.addChecksum(new Uint8Array([0, 0, ...mint.toBytes(codec)])));
    const { rpc } = fakeNode([{ utxos: [avaxUtxo(1, 5n), mintHex] }]);

    const balance = await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW);

    expect(balance.balance).toBe(5n);
    expect(balance.utxoIDs).toEqual([{ txID: txId(1), outputIndex: 0 }]);
  });

  it('pages from the endIndex and counts a UTXO repeated across pages once', async () => {
    const { rpc, calls } = fakeNode([
      { utxos: FULL_PAGE, endIndex: END },
      { utxos: [FULL_PAGE[1023], avaxUtxo(5000, 100n)] },
    ]);

    const balance = await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW);

    expect(calls).toHaveLength(2);
    expect(calls[1].params.startIndex).toEqual(END);
    expect(balance.utxoIDs).toHaveLength(1025);
    expect(balance.unlocked).toBe(1124n);
  });

  it('ends the read at a full page without an endIndex', async () => {
    const { rpc, calls } = fakeNode([{ utxos: FULL_PAGE }]);

    const balance = await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW);

    expect(calls).toHaveLength(1);
    expect(balance.unlocked).toBe(1024n);
  });

  it('throws after 20 full pages without asking for a 21st', async () => {
    const { rpc, calls } = fakeNode(Array.from({ length: 21 }, () => ({ utxos: FULL_PAGE, endIndex: END })));

    await expect(readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW)).rejects.toThrow('more than 20 pages');
    expect(calls).toHaveLength(20);
  });

  it('throws after maxPages full pages without asking for one more', async () => {
    const { rpc, calls } = fakeNode(Array.from({ length: 6 }, () => ({ utxos: FULL_PAGE, endIndex: END })));

    await expect(readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW, 5)).rejects.toThrow(
      'platform.getUTXOs: more than 5 pages (5,120 UTXOs)',
    );
    expect(calls).toHaveLength(5);
  });

  it('throws on an empty address list without a call', async () => {
    const { rpc, calls } = fakeNode([]);

    await expect(readPChainBalance(rpc, [], AVAX, NOW)).rejects.toThrow('no addresses');
    expect(calls).toHaveLength(0);
  });

  it('rejects when a later page fails, instead of returning a partial balance', async () => {
    const { rpc } = fakeNode([{ utxos: FULL_PAGE, endIndex: END }, new Error('platform.getUTXOs error: node busy')]);

    await expect(readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW)).rejects.toThrow('node busy');
  });

  it('asks platform.getUTXOs for the addresses, 1024 at a time, in hex', async () => {
    const addresses = [TEST_ADDRESS, utils.format('P', 'fuji', new Uint8Array(20).fill(2))];
    const { rpc, calls } = fakeNode([{ utxos: FULL_PAGE, endIndex: END }, { utxos: [] }]);

    await readPChainBalance(rpc, addresses, AVAX, NOW);

    expect(calls).toEqual([
      { method: 'platform.getUTXOs', params: { addresses, limit: 1024, encoding: 'hex' } },
      { method: 'platform.getUTXOs', params: { addresses, limit: 1024, encoding: 'hex', startIndex: END } },
    ]);
  });
});

describe('toGetBalanceJson', () => {
  it("gives platform.getBalance's JSON: decimal strings and non-zero entries keyed by asset ID", () => {
    const json = toGetBalanceJson({
      unlocked: 1_500_000_000n,
      lockedStakeable: 2_000_000_000n,
      lockedNotStakeable: 0n,
      balance: 3_500_000_000n,
      byAsset: new Map([
        [AVAX, { unlocked: 1_500_000_000n, lockedStakeable: 2_000_000_000n, lockedNotStakeable: 0n }],
        [OTHER_ASSET, { unlocked: 7n, lockedStakeable: 0n, lockedNotStakeable: 0n }],
      ]),
      utxoIDs: [{ txID: txId(1), outputIndex: 0 }],
    });

    expect(json).toEqual({
      balance: '3500000000',
      unlocked: '1500000000',
      lockedStakeable: '2000000000',
      lockedNotStakeable: '0',
      balances: { [AVAX]: '3500000000', [OTHER_ASSET]: '7' },
      unlockeds: { [AVAX]: '1500000000', [OTHER_ASSET]: '7' },
      lockedStakeables: { [AVAX]: '2000000000' },
      lockedNotStakeables: {},
      utxoIDs: [{ txID: txId(1), outputIndex: 0 }],
    });
  });

  it('reads an address with no UTXOs as zero', async () => {
    const { rpc } = fakeNode([
      { utxos: [], endIndex: { address: TEST_ADDRESS, utxo: '11111111111111111111111111111111LpoYY' } },
    ]);

    const json = toGetBalanceJson(await readPChainBalance(rpc, [TEST_ADDRESS], AVAX, NOW));

    expect(json).toEqual({
      balance: '0',
      unlocked: '0',
      lockedStakeable: '0',
      lockedNotStakeable: '0',
      balances: {},
      unlockeds: {},
      lockedStakeables: {},
      lockedNotStakeables: {},
      utxoIDs: [],
    });
  });
});
