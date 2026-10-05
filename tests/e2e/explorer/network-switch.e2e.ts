import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION, expectActiveTab, networkSwitch, pathPattern } from './explorer-page';

// Rule: the Mainnet/Fuji switch keeps the tab the user is on.
// The switch targets come from switchTarget in components/explorer-v2/network-switch.ts.
// tests/unit/explorer/network-switch.test.ts checks the same table without a browser.

interface SwitchCase {
  /** The page the user is on. */
  from: string;
  /** The tab that is active on that page. */
  fromTab: string;
  /** The network segment the user clicks. */
  to: 'Mainnet' | 'Fuji';
  /** The path the user must land on. */
  expected: string;
  /** The tab that must be active after the switch. */
  toTab: string;
}

const CASES: SwitchCase[] = [
  // Mainnet to Fuji, EVM chains
  { from: '/explorer/mainnet/c-chain', fromTab: 'Overview', to: 'Fuji', expected: '/explorer/fuji/c-chain', toTab: 'Overview' },
  { from: '/explorer/mainnet/c-chain/blocks', fromTab: 'Blocks', to: 'Fuji', expected: '/explorer/fuji/c-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/mainnet/c-chain/txs', fromTab: 'Transactions', to: 'Fuji', expected: '/explorer/fuji/c-chain/txs', toTab: 'Transactions' },
  { from: '/explorer/mainnet/c-chain/gas', fromTab: 'Gas', to: 'Fuji', expected: '/explorer/fuji/c-chain/gas', toTab: 'Gas' },
  { from: '/explorer/mainnet/c-chain/gas/base-fee', fromTab: 'Gas', to: 'Fuji', expected: '/explorer/fuji/c-chain/gas/base-fee', toTab: 'Gas' },
  // The query string is a filter. The tab is the rule, so the URL may keep or drop the query.
  { from: '/explorer/mainnet/c-chain/validators?q=ava', fromTab: 'Validators', to: 'Fuji', expected: '/explorer/fuji/c-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/c-chain/accounts', fromTab: 'Accounts', to: 'Fuji', expected: '/explorer/fuji/c-chain/accounts', toTab: 'Accounts' },
  // DeFi is mainnet only and its Fuji URL redirects back to mainnet, so the chain home is the right landing.
  { from: '/explorer/mainnet/c-chain/defi', fromTab: 'DeFi', to: 'Fuji', expected: '/explorer/fuji/c-chain', toTab: 'Overview' },
  // Beam has a different slug on Fuji (beam-l1). The switch must keep the sub-page on that slug.
  { from: '/explorer/mainnet/beam/blocks', fromTab: 'Blocks', to: 'Fuji', expected: '/explorer/fuji/beam-l1/blocks', toTab: 'Blocks' },

  // Mainnet to Fuji, P-Chain and X-Chain
  { from: '/explorer/mainnet/p-chain', fromTab: 'Overview', to: 'Fuji', expected: '/explorer/fuji/p-chain', toTab: 'Overview' },
  { from: '/explorer/mainnet/p-chain/blocks', fromTab: 'Blocks', to: 'Fuji', expected: '/explorer/fuji/p-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/mainnet/p-chain/txs', fromTab: 'Transactions', to: 'Fuji', expected: '/explorer/fuji/p-chain/txs', toTab: 'Transactions' },
  { from: '/explorer/mainnet/p-chain/validators', fromTab: 'Validators', to: 'Fuji', expected: '/explorer/fuji/p-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/p-chain/validators/l1s', fromTab: 'Validators', to: 'Fuji', expected: '/explorer/fuji/p-chain/validators/l1s', toTab: 'Validators' },
  // Fuji has no Staking or L1s tab. Their Fuji routes redirect to the validators list, so the switch must land there.
  { from: '/explorer/mainnet/p-chain/staking', fromTab: 'Staking', to: 'Fuji', expected: '/explorer/fuji/p-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/p-chain/l1s', fromTab: 'L1s', to: 'Fuji', expected: '/explorer/fuji/p-chain/validators', toTab: 'Validators' },
  { from: '/explorer/mainnet/x-chain/blocks', fromTab: 'Blocks', to: 'Fuji', expected: '/explorer/fuji/x-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/mainnet/x-chain/txs', fromTab: 'Transactions', to: 'Fuji', expected: '/explorer/fuji/x-chain/txs', toTab: 'Transactions' },

  // Fuji to Mainnet
  { from: '/explorer/fuji/c-chain/blocks', fromTab: 'Blocks', to: 'Mainnet', expected: '/explorer/mainnet/c-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/fuji/c-chain/txs', fromTab: 'Transactions', to: 'Mainnet', expected: '/explorer/mainnet/c-chain/txs', toTab: 'Transactions' },
  { from: '/explorer/fuji/c-chain/gas', fromTab: 'Gas', to: 'Mainnet', expected: '/explorer/mainnet/c-chain/gas', toTab: 'Gas' },
  { from: '/explorer/fuji/c-chain/accounts', fromTab: 'Accounts', to: 'Mainnet', expected: '/explorer/mainnet/c-chain/accounts', toTab: 'Accounts' },
  { from: '/explorer/fuji/beam-l1/blocks', fromTab: 'Blocks', to: 'Mainnet', expected: '/explorer/mainnet/beam/blocks', toTab: 'Blocks' },
  { from: '/explorer/fuji/p-chain/blocks', fromTab: 'Blocks', to: 'Mainnet', expected: '/explorer/mainnet/p-chain/blocks', toTab: 'Blocks' },
  { from: '/explorer/fuji/p-chain/validators', fromTab: 'Validators', to: 'Mainnet', expected: '/explorer/mainnet/p-chain/validators', toTab: 'Validators' },
  { from: '/explorer/fuji/x-chain/txs', fromTab: 'Transactions', to: 'Mainnet', expected: '/explorer/mainnet/x-chain/txs', toTab: 'Transactions' },
];

for (const c of CASES) {
  test(`${c.to} switch from ${c.from} lands on ${c.expected}`, async ({ app, screen, browser }) => {
    await app.open(c.from);
    await expectActiveTab(screen, browser, c.fromTab);

    // The phone layout moves the switch into the chain switcher menu in the site navbar. The hidden copy in the
    // tab rail is not in the role tree.
    await (await networkSwitch(screen, browser)).getByRole('link', c.to).tap();

    await expect(browser).toHaveURL(pathPattern(c.expected), NAVIGATION);
    await expectActiveTab(screen, browser, c.toTab);
    // The segment of the current network says so to assistive tech, not by colour alone.
    const after = await networkSwitch(screen, browser);
    await expect(after.getByRole('link', c.to)).toHaveAttribute('aria-current', 'page');
    await expect(after.getByRole('link', c.to === 'Fuji' ? 'Mainnet' : 'Fuji')).not.toHaveAttribute('aria-current');
  });
}

// The network-scope aggregates are mainnet only, so the page shows a label and no switch.
test('network home names Mainnet and shows no switch', async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet');
  await expectActiveTab(screen, browser, 'Explorer');
  // On a phone the label is in the chain switcher menu. The network under the switcher's name is aria-hidden.
  const area = await networkSwitch(screen, browser);
  await expect(area.getByText('Mainnet', { visible: true })).toBeVisible();
  await expect(screen.getByRole('link', 'Fuji')).toHaveCount(0);
  await expect(screen.getByRole('link', 'Mainnet')).toHaveCount(0);
});
