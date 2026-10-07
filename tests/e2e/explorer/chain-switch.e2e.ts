import { test } from '@e2e-dev/web';
import { expect, type Locator } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION, expectActiveTab, networkSwitch, openChainSwitcher, pathPattern } from './explorer-page';

// Rule: the chain switcher keeps the tab the user is on where the target chain has it.
// The targets come from chainSwitchTarget in components/explorer-v2/network-switch.ts. The Mainnet/Fuji switch
// shares its rules. tests/unit/explorer/chain-switch.test.ts checks every page and switcher row without a browser.

interface ChainSwitchCase {
  /** The page the user is on. */
  from: string;
  /** The name of the switcher button on that page: the current chain, or All Networks. */
  fromChain: string;
  /** The tab that is active on that page. */
  fromTab: string;
  /** The switcher row the user taps. The switcher button names this chain after the switch. */
  to: string;
  /** The path the user must land on. */
  expected: string;
  /** The tab that must be active after the switch. */
  toTab: string;
}

const CASES: ChainSwitchCase[] = [
  // The same tab on the target chain
  { from: '/explorer/mainnet/c-chain/blocks', fromChain: 'C-Chain', fromTab: 'Blocks', to: 'P-Chain', expected: '/explorer/mainnet/p-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/mainnet/p-chain/blocks', fromChain: 'P-Chain', fromTab: 'Blocks', to: 'C-Chain', expected: '/explorer/mainnet/c-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/mainnet/c-chain/txs', fromChain: 'C-Chain', fromTab: 'Transactions', to: 'X-Chain', expected: '/explorer/mainnet/x-chain/txs', toTab: 'Transactions' },
  { from: '/explorer/mainnet/p-chain/validators', fromChain: 'P-Chain', fromTab: 'Validators', to: 'C-Chain', expected: '/explorer/mainnet/c-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/x-chain/validators', fromChain: 'X-Chain', fromTab: 'Validators', to: 'P-Chain', expected: '/explorer/mainnet/p-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/c-chain/accounts', fromChain: 'C-Chain', fromTab: 'Accounts', to: 'Beam', expected: '/explorer/mainnet/beam/accounts', toTab: 'Accounts' },
  // A view below a tab's list is kept where the target serves it, and dropped to the list where it does not
  { from: '/explorer/mainnet/c-chain/gas/base-fee', fromChain: 'C-Chain', fromTab: 'Gas', to: 'Beam', expected: '/explorer/mainnet/beam/gas/base-fee', toTab: 'Gas' },
  { from: '/explorer/mainnet/c-chain/txs/atomic', fromChain: 'C-Chain', fromTab: 'Transactions', to: 'P-Chain', expected: '/explorer/mainnet/p-chain/txs', toTab: 'Transactions' },
  { from: '/explorer/mainnet/p-chain/validators/l1s', fromChain: 'P-Chain', fromTab: 'Validators', to: 'C-Chain', expected: '/explorer/mainnet/c-chain/validators', toTab: 'Validators' },
  // An entity page lands on its tab's list, because its id means nothing on the target
  { from: '/explorer/mainnet/c-chain/block/1', fromChain: 'C-Chain', fromTab: 'Blocks', to: 'P-Chain', expected: '/explorer/mainnet/p-chain/blocks', toTab: 'Blocks' },
  // The Primary Network's staking economy is the P-Chain's Staking tab and the C-Chain's Validators > Staking view
  { from: '/explorer/mainnet/p-chain/staking', fromChain: 'P-Chain', fromTab: 'Staking', to: 'C-Chain', expected: '/explorer/mainnet/c-chain/validators/staking', toTab: 'Validators' },
  // A tab the target does not have: Staking and L1s land on Validators, any other tab on the target's home
  { from: '/explorer/mainnet/p-chain/l1s', fromChain: 'P-Chain', fromTab: 'L1s', to: 'X-Chain', expected: '/explorer/mainnet/x-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/c-chain/gas', fromChain: 'C-Chain', fromTab: 'Gas', to: 'P-Chain', expected: '/explorer/mainnet/p-chain', toTab: 'Overview' },
  { from: '/explorer/mainnet/c-chain/defi', fromChain: 'C-Chain', fromTab: 'DeFi', to: 'X-Chain', expected: '/explorer/mainnet/x-chain', toTab: 'Overview' },
  // The network scope (All Networks) and back
  { from: '/explorer/mainnet/c-chain/query', fromChain: 'C-Chain', fromTab: 'Query', to: 'All Networks', expected: '/explorer/mainnet/query', toTab: 'Query' },
  { from: '/explorer/mainnet/query', fromChain: 'All Networks', fromTab: 'Query', to: 'P-Chain', expected: '/explorer/mainnet/p-chain/query', toTab: 'Query' },
  { from: '/explorer/mainnet/p-chain/blocks', fromChain: 'P-Chain', fromTab: 'Blocks', to: 'All Networks', expected: '/explorer/mainnet', toTab: 'Explorer' },
  // A switch on Fuji stays on Fuji where the target chain runs there
  { from: '/explorer/fuji/p-chain/blocks', fromChain: 'P-Chain', fromTab: 'Blocks', to: 'C-Chain', expected: '/explorer/fuji/c-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/fuji/c-chain/txs', fromChain: 'C-Chain', fromTab: 'Transactions', to: 'X-Chain', expected: '/explorer/fuji/x-chain/txs', toTab: 'Transactions' },
  // The Fuji menu lists the Fuji L1s with their Fuji names: Beam runs on Fuji as beam-l1, named Beam L1
  { from: '/explorer/fuji/c-chain/blocks', fromChain: 'C-Chain', fromTab: 'Blocks', to: 'Beam L1', expected: '/explorer/fuji/beam-l1/blocks', toTab: 'Blocks' },
  // Fuji has its own network scope (All Networks), so the switch stays on Fuji
  { from: '/explorer/fuji/p-chain/blocks', fromChain: 'P-Chain', fromTab: 'Blocks', to: 'All Networks', expected: '/explorer/fuji', toTab: 'Explorer' },
];

