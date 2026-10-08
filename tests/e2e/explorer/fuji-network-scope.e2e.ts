import { readFileSync } from 'node:fs';
import { test, type Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { answerFirstVisitPrompts } from '../lib/visitor';
import {
  DATA,
  MULTI_PAGE,
  NAVIGATION,
  OVERVIEW_BLOCK_ROW,
  expectActiveTab,
  networkSwitch,
  openChainSwitcher,
  pathPattern,
  sectionTabs,
} from './explorer-page';

// Rule: /explorer/fuji is the All Networks view of Fuji, and /explorer/fuji/chains is the Fuji City. Each view shows
// Fuji chains only, and the Mainnet | Fuji switch keeps the view, and the open chain where the other network has it.
// The switch targets come from switchTarget and cityChainOn in components/explorer-v2/network-switch.ts.
// tests/unit/explorer/network-switch.test.ts checks the same rules without a browser.
//
// The City is a 3D city with a sidebar from 1024 px, and a list of districts below that width. These tests do not
// read the 3D canvas: they read the controls, the URLs and the text (see city-frame.e2e.ts).

const MAINNET_CITY = '/explorer/mainnet/chains';
// How long the linked-chain test holds the overview feed: longer than the P-Chain registry takes to answer.
const OVERVIEW_DELAY_MS = 20_000;
const FUJI_CITY = '/explorer/fuji/chains';
// A tap on the City. CI draws the 3D City with software WebGL, which holds the page's main thread for seconds at a time
// while the City builds: a tap's input waits for the page that long. On a GPU the tap lands at once.
const CITY_TAP = { timeout: 90_000 };

// A short hash or address link on an overview board, as truncate() writes it: "0x1281…9d13".
const SHORT_HASH = /^(0x)?[0-9A-Za-z]{4,6}…[0-9A-Za-z]{4}$/;

interface CatalogChain {
  chainName: string;
  isTestnet?: boolean;
}

// The chain names of the catalog (constants/l1-chains.json): the Fuji entries, and the mainnet names that no Fuji
// entry has. Each test that needs them reads the file in its body, not when the runner collects the tests.
function catalogNames(): { fuji: Set<string>; mainnetOnly: Set<string> } {
  const catalog = JSON.parse(
    readFileSync(new URL('../../../constants/l1-chains.json', import.meta.url), 'utf8'),
  ) as CatalogChain[];
  // Some entries have no name. The City shows a short ID for them.
  const named = (chains: CatalogChain[]) => chains.map((c) => c.chainName.trim()).filter(Boolean);
  const fuji = new Set(named(catalog.filter((c) => c.isTestnet === true)));
  const mainnetOnly = new Set(named(catalog.filter((c) => c.isTestnet !== true)).filter((name) => !fuji.has(name)));
  return { fuji, mainnetOnly };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A row of the City list reads: the initial of the chain when it has no logo, the name, a 4-character tag when two
// chains have the same name (the rendered text puts no space before it), the badges on a large screen, then the count
// (validators by default; on a phone " val" and the badges follow it).
function namesOneOf(text: string, names: Set<string>): boolean {
  return [...names].some((name) =>
    new RegExp(`^(\\S )?${escapeRegExp(name)}(\\S{4})?( NEW| PRIVATE)* ([\\d.,]+[KMB]?|\\u2014)( |$)`).test(text),
  );
}

// A test that opens the City answers the privacy banner first, so the banner does not cover the controls.
async function openCity(app: { open(path: string): Promise<unknown> }, browser: Browser, path: string): Promise<void> {
  await app.open(path);
  await answerFirstVisitPrompts(browser);
  await app.open(path);
}

// The City's Mainnet | Fuji switch. On a large screen it is the "Network" card in the sidebar head, which stays in the
// accessibility tree while the sidebar is shut. On a phone it is in the chain switcher menu in the site navbar.
async function cityNetworkSwitch(screen: Screen, browser: Browser): Promise<Screen> {
  return (await isPhoneLayout(browser)) ? networkSwitch(screen, browser) : screen.getByRole('group', 'Network');
}

// The open chain's pane: the sidebar on a large screen, a sheet named after the chain on a phone.
async function chainPane(screen: Screen, browser: Browser, chain: RegExp): Promise<Locator> {
  return (await isPhoneLayout(browser)) ? screen.getByRole('dialog', chain) : screen.getByRole('complementary', 'Chains');
}

// The full URL of the City with this open chain. The City adds the chain's district to the query when it opens it.
function cityWithChain(city: string, chain: string): RegExp {
  return new RegExp(`^https?://[^/]+${escapeRegExp(`${city}?chain=${chain}`)}(&district=[a-z-]+)?$`);
}

// Resolves after `ms`. The timer does not keep the test process alive.
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref());
}

