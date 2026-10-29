import { test, type Browser, type WebRoute } from '@e2e-dev/web';
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

// Rule: a CB58 id the P-Chain search does not claim can still be an X-Chain
// transaction or genesis asset — the x-api has no search endpoint, so the
// search probes tx/{id} then asset/{id} (xchainSearchCached in
// components/explorer-v2/chain-search.tsx). Two fixed, immutable ids.

const X_CHAIN_TX = '5ZUur5o2BWQtwuF8xrVevbXHEt7HQGS9tFCka4TCJhEJ2x1Vo';
const P_CHAIN_TX = '2o2g8ysLJvuUdn8LziSZGN8cdEeEgbejTWWTfu4XRnqJzaPZZD';

// The entity row names the chain the identifier resolved to before Enter opens it.
const TX_ROW = /^Transaction .+ X-Chain$/;

test('all networks search opens an x-chain tx id on the x-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  await box.fill(X_CHAIN_TX);
  await expect(screen.getByRole('button', TX_ROW)).toBeVisible(DATA);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/x-chain/tx/${X_CHAIN_TX}`, NAVIGATION);
  await expect(screen.getByText('Hash')).toBeVisible(DATA);
  await expect(screen.getByText('Transaction not found')).toBeHidden();
});

test('x-chain search opens an x-chain tx id on the x-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet/x-chain/txs');
  // A tx row in the list shows the page has hydrated and the box is live.
  // The phone layout labels the block cell, so "#" is the row's invariant.
  await expect(screen.getByRole('link', /#\d/).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search');
  await box.fill(X_CHAIN_TX);
  await expect(screen.getByRole('button', TX_ROW)).toBeVisible(DATA);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/x-chain/tx/${X_CHAIN_TX}`, NAVIGATION);
  await expect(screen.getByText('Hash')).toBeVisible(DATA);
  await expect(screen.getByText('Transaction not found')).toBeHidden();
});

test('all networks search keeps a p-chain tx id on the p-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  await box.fill(P_CHAIN_TX);
  await expect(screen.getByRole('button', /^Transaction .+ P-Chain$/)).toBeVisible(DATA);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/p-chain/tx/${P_CHAIN_TX}`, NAVIGATION);
  await expect(screen.getByText(P_CHAIN_TX).first()).toBeVisible(DATA);
  await expect(screen.getByText('Transaction not found')).toBeHidden();
});

// Rule: a bech32 address is one account on the P-Chain and X-Chain — the
// X-/P- prefix selects the chain; a bare address asks each chain whether it
// holds the account and the row lands on the chain that does
// (bech32AddressCached in components/explorer-v2/chain-search.tsx).
// Fixed address: empty on the P-Chain, balance and tx history on the X-Chain.

const X_ONLY_ADDRESS = 'avax1xph3ysxkmj2zlhac6nz9hj9cx2av4f7xa9a245';

// The two X-Chain probes of a bare address: the node's UTXO read (through the public API relay) and the explorer
// API's history read, which the proxy cuts at 15 s with a soft 504.
const UTXO_READ = /\/api\/avalanche-api\/mainnet\/ext\/bc\/X$/;
const HISTORY_READ = new RegExp(`/api/xchain/mainnet/address/${X_ONLY_ADDRESS}$`);
const X_ROW = /^Address .+ X-Chain$/;

// What the first X-Chain probes answered. A missing X-Chain row then names the read that failed, so a failure in CI
// shows the soft 504 or the refusal instead of leaving it to be inferred.
function probeAnswers(browser: Browser): Promise<string> {
  const answer = (name: string, pattern: RegExp) =>
    browser.waitForResponse(pattern, DATA).then(
      (res) => `${name} ${res.status}${res.headers['x-status'] ? ` (x-status ${res.headers['x-status']})` : ''}`,
      () => `${name} did not answer`,
    );
  return Promise.all([answer('UTXO read', UTXO_READ), answer('history read', HISTORY_READ)]).then((a) => a.join(', '));
}

test('all networks search opens an x-only bech32 address on the x-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  const probes = probeAnswers(browser);
  await box.fill(X_ONLY_ADDRESS);
  const missing = await expect(screen.getByRole('button', X_ROW))
    .toBeVisible(DATA)
    .then(
      () => null,
      (error: Error) => error,
    );
  // every step is awaited: the history read can answer after the row shows
  const answered = await probes;
  if (missing) throw new Error(`${missing.message}\nThe X-Chain probes answered: ${answered}`);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/x-chain/address/X-${X_ONLY_ADDRESS}`, NAVIGATION);
  await expect(screen.getByText('Address not found')).toBeHidden();
});

