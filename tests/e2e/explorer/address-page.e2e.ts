import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// A C-Chain address page opens on its transactions, as the Etherscan account page does, and ?tab= still opens another
// view (components/explorer-v2/evm/EvmAddress.tsx). The address is the one from the request that changed the default.
// Its data is live, so the tests check the structure, not the values.
const ADDRESS = '/explorer/mainnet/c-chain/address/0x5b702b24b00a37b61ff9d71d91fed1a629edd1df';

test('an address page opens on the Transactions tab', async ({ app, screen }) => {
  await app.open(ADDRESS);
  await expect(screen.getByRole('tab', 'Transactions')).toHaveAttribute('aria-selected', 'true', DATA);
  await expect(screen.getByRole('tab', 'Holdings')).toHaveAttribute('aria-selected', 'false');
  // the line above the table counts the rows it shows and the address's transactions, all time
  await expect(screen.getByText(/^Latest [\d,]+ of [\d,]+ transactions$/)).toBeVisible(DATA);
  await expect(screen.getByText('More Info')).toBeVisible();
});

test('?tab=holdings opens the Holdings tab', async ({ app, screen }) => {
  await app.open(`${ADDRESS}?tab=holdings`);
  await expect(screen.getByRole('tab', 'Holdings')).toHaveAttribute('aria-selected', 'true', DATA);
  await expect(screen.getByRole('tab', 'Transactions')).toHaveAttribute('aria-selected', 'false');
  await expect(screen.getByText(/^balances read from the chain/)).toBeVisible(DATA);
});
