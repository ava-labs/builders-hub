import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, phoneOnly } from '../lib/skip';
import { MULTI_PAGE, NAVIGATION, expectActiveTab, sectionTabs } from './explorer-page';

test('c-chain tabs change the URL and back returns to the previous tab', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain');
  await expectActiveTab(screen, browser, 'Overview');

  await sectionTabs(screen).getByRole('link', 'Blocks').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/blocks', NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');

  await sectionTabs(screen).getByRole('link', 'Transactions').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/txs', NAVIGATION);
  await expectActiveTab(screen, browser, 'Transactions');

  await sectionTabs(screen).getByRole('link', 'Accounts').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/accounts', NAVIGATION);
  await expectActiveTab(screen, browser, 'Accounts');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/txs', NAVIGATION);
  await expectActiveTab(screen, browser, 'Transactions');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/blocks', NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
});

test('p-chain tabs change the URL and back returns to the previous tab', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/p-chain');
  await expectActiveTab(screen, browser, 'Overview');

  await sectionTabs(screen).getByRole('link', 'Validators').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain/validators', NAVIGATION);
  await expectActiveTab(screen, browser, 'Validators');

  await sectionTabs(screen).getByRole('link', 'Blocks').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain/blocks', NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain/validators', NAVIGATION);
  await expectActiveTab(screen, browser, 'Validators');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain', NAVIGATION);
  await expectActiveTab(screen, browser, 'Overview');
});

test('fuji c-chain tabs change the URL and back returns to the previous tab', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/fuji/c-chain/blocks');
  await expectActiveTab(screen, browser, 'Blocks');

  await sectionTabs(screen).getByRole('link', 'Gas').tap();
  await expect(browser).toHaveURL('/explorer/fuji/c-chain/gas', NAVIGATION);
  await expectActiveTab(screen, browser, 'Gas');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/fuji/c-chain/blocks', NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
});

test('transaction views keep the transactions tab and back returns to the previous view', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain/txs');
  const views = screen.getByRole('group', 'Transaction view');
  await expect(views.getByRole('link', 'EVM')).toHaveAttribute('aria-current', 'page');

  await views.getByRole('link', 'Atomic').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/txs/atomic', NAVIGATION);
  await expect(views.getByRole('link', 'Atomic')).toHaveAttribute('aria-current', 'page');
  await expectActiveTab(screen, browser, 'Transactions');

  await views.getByRole('link', 'ICM').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/txs/icm', NAVIGATION);
  await expect(views.getByRole('link', 'ICM')).toHaveAttribute('aria-current', 'page');
  await expectActiveTab(screen, browser, 'Transactions');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/c-chain/txs/atomic', NAVIGATION);
  await expect(views.getByRole('link', 'Atomic')).toHaveAttribute('aria-current', 'page');
});

test('validator set switch keeps the validators tab and back returns to the previous set', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/p-chain/validators');
  // The tab rail also has an "L1s" tab, so the set links are found inside their group.
  const sets = screen.getByRole('group', 'Validator set');
  await expect(sets.getByRole('link', 'Primary Network')).toHaveAttribute('aria-current', 'page');

  await sets.getByRole('link', 'L1s').tap();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain/validators/l1s', NAVIGATION);
  await expect(sets.getByRole('link', 'L1s')).toHaveAttribute('aria-current', 'page');
  await expectActiveTab(screen, browser, 'Validators');

  await browser.back();
  await expect(browser).toHaveURL('/explorer/mainnet/p-chain/validators', NAVIGATION);
  await expect(sets.getByRole('link', 'Primary Network')).toHaveAttribute('aria-current', 'page');
  await expectActiveTab(screen, browser, 'Validators');
});

test('chain switcher names the current chain on desktop', async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain');
  await desktopOnly(browser);
  await expect(screen.getByRole('button', 'C-Chain')).toBeVisible();
});

test('chain switcher names the current chain on phone', async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain');
  await phoneOnly(browser);
  await expect(screen.getByRole('button', 'C-Chain')).toBeVisible();
});