test('the City switch keeps the City', MULTI_PAGE, async ({ app, screen, browser }) => {
  await openCity(app, browser, MAINNET_CITY);
  await (await cityNetworkSwitch(screen, browser)).getByRole('link', 'Fuji').tap(CITY_TAP);
  await expect(browser).toHaveURL(pathPattern(FUJI_CITY), NAVIGATION);

  // The current network is text with aria-current on a large screen, and a link on a phone. CSS can set it in upper
  // case, and a text query reads the rendered text.
  const fujiSwitch = await cityNetworkSwitch(screen, browser);
  await expect(fujiSwitch.getByText(/^Fuji$/i)).toHaveAttribute('aria-current', 'page');
  if (!(await isPhoneLayout(browser))) {
    // The view card links the Fuji explorer, and names the City as the current view.
    const views = screen.getByRole('group', 'Explorer view');
    await expect(views.getByRole('link', 'Explorer')).toHaveAttribute('href', '/explorer/fuji');
    await expect(views.getByText('City')).toHaveAttribute('aria-current', 'page');
  }
  await fujiSwitch.getByRole('link', 'Mainnet').tap(CITY_TAP);
  await expect(browser).toHaveURL(pathPattern(MAINNET_CITY), NAVIGATION);
});

test('the pane switch keeps the open chain on the other network', MULTI_PAGE, async ({ app, screen, browser }) => {
  // Beam runs on Fuji as beam-l1. The pane opens when the City's chains load.
  await app.open(MAINNET_CITY);
  await answerFirstVisitPrompts(browser);
  await app.open(`${MAINNET_CITY}?chain=beam`);
  const mainnetPane = await chainPane(screen, browser, /^Beam/);
  await expect(mainnetPane.getByRole('heading', 'Beam', { level: 2 })).toBeVisible(DATA);
  const toFuji = mainnetPane.getByRole('group', 'Network').getByRole('link', 'Fuji');
  await expect(toFuji).toHaveAttribute('href', `${FUJI_CITY}?chain=beam-l1`);
  await toFuji.tap(CITY_TAP);

  await expect(browser).toHaveURL(cityWithChain(FUJI_CITY, 'beam-l1'), NAVIGATION);
  const fujiPane = await chainPane(screen, browser, /^Beam/);
  await expect(fujiPane.getByRole('heading', 'Beam L1', { level: 2 })).toBeVisible(DATA);
  const toMainnet = fujiPane.getByRole('group', 'Network').getByRole('link', 'Mainnet');
  await expect(toMainnet).toHaveAttribute('href', `${MAINNET_CITY}?chain=beam`);
  // The page keeps the mainnet feeds that it read, so the return opens the pane from them at once.
  await toMainnet.tap(CITY_TAP);

  await expect(browser).toHaveURL(cityWithChain(MAINNET_CITY, 'beam'), NAVIGATION);
  await expect((await chainPane(screen, browser, /^Beam/)).getByRole('heading', 'Beam', { level: 2 })).toBeVisible(DATA);
});

test('the Fuji overview boards link Fuji pages only', async ({ app, screen }) => {
  await app.open('/explorer/fuji');
  const blocks = screen.getByRole('link', OVERVIEW_BLOCK_ROW);
  const hashes = screen.getByRole('link', SHORT_HASH);
  await expect(blocks.first()).toBeVisible(DATA);
  await expect(hashes.first()).toBeVisible(DATA);
  // New rows arrive every few seconds, and a read of a row that left fails, so the poll reads the boards again.
  const notFuji = async () => {
    const links = [...(await blocks.all()), ...(await hashes.all())];
    const hrefs = await Promise.all(links.map((link) => link.getAttribute('href')));
    return hrefs.filter((href) => !href?.startsWith('/explorer/fuji/'));
  };
  await expect.poll(notFuji).toEqual([]);
});