// Taps a row of the open switcher. L1 rows come from a live feed, so the filter brings the row into view first.
async function switchTo(menu: Locator, chain: string): Promise<void> {
  if (!['All Networks', 'C-Chain', 'P-Chain', 'X-Chain'].includes(chain)) {
    await menu.getByRole('textbox', 'Filter chains').fill(chain);
  }
  const row = menu.getByRole('link', chain);
  await expect(row).toBeVisible(DATA);
  await row.tap();
}

for (const c of CASES) {
  test(`chain switch from ${c.from} to ${c.to} lands on ${c.expected}`, async ({ app, screen, browser }) => {
    await app.open(c.from);
    await expectActiveTab(screen, browser, c.fromTab);

    await switchTo(await openChainSwitcher(screen, browser, c.fromChain), c.to);

    await expect(browser).toHaveURL(pathPattern(c.expected), NAVIGATION);
    await expectActiveTab(screen, browser, c.toTab);
    // The switcher names the chain the user switched to.
    await expect(screen.getByRole('button', c.to)).toBeVisible();
  });
}

// The chain switch and the Mainnet/Fuji switch compose: both orders land on the same page.
test('chain switch, then the Fuji switch, keeps the blocks tab', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain/blocks');
  await switchTo(await openChainSwitcher(screen, browser, 'C-Chain'), 'P-Chain');
  await expect(browser).toHaveURL(pathPattern('/explorer/mainnet/p-chain/blocks'), NAVIGATION);

  await (await networkSwitch(screen, browser)).getByRole('link', 'Fuji').tap();
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/p-chain/blocks'), NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
});

test('Fuji switch, then the chain switch, keeps the blocks tab', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain/blocks');
  await (await networkSwitch(screen, browser)).getByRole('link', 'Fuji').tap();
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/c-chain/blocks'), NAVIGATION);

  await switchTo(await openChainSwitcher(screen, browser, 'C-Chain'), 'P-Chain');
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/p-chain/blocks'), NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
  await expect((await networkSwitch(screen, browser)).getByRole('link', 'Fuji')).toHaveAttribute('aria-current', 'page');
});
