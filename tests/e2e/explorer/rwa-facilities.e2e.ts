import { test } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { phoneOnly } from '../lib/skip';
import { DATA, MULTI_PAGE, NAVIGATION, expectActiveTab } from './explorer-page';

// The C-Chain DeFi tab's RWA view holds two facilities, each at its own URL: OatFi's at /defi/rwa, where old links land,
// and Rain's at /defi/rwa/rain. A switch at the top of the view moves between them. Explorer data is live, so these
// tests check the structure and that the figures load, not their values.

const OATFI = '/explorer/mainnet/c-chain/defi/rwa';
const RAIN = '/explorer/mainnet/c-chain/defi/rwa/rain';
// the line under Assets Financed once the figures load, and the ledger's footer once its first page loads
const DRAWS = /^across [\d,]+ draws?$/;
const ROWS = /^[1-9][\d,]* transactions?$/;
// the types of Rain's ledger, as its Type column and its type chips name them
const TYPES = ['Draw', 'Repayment', 'Commitment', 'Withdrawal'];

const facilities = (screen: Screen) => screen.getByRole('navigation', 'RWA facility');

// Every row on the ledger's page has one of these types in its Type cell. Each row has one link that opens its
// transaction. A row has no role, but its text starts with its date (UTC) and its type, which neither cell holds
// alone, so a text query for that start finds the rows themselves.
async function expectRowTypes(screen: Screen, types: readonly string[]): Promise<void> {
  const rows = screen.getByRole('link', 'Open the transaction');
  await expect(rows.first()).toBeVisible(DATA);
  const typed = new RegExp(`^[A-Z][a-z]{2} \\d{1,2}, \\d{4}, \\d{2}:\\d{2}\\s*(${types.join('|')})`);
  await expect(screen.getByText(typed)).toHaveCount(await rows.count());
}

test('the facility switch moves between the OatFi and Rain facilities', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open(OATFI);
  await expect(facilities(screen).getByRole('link', 'OatFi')).toHaveAttribute('aria-current', 'page');
  await expect(screen.getByRole('heading', 'Valinor × OatFi × Fence Pilot', { level: 1 })).toBeVisible();

  await facilities(screen).getByRole('link', 'Rain').tap();
  await expect(browser).toHaveURL(RAIN, NAVIGATION);
  await expect(facilities(screen).getByRole('link', 'Rain')).toHaveAttribute('aria-current', 'page');
  await expect(screen.getByRole('heading', 'Valinor × Rain × Credit Coop', { level: 1 })).toBeVisible();

  await facilities(screen).getByRole('link', 'OatFi').tap();
  await expect(browser).toHaveURL(OATFI, NAVIGATION);
  await expect(screen.getByRole('heading', 'Valinor × OatFi × Fence Pilot', { level: 1 })).toBeVisible();
});

// At the phone size the two switches are wider than their row, so the facility switch wraps under the DeFi switch.
// Both its links must stay whole on the screen. The first test taps each of them at this size too.
test('on a phone both links of the facility switch show in full', async ({ app, screen, browser }) => {
  await app.open(RAIN);
  await phoneOnly(browser);
  const width = await browser.evaluate(() => window.innerWidth);
  for (const name of ['OatFi', 'Rain']) {
    const link = facilities(screen).getByRole('link', name);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x, name).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(width);
  }
});

test("the Rain page shows the line of credit's sections and none of OatFi's", async ({ app, screen, browser }) => {
  await app.open(RAIN);
  await expect(browser).toHaveTitle(/RWA, Rain/);
  await expectActiveTab(screen, browser, 'DeFi');
  await expect(screen.getByRole('navigation', 'DeFi view').getByRole('link', 'RWA')).toHaveAttribute('aria-current', 'page');
  for (const partner of ['Valinor', 'Rain', 'Credit Coop']) await expect(screen.getByRole('img', partner)).toBeVisible();
  for (const section of ['Key Metrics', 'Capital Flow Pipeline', 'Historical Trends', 'Recent Transactions']) await expect(screen.getByText(section)).toBeVisible();
  for (const gone of ['OatFi Breakdown', 'Facility Performance', 'Transacted Volume', 'Transaction Volume Over Time']) await expect(screen.getByText(gone)).toHaveCount(0);
});

test('the Rain page reads its figures and cuts its ledger by type', async ({ app, screen }) => {
  await app.open(RAIN);
  await expect(screen.getByText(DRAWS)).toBeVisible(DATA);
  await expect(screen.getByText(ROWS)).toBeVisible(DATA);
  await expectRowTypes(screen, TYPES);
  const draws = screen.getByRole('button', 'Draw');
  await draws.tap();
  await expect(draws).toHaveAttribute('aria-pressed', 'true');
  await expect(screen.getByText(ROWS)).toBeVisible(DATA);
  await expectRowTypes(screen, ['Draw']);
});
