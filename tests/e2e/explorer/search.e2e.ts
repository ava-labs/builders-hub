import { test } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION, OVERVIEW_BLOCK_ROW } from './explorer-page';

// Rule: the All Networks search sends a plain height to the P-Chain only when the P-Chain has that block.
// Any other height is a C-Chain height (the page's Latest Blocks list shows C-Chain heights), so it opens the C-Chain.
// The decision is heightHit in components/explorer-v2/chain-search.tsx.

// A fixed C-Chain height far above the P-Chain tip, and a height both chains have.
const C_CHAIN_HEIGHT = '50000000';
const P_CHAIN_HEIGHT = '1000';

// Opens the All Networks page and types a height into its search. The block rows load in the browser,
// so a row shows that React has hydrated the page and the box is live before the height goes in.
async function searchHeight(app: App, screen: Screen, height: string, chain: string): Promise<void> {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  await box.fill(height);
  // The dropdown names the chain that Enter opens.
  await expect(screen.getByRole('button', new RegExp(`^Block ?${height} ?${chain}$`))).toBeVisible(DATA);
  await box.press('Enter');
}

test('all networks search opens a height above the p-chain tip on the c-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await searchHeight(app, screen, C_CHAIN_HEIGHT, 'C-Chain');
  await expect(browser).toHaveURL(`/explorer/mainnet/c-chain/block/${C_CHAIN_HEIGHT}`, NAVIGATION);
  await expect(screen.getByText('Parent')).toBeVisible(DATA);
  await expect(screen.getByText('Block not found')).toBeHidden();
});

test('all networks search keeps a p-chain height on the p-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await searchHeight(app, screen, P_CHAIN_HEIGHT, 'P-Chain');
  await expect(browser).toHaveURL(`/explorer/mainnet/p-chain/block/${P_CHAIN_HEIGHT}`, NAVIGATION);
  await expect(screen.getByText('Parent')).toBeVisible(DATA);
  await expect(screen.getByText('Block not found')).toBeHidden();
});