// Rule: a failed X-Chain probe is unknown, not "not on the X-Chain". The search does not keep it: it asks the X-Chain
// once more, the row says so meanwhile, and the address still opens on the X-Chain. Here the first UTXO read gets a
// 502 and the first history read the proxy's soft 504; the second UTXO read waits RETRY_HOLD_MS, then goes through.
// The P-Chain read answers a fixed miss, so a live P-Chain error cannot add the P-Chain to the row's text.
const RETRY_HOLD_MS = 3_000;
const PCHAIN_READ = new RegExp(`/api/pchain/mainnet/address/${X_ONLY_ADDRESS}$`);

async function failFirstProbes(browser: Browser): Promise<{ utxo: number; history: number }> {
  const calls = { utxo: 0, history: 0 };
  await browser.route(PCHAIN_READ, (route: WebRoute) =>
    route.fulfill({ json: { utxoCount: 0, utxos: [], balance: { total: '0' } } }),
  );
  await browser.route(UTXO_READ, async (route: WebRoute) => {
    calls.utxo += 1;
    if (calls.utxo === 1) return route.fulfill({ status: 502, json: { error: 'Upstream unavailable' } });
    await new Promise((resolve) => setTimeout(resolve, RETRY_HOLD_MS));
    await route.continue();
  });
  await browser.route(HISTORY_READ, async (route: WebRoute) => {
    calls.history += 1;
    if (calls.history > 1) return route.continue();
    await route.fulfill({
      headers: { 'x-status': '504', 'cache-control': 'no-store' },
      json: { error: 'upstream timeout' },
    });
  });
  return calls;
}

test('search asks the x-chain again after a failed probe', MULTI_PAGE, async ({ app, screen, browser }) => {
  const calls = await failFirstProbes(browser);
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  await box.fill(X_ONLY_ADDRESS);
  await expect(screen.getByRole('button', /^Address .+ Asking the X-Chain again…$/)).toBeVisible(DATA);
  await expect(screen.getByRole('button', X_ROW)).toBeVisible(DATA);
  expect(calls.utxo).toBe(2);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/x-chain/address/X-${X_ONLY_ADDRESS}`, NAVIGATION);
});

test('all networks search opens an x-prefixed address on the x-chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search or ask a question');
  await box.fill(`X-${X_ONLY_ADDRESS}`);
  await expect(screen.getByRole('button', X_ROW)).toBeVisible(DATA);
  await box.press('Enter');
  await expect(browser).toHaveURL(`/explorer/mainnet/x-chain/address/X-${X_ONLY_ADDRESS}`, NAVIGATION);
  await expect(screen.getByText('Address not found')).toBeHidden();
});

// Rule: an EVM chain's search box suggests the chains of its own network, so a Fuji box never opens a mainnet chain
// (EvmSearchBox in components/explorer-v2/evm/EvmSearch.tsx). Beam runs on mainnet as beam and on Fuji as beam-l1.

test('a fuji chain search opens the fuji beam, not the mainnet one', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open('/explorer/fuji/c-chain');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  const box = screen.getByRole('textbox', 'Search the chain or ask a question about it');
  await box.fill('beam');
  // the Fuji row is Beam L1, tagged Testnet; the mainnet row, plain Beam, is not offered
  await expect(screen.getByRole('button', /^Beam L1.*Testnet/i)).toBeVisible(DATA);
  await expect(screen.getByRole('button', /^Beam ?name/i)).toBeHidden();
  await box.press('Enter');
  await expect(browser).toHaveURL('/explorer/fuji/beam-l1', NAVIGATION);
});
