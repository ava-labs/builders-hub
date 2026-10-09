import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openAsReturningVisitor } from './helpers';

test('console opens on its dashboard', { tags: ['smoke'] }, async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/console');
  await expect(browser).toHaveTitle('Console | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Avalanche Builder Console', { level: 1 })).toBeAttached();
  await expect(screen.getByRole('link', /^Layer 1 Create an L1/)).toHaveAttribute('href', '/console/create-l1');
  await expect(screen.getByRole('link', /^Fuji Testnet faucet/)).toBeVisible();
});

test('unit converter shows its tool and converts without a wallet', async ({ app, browser }) => {
  await openAsReturningVisitor(app, browser, '/console/primary-network/unit-converter');
  const tool = browser.locator('[data-console-tool="AVAX Unit Converter"]');
  await expect(tool.getByRole('heading', 'AVAX Unit Converter', { level: 1 })).toBeVisible();
  const avax = tool.getByLabel('AVAX amount');
  const nAvax = tool.getByLabel('nAVAX amount');
  const wei = tool.getByLabel('Wei amount');
  // The tool starts at 1 AVAX. An effect writes the nAVAX value, so this value also shows that React is ready.
  await expect(nAvax).toHaveValue('1000000000');
  await avax.fill('2');
  await expect(nAvax).toHaveValue('2000000000');
  await expect(wei).toHaveValue('2000000000000000000');
});

test('faucet asks for a wallet before it shows the tool', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/console/primary-network/faucet');
  const gate = browser.locator('[data-console-tool-gate]');
  await expect(gate.getByRole('heading', 'To use this tool you need:')).toBeVisible();
  await expect(gate.getByText('Wallet connected')).toBeVisible();
  await expect(browser.locator('[data-console-tool]')).toHaveCount(0);
  // The Testnet/Mainnet switch renders only with a connected wallet. The header offers the connection.
  // The gate's own button is named "Connect", so this name finds the header button only.
  await expect(screen.getByRole('button', 'Connect wallet')).toBeVisible();
});

test('console tool page keeps the site name in its title', async ({ app, browser }) => {
  await app.open('/console/primary-network/unit-converter');
  await expect(browser).toHaveTitle('AVAX Unit Converter | Avalanche Builder Hub');
});

test('console greets a new visitor with the welcome dialog', async ({ app, screen, browser }) => {
  // The visitor has answered the privacy banner. The next test covers a visitor who has not.
  await openAsReturningVisitor(app, browser, '/console', { answeredConsoleWelcome: false });
  const welcome = screen.getByRole('dialog', 'Welcome to Builder Console');
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', 'Skip').tap();
  await expect(welcome).toBeHidden();
  await expect(screen.getByRole('link', /^Layer 1 Create an L1/)).toBeVisible();
});

test('console welcome dialog can be skipped while the privacy banner shows', async ({ app, screen }) => {
  await app.open('/console');
  const welcome = screen.getByRole('dialog', 'Welcome to Builder Console');
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', 'Skip').tap();
  await expect(welcome).toBeHidden();
  // The open dialog hides the rest of the page from the accessibility tree. When it closes, the banner is there.
  await expect(screen.getByRole('button', 'Decline')).toBeVisible();
});

test('console does not greet a visitor again after they skip the welcome dialog', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/console', { answeredConsoleWelcome: false });
  const welcome = screen.getByRole('dialog', 'Welcome to Builder Console');
  await welcome.getByRole('button', 'Skip').tap();
  await expect(welcome).toBeHidden();
  await browser.reload();
  // The header wallet button renders on the client only. When it shows, the welcome dialog component has mounted.
  await expect(screen.getByRole('button', 'Connect wallet')).toBeVisible();
  // The dialog opens 800 ms after it mounts (welcome-modal.tsx). Wait longer than that, then make sure it is not there.
  await browser.evaluate(() => new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)));
  await expect(welcome).toHaveCount(0);
});
