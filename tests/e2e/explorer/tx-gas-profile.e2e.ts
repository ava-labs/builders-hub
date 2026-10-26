import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// A C-Chain tx page's Gas tab shows gas by opcode (components/explorer-v2/evm/EvmTraceGas.tsx), and its Gas Charged
// box shows the gas execution used. Both come from the gas profile, which the page asks for apart from the trace
// (useGasProfile.ts): when the Gas tab opens or the focus or the pointer comes to it, and on load for a tx charged half
// its gas limit. A click or a key elsewhere on the page does not ask: each ask is a replay on the shared debug node. The
// trace route and the gas route answer from fixtures here, so no test runs a trace on the debug node. The txs are past
// mainnet txs; the page reads their receipts from the public RPC.

// a legacy tx charged 500,000 gas, half its 1,000,000 limit (tx-fee.e2e.ts)
const AT_HALF_LIMIT = '0xe6d1f7c5e6b4394ef839e79fb584ca3abe9d0c8eaa08d09623da9247dfdf9874';
// a dynamic-fee tx charged 61,138 gas, not half its limit (tx-fee.e2e.ts shows no minimum charge for it)
const ABOVE_HALF_LIMIT = '0x54b7bdbd4b90738ea11bf15c1c18f310904f52db7c6f3b270dc11b2f8c4488dd';

const ADDRESS = `0x${'0'.repeat(39)}1`;
const TRACE = {
  call: { type: 'CALL', from: ADDRESS, to: ADDRESS, input: '0x', gas: '0xf4240', gasUsed: '0x7a120', calls: [] },
  prestate: null,
  opcodes: null,
  steps: null,
  gas: null,
};
// the call opcodes (CALL, STATICCALL) stay out of the table: the EVM books the gas they forward as their own cost
const PROFILE = {
  opcodes: [
    { op: 'SSTORE', gas: 44_200, count: 2 },
    { op: 'CALL', gas: 30_000, count: 1 },
    { op: 'SLOAD', gas: 4_200, count: 2 },
    { op: 'STATICCALL', gas: 2_600, count: 1 },
    { op: 'PUSH1', gas: 300, count: 100 },
  ],
  steps: 1_234,
  gas: { limit: 1_000_000, intrinsic: 21_640, execution: 23_363, refund: 0, used: 45_003 },
};

type Fixtures = { lanes: (string | null)[]; traceAsked: boolean; releaseTrace: () => void };

/** answers the trace and the gas profile of every tx from the fixtures, and records the lane of each gas profile
    request. With holdTrace, the trace waits for releaseTrace; with gasMs, the profile comes that late; with
    refuseFirst, the first gas profile request finds the node budget spent (a soft 503, as the route answers it) */
async function answerFromFixtures(
  browser: Browser,
  opts: { holdTrace?: boolean; gasMs?: number; refuseFirst?: boolean } = {},
): Promise<Fixtures> {
  let release = () => {};
  const held = opts.holdTrace ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  const seen: Fixtures = { lanes: [], traceAsked: false, releaseTrace: () => release() };
  await browser.route(/\/api\/trace\/43114\/0x[0-9a-f]{64}$/, async (route: WebRoute) => {
    seen.traceAsked = true;
    await held;
    await route.fulfill({ json: TRACE });
  });
  await browser.route(/\/api\/trace\/43114\/0x[0-9a-f]{64}\/gas$/, async (route: WebRoute) => {
    seen.lanes.push(route.request.headers['x-trace-lane'] ?? null);
    if (opts.refuseFirst && seen.lanes.length === 1) return route.fulfill({ headers: { 'x-status': '503' }, json: { error: 'busy' } });
    if (opts.gasMs) await new Promise((resolve) => setTimeout(resolve, opts.gasMs));
    await route.fulfill({ json: PROFILE });
  });
  return seen;
}

test('the Gas tab asks for the gas profile when it opens, and shows gas by opcode', async ({ app, screen, browser }) => {
  const seen = await answerFromFixtures(browser, { gasMs: 2_000 });
  await app.open(`/explorer/mainnet/c-chain/tx/${ABOVE_HALF_LIMIT}`);
  const gasTab = screen.getByRole('button', 'Gas');
  await expect(gasTab).toBeVisible(DATA);
  // the trace is in, but no one has clicked and the tx paid no minimum charge: the page has not asked
  expect(seen.lanes).toEqual([]);

  await gasTab.tap();
  await expect(screen.getByText('counting gas by opcode…')).toBeVisible();
  const table = screen.getByRole('table', 'Gas by opcode');
  await expect(table).toBeVisible(DATA);
  await expect(table.getByRole('columnheader')).toHaveCount(3);
  const rows = table.getByRole('row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1).getByRole('cell').first()).toHaveText('SSTORE');
  await expect(table.getByRole('cell', 'CALL')).toHaveCount(0);
  await expect(screen.getByText(/^1,234 opcodes executed/)).toBeVisible();
  // the tap is a gesture: the request asks in the larger lane of the node budget
  expect(seen.lanes).toEqual(['gesture']);
});

test('a key on the page does not ask for the gas profile; the focus on the Gas tab does', async ({ app, screen, browser }) => {
  const seen = await answerFromFixtures(browser, { holdTrace: true });
  await app.open(`/explorer/mainnet/c-chain/tx/${ABOVE_HALF_LIMIT}`);
  await expect.poll(() => seen.traceAsked, DATA).toBe(true);
  // the page counts as used by a person (the harness's own reads run as user gestures), which alone asks for no replay
  await browser.keyboard.press('Escape');
  seen.releaseTrace();
  const gasTab = screen.getByRole('button', 'Gas');
  await expect(gasTab).toBeVisible(DATA);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  expect(seen.lanes).toEqual([]);

  // the focus on the tab asks, so the table is often in when the tab opens
  await gasTab.focus();
  await expect.poll(() => seen.lanes, DATA).toEqual(['gesture']);
  await gasTab.tap();
  await expect(screen.getByRole('table', 'Gas by opcode')).toBeVisible();
  expect(seen.lanes).toHaveLength(1);
});

test('a spent node budget says the node is busy, and the next tap asks again', async ({ app, screen, browser }) => {
  const seen = await answerFromFixtures(browser, { refuseFirst: true });
  await app.open(`/explorer/mainnet/c-chain/tx/${ABOVE_HALF_LIMIT}`);
  await screen.getByRole('button', 'Gas').tap();
  const busy = screen.getByText('the trace node is busy · tap or click anywhere to count gas by opcode');
  await expect(busy).toBeVisible(DATA);
  await expect(screen.getByRole('table', 'Gas by opcode')).toHaveCount(0);

  await busy.tap();
  await expect(screen.getByRole('table', 'Gas by opcode')).toBeVisible(DATA);
  // one ask for the refusal, one for the tap: a tap's pointerdown and touchend ask once
  expect(seen.lanes).toEqual(['gesture', 'gesture']);
});

test('a tx charged half its gas limit shows the gas execution used on load', async ({ app, screen, browser }) => {
  const seen = await answerFromFixtures(browser);
  await app.open(`/explorer/mainnet/c-chain/tx/${AT_HALF_LIMIT}`);
  await expect(screen.getByText('45,003 used by execution')).toBeVisible(DATA);
  // no one has clicked: the page asks in the open lane
  expect(seen.lanes).toEqual([null]);

  await screen.getByRole('button', 'Gas').tap();
  await expect(screen.getByRole('table', 'Gas by opcode')).toBeVisible();
  expect(seen.lanes).toHaveLength(1);
});
