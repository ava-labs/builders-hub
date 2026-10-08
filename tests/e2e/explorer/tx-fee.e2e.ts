import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// A C-Chain tx page splits the gas price it paid into the base fee and the priority fee, and shows the caps it set
// (components/explorer-v2/evm/TxFee.tsx). The txs are past mainnet txs, so their fees do not change. The values come
// from eth_getTransactionByHash, eth_getTransactionReceipt and the header of each block, read on 2026-10-08. Since
// Helicon a header base fee is only the worst-case bound: the base fee charged is read from the receipts.
const TXS = [
  {
    what: 'a dynamic-fee tx with a 3 nAVAX priority fee',
    hash: '0x54b7bdbd4b90738ea11bf15c1c18f310904f52db7c6f3b270dc11b2f8c4488dd',
    price: '8.000 nAVAX',
    split: 'base fee 5.000 nAVAX + priority fee 3.000 nAVAX',
    caps: 'max fee 66.000 nAVAX · max priority fee 3.000 nAVAX',
  },
  {
    what: 'a dynamic-fee tx with the 150 wei priority fee that wallets suggest',
    hash: '0xcd1f534cef4ad45eed089404d8ea82d7ab74009e12a4a544d1552f41c6450fd9',
    price: '5.000 nAVAX',
    split: 'base fee 5.000 nAVAX + priority fee 150 wei',
    caps: 'max fee 10.000 nAVAX · max priority fee 150 wei',
  },
  {
    what: 'a legacy tx charged half its gas limit',
    hash: '0xe6d1f7c5e6b4394ef839e79fb584ca3abe9d0c8eaa08d09623da9247dfdf9874',
    price: '7.000 nAVAX',
    split: 'base fee 5.000 nAVAX + priority fee 2.000 nAVAX',
    caps: /^None\. A legacy transaction pays one gas price\./,
    halfLimit: true,
  },
  {
    // block 97,067,017: the header allows a base fee up to 5.097 nAVAX, and a dynamic-fee tx in the block shows 5.038 was charged
    what: 'a legacy tx in a block whose header bound is above the base fee charged',
    hash: '0xc6a80d63d2f3b028a9516865cf5db8ce37d4d24348ab7d7ec4d72fd9e64cb3a0',
    price: '7.500 nAVAX',
    split: 'base fee 5.038 nAVAX + priority fee 2.462 nAVAX · the block allowed up to 5.097 nAVAX',
    caps: /^None\. A legacy transaction pays one gas price\./,
    halfLimit: true,
  },
];

for (const tx of TXS) {
  test(`c-chain tx page splits the gas price of ${tx.what}`, async ({ app, screen }) => {
    await app.open(`/explorer/mainnet/c-chain/tx/${tx.hash}`);
    // The fee lines load from the RPC after the page renders.
    await expect(screen.getByText('Gas Price')).toBeVisible(DATA);
    // Each price is its own element, and the base fee can read the same as the price: the price comes first.
    await expect(screen.getByText(tx.price).nth(0)).toBeVisible(DATA);
    await expect(screen.getByText(tx.split)).toBeVisible(DATA);
    await expect(screen.getByText('Fee Caps')).toBeVisible();
    await expect(screen.getByText(tx.caps)).toBeVisible();
    // The whole fee, the priority fee included, goes to the burn address.
    await expect(screen.getByText(/(^|· )burned$/)).toBeVisible();
    if (tx.halfLimit) await expect(screen.getByText('the minimum charge: half the gas limit')).toBeVisible();
  });
}
