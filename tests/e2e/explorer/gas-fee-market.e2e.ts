import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// The top of the C-Chain gas page is the fee market of this moment (components/explorer-v2/gas/fee-market.tsx): the
// base fee, the suggested priority fee, the cost of an action and the wait for a block, read from the RPC every 2 s.
// Explorer data is live, so the test checks the structure and that the reading moves, not the values.

// "block 97,067,822", the newest block the reading holds.
const HEAD = /^block \d{1,3}(,\d{3})+$/;

test('c-chain gas page shows the fee market now and keeps it current', async ({ app, screen }) => {
  await app.open('/explorer/mainnet/c-chain/gas');
  const market = screen.getByRole('region', 'Fee market now');
  await expect(market.getByText('Base Fee')).toBeVisible(DATA);
  await expect(market.getByText('Priority Fee')).toBeVisible();
  await expect(market.getByText('Next Block')).toBeVisible();

  // The cost of an action: a header row and four actions, each with an AVAX amount and a dollar amount.
  const costs = market.getByRole('table', 'Cost of an action');
  const rows = costs.getByRole('row');
  await expect(rows).toHaveCount(5);
  const send = rows.nth(1).getByRole('cell');
  await expect(send.nth(0)).toHaveText('Send AVAX');
  await expect(send.nth(1)).toHaveText('21,000');
  await expect(send.nth(2)).toHaveText(/^0\.0\d+ AVAX$/, DATA);
  await expect(send.nth(3)).toHaveText(/^\$0\.\d+$/, DATA);

  // The priority fees that transactions paid in the newest blocks, in three bands.
  await expect(market.getByText(/^Priority Fees Paid/)).toBeVisible();
  await expect(market.getByText(/^[\d.,]+ (wei|nAVAX) or less$/)).toBeVisible(DATA);
  await expect(market.getByText('over 1 nAVAX')).toBeVisible();

  // How the fees work opens on a tap.
  await market.getByText('How C-Chain Fees Work').click();
  await expect(market.getByText('A transaction pays for at least half its gas limit.')).toBeVisible();

  // The reading moves with the chain: a new block lands about every second.
  const head = market.getByText(HEAD);
  await expect(head).toBeVisible(DATA);
  const first = await head.textContent();
  await expect(head).not.toHaveText(first ?? '', { timeout: 30_000 });
});

// Fuji test AVAX has no dollar price and Fuji's base fee is a few wei, so the costs read in nAVAX and the table has no
// USD column.
test('fuji c-chain gas page shows the fee market now without a dollar price', async ({ app, screen }) => {
  await app.open('/explorer/fuji/c-chain/gas');
  const market = screen.getByRole('region', 'Fee market now');
  await expect(market.getByText('Base Fee')).toBeVisible(DATA);
  const costs = market.getByRole('table', 'Cost of an action');
  await expect(costs.getByRole('columnheader')).toHaveCount(3);
  const send = costs.getByRole('row').nth(1).getByRole('cell');
  await expect(send.nth(2)).toHaveText(/^[\d.,]+ (wei|nAVAX|AVAX)$/, DATA);
  await expect(market.getByText(HEAD)).toBeVisible(DATA);
});
