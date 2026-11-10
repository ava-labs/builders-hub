import { describe, expect, it } from 'vitest';

import { ledgerOf } from '@/components/explorer-v2/pchain/utxo';
import type { Utxo } from '@/lib/pchain-explorer';

// Real mainnet txs, cut to what the ledger reads. avalanchego adds a removed
// seat's refund after the tx's own outputs (output index = their count), so
// a refund to the fee payer must not read as change.
const utxo = (outputIndex: number, amount: string, address: string): Utxo =>
  ({ outputIndex, amount, addresses: [address], threshold: 1, staked: false, platformLocktime: 0, createdOnChainId: '', consumedOnChainId: '' }) as Utxo;

const PAYER = 'avax18e2flgdk3heu69n3az97lvdxll9tyddy2wt655';
// pzsQe6s2FCwcY1aPDGRsRiKgTQydBfKcdkavkJrHxGbS41bnb: the seat's balance goes back to the payer
const disableToPayer = {
  consumed: [utxo(1, '15997241856', PAYER)],
  emitted: [utxo(0, '15997229840', PAYER), utxo(1, '15771076096', PAYER)],
  txType: 'DisableL1ValidatorTx',
};

const purposes = (l: ReturnType<typeof ledgerOf>) => l.produced.map((r) => [r.purpose, r.amount]);

describe('ledgerOf refunds', () => {
  it('reads the UTXO after the tx outputs as the refund', () => {
    const l = ledgerOf({ ...disableToPayer, outputCount: 1 });
    expect(purposes(l)).toEqual([
      ['change', 15997229840n],
      ['refund', 15771076096n],
    ]);
    expect(l.burned).toBe(12016n);
  });

  it('finds the refund before the node counts the outputs, when the inputs cannot fund them all', () => {
    expect(ledgerOf(disableToPayer).burned).toBe(12016n);
  });

  it('reads a weight set to 0 the same way', () => {
    // 2npswaJDcNqSKzb78mHJtGVyUYEPbKokTxrqdbdoMbq4DRHKNx
    const owner = 'avax1nr2n6apj940a3jky9jfn3uqhcl5enuc9uy4dfl';
    const l = ledgerOf({
      consumed: [utxo(0, '452604214584', owner)],
      emitted: [utxo(0, '452604135614', owner), utxo(1, '336557824', owner)],
      txType: 'SetL1ValidatorWeightTx',
      outputCount: 1,
    });
    expect(purposes(l)).toEqual([
      ['change', 452604135614n],
      ['refund', 336557824n],
    ]);
    expect(l.burned).toBe(78970n);
  });

  it('keeps a refund to another key, and a weight change with no refund', () => {
    // 2V1Qxfzrfj9fnsop36BwPbpQGQjAt83qDH6Q5oT475SVQHfbmK
    const payer = 'avax1tu8x7d9gtrvuj4weml7st456s92085vjah7js2';
    const toOther = ledgerOf({
      consumed: [utxo(0, '90222116730', payer)],
      emitted: [utxo(0, '90222092698', payer), utxo(1, '1794528256', 'avax1z8877h4pyw376309jy0uywzl7hf7u7fkwt5vlg')],
      txType: 'DisableL1ValidatorTx',
      outputCount: 1,
    });
    expect(toOther.burned).toBe(24032n);
    expect(toOther.produced.find((r) => r.purpose === 'refund')?.amount).toBe(1794528256n);
    // KJkH8gcsp2SoEWnsUUBpsWyheAHvmQnS97rHpwpTtW8JCc7vK
    const owner = 'avax1nr2n6apj940a3jky9jfn3uqhcl5enuc9uy4dfl';
    const weight = ledgerOf({ consumed: [utxo(0, '397801404405', owner)], emitted: [utxo(0, '397801325435', owner)], txType: 'SetL1ValidatorWeightTx', outputCount: 1 });
    expect(purposes(weight)).toEqual([['change', 397801325435n]]);
    expect(weight.burned).toBe(78970n);
  });
});