test('the Fuji City lists no mainnet chain', MULTI_PAGE, async ({ app, screen, browser }) => {
  const { fuji, mainnetOnly } = catalogNames();
  // The City names the C-Chain "C-Chain", and the Fuji catalog names it "Avalanche (C-Chain)".
  fuji.add('C-Chain');
  await openCity(app, browser, FUJI_CITY);

  // On a large screen the list is in the sidebar, which the Chains door opens. On a phone the district browser shows
  // it, and each row is a button whose name ends with its validator count.
  let rows: Locator;
  if (await isPhoneLayout(browser)) {
    rows = screen.getByRole('button', / val( |$)/);
  } else {
    const door = screen.getByRole('button', /^Chains/);
    await door.tap(CITY_TAP);
    await expect(door).toHaveAttribute('aria-expanded', 'true');
    rows = screen.getByRole('complementary', 'Chains').getByRole('listitem');
  }
  await expect(rows.first()).toBeVisible(DATA);
  const texts = await rows.allTextContents();

  // The City names a chain from the P-Chain feed, else the Fuji catalog, else a short ID (the first 6 and the last 4
  // characters of its ID). Many Fuji L1s are not in the catalog, so a name can be in neither catalog, and a short ID
  // is in none. A mainnet chain shows as a name that only mainnet entries have.
  const catalogued = texts.filter((text) => namesOneOf(text, fuji));
  const mainnet = texts.filter((text) => !namesOneOf(text, fuji) && namesOneOf(text, mainnetOnly));
  expect(catalogued.length, 'rows that name a Fuji catalog chain').toBeGreaterThan(0);
  expect(mainnet, 'rows that name a mainnet-only chain').toEqual([]);
});

test('Fuji All Networks says the figures that Fuji has no feed for', async ({ app, screen }) => {
  await app.open('/explorer/fuji');
  await expect(screen.getByText('Test tokens have no price')).toBeVisible(DATA);
  await expect(screen.getByText('No feed counts Fuji burns')).toBeVisible();
  // TVL and Burned read "No data". The stake reads it too when its read fails.
  await expect.poll(() => screen.getByText('No data').count()).toBeGreaterThanOrEqual(2);
});

test('the Fuji City says test AVAX has no price', MULTI_PAGE, async ({ app, screen, browser }) => {
  // A large screen shows the figures in a strip at the city's foot, a phone in a grid over the list.
  await openCity(app, browser, FUJI_CITY);
  await expect(screen.getByText('No price')).toBeVisible(DATA);
  await expect(screen.getByText('Test AVAX has no market')).toBeVisible();
});

test('Fuji All Networks has no AVAX or Query tab, and its chain menu lists Fuji chains only', async ({
  app,
  screen,
  browser,
}) => {
  const { fuji, mainnetOnly } = catalogNames();
  await app.open('/explorer/fuji');
  await expectActiveTab(screen, browser, 'Explorer');
  // The two views: Explorer and City (a phone names the City tab "Chains").
  await expect(sectionTabs(screen).getByRole('link')).toHaveCount(2);
  await expect(sectionTabs(screen).getByRole('link', 'AVAX')).toHaveCount(0);
  await expect(sectionTabs(screen).getByRole('link', 'Query')).toHaveCount(0);

  // On a phone the menu opens from the site navbar. The L1 rows come from a live feed, so the test waits for one.
  const menu = await openChainSwitcher(screen, browser, 'All Networks');
  await expect(menu.getByRole('link', 'Beam L1')).toBeVisible(DATA);
  // CSS sets the network links in upper case, and the text read is the rendered text.
  const fixed = new Set(['MAINNET', 'FUJI', 'ALL NETWORKS', 'C-CHAIN', 'P-CHAIN', 'X-CHAIN']);
  const l1s = (await menu.getByRole('link').allTextContents()).filter((text) => !fixed.has(text.toUpperCase()));
  expect(l1s.length).toBeGreaterThan(0);
  expect(l1s.filter((name) => mainnetOnly.has(name)), 'mainnet-only chains in the Fuji menu').toEqual([]);
  expect(l1s.filter((name) => !fuji.has(name)), 'menu rows that name no Fuji catalog chain').toEqual([]);
});

// The pane of a linked chain stays open whatever feed answers first. Here the overview feed answers last.
test('a linked chain stays open when the overview feed answers after the P-Chain registry', MULTI_PAGE, async ({
  app,
  screen,
  browser,
}) => {
  await browser.route(/\/api\/overview-stats\?/, async (route) => {
    await pause(OVERVIEW_DELAY_MS);
    await route.continue();
  });
  await openCity(app, browser, `${FUJI_CITY}?chain=beam-l1`);
  await browser.waitForResponse(/\/api\/overview-stats\?.*network=fuji/, { timeout: OVERVIEW_DELAY_MS + DATA.timeout });
  await expect((await chainPane(screen, browser, /^Beam/)).getByRole('heading', 'Beam L1', { level: 2 })).toBeVisible();
  await expect(browser).toHaveURL(cityWithChain(FUJI_CITY, 'beam-l1'));
});
