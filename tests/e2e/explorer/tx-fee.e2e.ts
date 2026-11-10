import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// A C-Chain tx page's Fee box splits the gas price it paid into the base fee and the priority fee, per gas and for
// the gas charged, and shows the caps the tx set (components/explorer-v2/evm/TxFee.tsx). The txs are past mainnet
// txs, so their fees do not change. The values come from eth_getTransactionByHash, eth_getTransactionReceipt and the
// header of each block, read on 2026-10-08. Since Helicon a header base fee is only the worst-case bound: the base
// fee charged is read from the receipts.

// The rows of the Fee breakdown table under its header: the part, its price per gas, and its amount for the gas charged.
type Rows = [base: [string, string], tip: [string, string], total: [string, string]];

const TXS: { what: string; hash: string; /** the gas charged */ gas: string; rows: Rows; caps: string | RegExp; bound?: string; halfLimit?: boolean }[] = [
  {
    what: 'a dynamic-fee tx with a 3 nAVAX priority fee',
    hash: '0x54b7bdbd4b90738ea11bf15c1c18f310904f52db7c6f3b270dc11b2f8c4488dd',
    gas: '61,138',
    rows: [
      ['5.000 nAVAX', '0.00030569 AVAX'],
      ['3.000 nAVAX', '0.00018341 AVAX'],
      ['8.000 nAVAX', '0.0004891 AVAX'],
    ],
    caps: 'Caps per gas: max fee 66.000 nAVAX, max priority fee 3.000 nAVAX.',
  },
  {
    what: 'a dynamic-fee tx with the 150 wei priority fee that wallets suggest',
    hash: '0xcd1f534cef4ad45eed089404d8ea82d7ab74009e12a4a544d1552f41c6450fd9',
    gas: '21,000',
    rows: [
      ['5.000 nAVAX', '0.000105 AVAX'],
      ['150 wei', '0.00315 nAVAX'],
      ['5.000 nAVAX', '0.000105 AVAX'],
    ],
    caps: 'Caps per gas: max fee 10.000 nAVAX, max priority fee 150 wei.',
  },
  {
    what: 'a legacy tx charged half its gas limit',
    hash: '0xe6d1f7c5e6b4394ef839e79fb584ca3abe9d0c8eaa08d09623da9247dfdf9874',
    gas: '500,000',
    rows: [
      ['5.000 nAVAX', '0.0025 AVAX'],
      ['2.000 nAVAX', '0.001 AVAX'],
      ['7.000 nAVAX', '0.0035 AVAX'],
    ],
    caps: /^A legacy transaction pays one gas price\./,
    halfLimit: true,
  },
  {
    // block 97,067,017: the header allows a base fee up to 5.097 nAVAX, and a dynamic-fee tx in the block shows 5.038 was charged
    what: 'a legacy tx in a block whose header bound is above the base fee charged',
    hash: '0xc6a80d63d2f3b028a9516865cf5db8ce37d4d24348ab7d7ec4d72fd9e64cb3a0',
    gas: '150,000',
    rows: [
      ['5.038 nAVAX', '0.00075565 AVAX'],
      ['2.462 nAVAX', '0.00036935 AVAX'],
      ['7.500 nAVAX', '0.001125 AVAX'],
    ],
    caps: /^A legacy transaction pays one gas price\./,
    bound: 'The block allowed a base fee up to 5.097 nAVAX. It charged less.',
    halfLimit: true,
  },
];

const PARTS = ['Base fee', 'Priority fee', 'Gas price'];

for (const tx of TXS) {
  test(`c-chain tx page splits the fee of ${tx.what}`, async ({ app, screen }) => {
    await app.open(`/explorer/mainnet/c-chain/tx/${tx.hash}`);
    // The Fee box fills from the RPC after the page renders.
    const table = screen.getByRole('table', 'Fee breakdown');
    await expect(table).toBeVisible(DATA);
    // the header is set in capitals
    await expect(table.getByRole('columnheader').nth(2)).toHaveText(new RegExp(`^× ${tx.gas} gas$`, 'i'));
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(4);
    for (const [i, [perGas, amount]] of tx.rows.entries()) {
      const row = rows.nth(i + 1);
      await expect(row.getByRole('rowheader')).toHaveText(PARTS[i]);
      const cells = row.getByRole('cell');
      await expect(cells.nth(0)).toHaveText(perGas, DATA);
      await expect(cells.nth(1)).toHaveText(amount);
    }
    await expect(screen.getByText(tx.caps)).toBeVisible();
    if (tx.bound) await expect(screen.getByText(tx.bound)).toBeVisible();
    // The whole fee, the priority fee included, goes to the burn address.
    await expect(screen.getByText(/(^|· )burned$/)).toBeVisible();
    if (tx.halfLimit) await expect(screen.getByText('the minimum charge: half the gas limit')).toBeVisible();
  });
}
