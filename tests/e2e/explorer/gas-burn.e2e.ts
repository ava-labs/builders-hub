import { test, type Browser } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { DATA, MULTI_PAGE, NAVIGATION } from './explorer-page';

// The C-Chain gas page shows the AVAX burned on each day and the wallets that burned the most
// (components/explorer-v2/gas/burn.tsx). The page clock sets the window of both. Explorer data is live, so the test
// checks the structure and that a new window changes the figures, not the values.

// The native select of the page clock on a phone. Its name can end with the selected option, so match the start only.
const TIME_RANGE = /^Time range for all stats on this page/;

// A wallet address as the table writes it: the first 4 and the last 4 hex digits.
const SHORT_ADDRESS = /^0x[0-9a-f]{4}…[0-9a-f]{4}$/;

// The board's window under its figure, for example "paid 37.9K AVAX · Sep 6 to Oct 5".
const BOARD_WINDOW = /^paid [\d.]+[KM]? AVAX · /;

// The chart's line under its figure ends with its days, for example "$437.6K · 1.3K per day · Sep 6 to Oct 5".
// A window across New Year writes the years: "Dec 6, 2026 to Jan 4, 2027". Today's burn so far, when it loads, follows:
// "… · Sep 6 to Oct 5 · today so far 824 AVAX".
const CHART_WINDOW = / per day · [A-Z][a-z]{2} \d{1,2}(, \d{4})?( to [A-Z][a-z]{2} \d{1,2}(, \d{4})?)?( · today so far [\d.,]+[KM]? AVAX)?$/;

// Sets the page clock: a radio button on wider screens, a native select on a phone (components/explorer-v2/time-range.tsx).
async function pickRange(screen: Screen, browser: Browser, label: '1D' | '1W' | '1M') {
  if (await isPhoneLayout(browser)) await screen.getByRole('combobox', TIME_RANGE).selectOption({ label });
  else await screen.getByRole('radio', label).tap();
}

test('c-chain gas page shows the AVAX burned per day and the top burners of the clock window', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/c-chain/gas');
  const board = screen.getByRole('table', 'Top burners');
  // Until the board loads, the table holds ten placeholder rows. The window line shows only with the loaded board.
  const boardWindow = screen.getByText(BOARD_WINDOW);
  await expect(boardWindow).toBeVisible(DATA);
  // A header row and ten wallets, each a link to its address page.
  const rows = board.getByRole('row');
  await expect(rows).toHaveCount(11);
  const firstWallet = rows.nth(1).getByRole('cell').nth(1).getByRole('link');
  await expect(firstWallet).toHaveText(SHORT_ADDRESS);
  await expect(firstWallet).toHaveAttribute('href', /^\/explorer\/mainnet\/c-chain\/address\/0x[0-9a-f]{40}$/);
  // The burn per day loads beside it, with the days it covers.
  const chartWindow = screen.getByText(CHART_WINDOW);
  await expect(chartWindow).toBeVisible(DATA);
  const monthChart = await chartWindow.textContent();
  const monthBoard = await boardWindow.textContent();
  const monthTop = await rows.nth(1).textContent();

  // The page opens on the month clock. A week changes the days of both blocks and the board's rows.
  await pickRange(screen, browser, '1W');
  await expect(chartWindow).not.toHaveText(monthChart ?? '', DATA);
  await expect(boardWindow).not.toHaveText(monthBoard ?? '', DATA);
  await expect(rows).toHaveCount(11);
  await expect(rows.nth(1)).not.toHaveText(monthTop ?? '', DATA);

  // A wallet opens its address page.
  await rows.nth(1).getByRole('cell').nth(1).getByRole('link').tap();
  await expect(browser).toHaveURL(/\/explorer\/mainnet\/c-chain\/address\/0x[0-9a-f]{40}$/, NAVIGATION);
});
