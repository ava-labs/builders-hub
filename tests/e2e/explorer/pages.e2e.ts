import { describe, test } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION, OVERVIEW_BLOCK_ROW, expectActiveTab } from './explorer-page';

// Explorer data is live, so these tests check structure only: tabs, labels, and that rows exist.

// A row of the EVM blocks list: the height, then the time ("Time" is a cell label on phones).
const BLOCK_ROW = /^[\d,]+ (Time )?\d{2}:\d{2}:\d{2}/;
// The hash link of a row in the EVM transactions list, as truncate(hash, 8) writes it.
const TX_HASH = /^0x[0-9a-f]{6}…[0-9a-f]{4}$/;
// A "Latest Transactions" row on an overview: it starts with a short hash such as "0x3405…ca50" or "2ViccB…vY1J".
const OVERVIEW_TX_ROW = /^(0x)?[0-9A-Za-z]{4,6}…[0-9A-Za-z]{4}( |$)/;
// A row of the Primary Network roster: the rank (desktop only), the title of the status dot once the status loads, then the NodeID.
const VALIDATOR_ROW = /^(\d+ )?(Online |Offline |Connection not reported )?NodeID-[1-9A-HJ-NP-Za-km-z]+/;

async function expectOverview(screen: Screen): Promise<void> {
  await expect(screen.getByText('Latest Blocks')).toBeVisible();
  await expect(screen.getByText('Latest Transactions')).toBeVisible();
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  await expect(screen.getByRole('link', OVERVIEW_TX_ROW).first()).toBeVisible(DATA);
}

test('explorer front door opens the mainnet overview', { tags: ['smoke'] }, async ({ app, screen, browser }) => {
  await app.open('/explorer');
  await expect(browser).toHaveURL('/explorer/mainnet');
  await expect(browser).toHaveTitle(/All Networks/);
  await expectActiveTab(screen, browser, 'Explorer');
  await expectOverview(screen);
});

test('fuji front door opens the fuji p-chain', async ({ app, screen, browser }) => {
  await app.open('/explorer/fuji');
  await expect(browser).toHaveURL('/explorer/fuji/p-chain');
  await expectActiveTab(screen, browser, 'Overview');
  await expectOverview(screen);
});

for (const network of ['mainnet', 'fuji'] as const) {
  const root = `/explorer/${network}`;

  describe(network, () => {
    test('c-chain home shows latest blocks and transactions', async ({ app, screen, browser }) => {
      await app.open(`${root}/c-chain`);
      await expect(browser).toHaveTitle(/C-Chain/);
      await expectActiveTab(screen, browser, 'Overview');
      await expectOverview(screen);
    });

    test('c-chain blocks lists blocks', async ({ app, screen, browser }) => {
      await app.open(`${root}/c-chain/blocks`);
      await expectActiveTab(screen, browser, 'Blocks');
      await expect(screen.getByRole('link', BLOCK_ROW).first()).toBeVisible(DATA);
    });

    test('c-chain txs lists transactions', async ({ app, screen, browser }) => {
      await app.open(`${root}/c-chain/txs`);
      await expectActiveTab(screen, browser, 'Transactions');
      const views = screen.getByRole('group', 'Transaction view');
      await expect(views.getByRole('link', 'EVM')).toHaveAttribute('aria-current', 'page');
      await expect(screen.getByRole('link', TX_HASH).first()).toBeVisible(DATA);
    });

    test('first block row opens its block page', MULTI_PAGE, async ({ app, screen, browser }) => {
      await app.open(`${root}/c-chain/blocks`);
      const row = screen.getByRole('link', BLOCK_ROW).first();
      await expect(row).toBeVisible(DATA);
      await row.tap();
      await expect(browser).toHaveURL(new RegExp(`${root}/c-chain/block/\\d+$`), NAVIGATION);
      await expectActiveTab(screen, browser, 'Blocks');
      await expect(screen.getByText('Block')).toBeVisible();
      await expect(screen.getByText('Parent')).toBeVisible(DATA);
      await expect(screen.getByText('Gas Limit')).toBeVisible(DATA);
    });

    test('first transaction row opens its tx page', MULTI_PAGE, async ({ app, screen, browser }) => {
      await app.open(`${root}/c-chain/txs`);
      const hash = screen.getByRole('link', TX_HASH).first();
      await expect(hash).toBeVisible(DATA);
      await hash.tap();
      await expect(browser).toHaveURL(new RegExp(`${root}/c-chain/tx/0x[0-9a-f]{64}$`), NAVIGATION);
      await expectActiveTab(screen, browser, 'Transactions');
      await expect(screen.getByText('Transaction')).toBeVisible();
      await expect(screen.getByText('Nonce')).toBeVisible(DATA);
    });

    test('p-chain home shows latest blocks and transactions', async ({ app, screen, browser }) => {
      await app.open(`${root}/p-chain`);
      await expectActiveTab(screen, browser, 'Overview');
      await expectOverview(screen);
    });

    test('p-chain validators shows the validator sets', async ({ app, screen, browser }) => {
      await app.open(`${root}/p-chain/validators`);
      await expectActiveTab(screen, browser, 'Validators');
      await expect(screen.getByText('Validator Sets')).toBeVisible();
      const sets = screen.getByRole('group', 'Validator set');
      await expect(sets.getByRole('link', 'Primary Network')).toHaveAttribute('aria-current', 'page');
      await expect(screen.getByRole('link', VALIDATOR_ROW).first()).toBeVisible(DATA);
    });

    test('x-chain home shows latest blocks and transactions', async ({ app, screen, browser }) => {
      await app.open(`${root}/x-chain`);
      await expectActiveTab(screen, browser, 'Overview');
      await expectOverview(screen);
    });
  });
}
