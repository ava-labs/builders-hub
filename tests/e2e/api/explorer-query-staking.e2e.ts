import { describe, expect, test, type App } from 'e2e';
import { z } from 'zod';
import { appFetch } from './app-fetch';

// A tester asked the mainnet P-Chain Query "has the % of circulating avax staked increased since the helicon upgrade"
// and got no chart: the writer had no upgrade date and no supply history. Reworded, the answer had a band of days with
// no snapshots (2026-08-13 to 08-26). These tests hold the fix.
// - The reads run no model. They check the upgrade times, the stake at past snapshots against the P-Chain's own
//   figures, the filled days and their edges, the days that stay missing, and the supply per day. Their windows are
//   written as dates, so a test reads the same days on every later run.
// - The asks run the writer, as api/explorer-query-ictt.e2e.ts does. A kept recipe answers a question asked before
//   (lib/explorer-query/cache.ts), so one wording carries a word of its own on each run and is written fresh. Each
//   answer is checked against the reads: its share is its stake over its supply, row by row, and its share on the
//   day before Helicon is the read's.

const ANSWER_MS = 180_000;
const READ_MS = 60_000;
const PCHAIN = 1;

const Columns = z.array(z.object({ name: z.string(), type: z.string() }));
const Rows = z.array(z.record(z.string(), z.unknown()));
const Note = z.object({ table: z.string(), label: z.string(), text: z.string() }).passthrough();
const Read = z.object({ sql: z.string().min(1), result: z.object({ columns: Columns, rows: Rows }), sources: z.array(Note).optional() });
const Visual = z.object({ panels: z.array(z.object({ kind: z.string(), markers: z.array(z.object({ x: z.union([z.string(), z.number()]), label: z.string() })) }).passthrough()) }).passthrough();
const Answer = z.object({
  title: z.string().min(1),
  note: z.string(),
  sql: z.string().min(1),
  key: z.string().optional(),
  chart: z.object({ kind: z.string(), x: z.string().optional(), series: z.array(z.object({ column: z.string() }).passthrough()) }).passthrough(),
  route: z.string().optional(),
  result: z.object({ columns: Columns, rows: Rows }),
  sources: z.array(Note).optional(),
  visual: Visual.nullable().optional(),
  draftVisual: z.boolean().optional(),
});
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stage'), stage: z.string() }).passthrough(),
  z.object({ type: z.literal('step') }).passthrough(),
  z.object({ type: z.literal('error'), error: z.string(), status: z.number() }),
  z.object({ type: z.literal('answer'), answer: z.unknown() }),
]);

// the question as the tester asked it
const QUESTION = 'has the % of circulating avax staked increased since the helicon upgrade';
// a wording that means the same, with a word of its own on each run, so no kept recipe answers it
const fresh = () => `is a larger share of the circulating AVAX supply staked now than before Helicon? (check ${Date.now().toString(36)})`;

const PRIMARY = "unhex(repeat('00', 32))";
const FROM = "toDate('2026-09-22') - INTERVAL 30 DAY";
// the staked share of the circulating supply per day from 30 days before Helicon, as the P-Chain prompt's worked
// example writes it (lib/explorer-query/prompt.ts)
const SHARE = `WITH snaps AS (SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = 1 AND subnet_id = ${PRIMARY} AND snapshot_time >= ${FROM} AND snapshot_time <= now() - INTERVAL 15 MINUTE GROUP BY snapshot_time UNION ALL SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1 AND snapshot_time >= ${FROM}), daily AS (SELECT toDate(snapshot_time) AS t, toNullable(argMax(staked, snapshot_time)) AS staked_avax FROM snaps GROUP BY t) SELECT s.t AS t, d.staked_avax AS staked_avax, s.circulating_supply_avax AS circulating_avax, round(100 * d.staked_avax / s.circulating_supply_avax, 2) AS staked_pct FROM p_avax_supply_daily AS s LEFT JOIN daily AS d ON d.t = s.t WHERE s.chain_id = 1 AND s.t >= ${FROM} ORDER BY t`;

// The stake at past snapshots, in nAVAX, as the P-Chain itself counts it: platform.getValidatorsAt at the last block
// before the snapshot (Primary Network, a mainnet node, read 2026-10-16). The chart's peak (Aug 28), the day after its
// largest fall (Sep 14) and its low (Oct 8). Past stake does not change; the tolerance allows for nothing but a
// re-ingest's rounding, so a wrong snapshot fails.
const PAST: { at: string; height: number; validators: number; nanoavax: number }[] = [
  { at: '2026-08-28 23:59:47.068', height: 25429276, validators: 621, nanoavax: 221085346162845957 },
  { at: '2026-09-14 23:49:19.839', height: 25509074, validators: 585, nanoavax: 189124854211827129 },
  { at: '2026-10-08 23:53:55.620', height: 25640130, validators: 589, nanoavax: 183140496494819112 },
];
const TOLERANCE = 1e-6;

// the days the snapshot tables miss, each filled from getValidatorsAt at the day's last block
const FILLED = Array.from({ length: 13 }, (_, i) => new Date(Date.UTC(2026, 7, 13 + i)).toISOString().slice(0, 10));
// the edges of the gap, in AVAX: 08-13 is the fill at 23:57:21 (getValidatorsAt at height 25359462), not that day's
// last snapshot at 11:20:28 (214225390.68); 08-26 is the snapshot at 23:57:46, the first whole day after the gap
const EDGES: Record<string, number> = { '2026-08-13': 213408752.028754418, '2026-08-26': 217126299.397360214 };
const GAP_NOTE = (what: string) => `No ${what} exist from 2026-08-13 11:20 to 2026-08-26 12:03 UTC. The indexer stopped while the stats database moved hosts, so those days are empty.`;

const DAY = 86_400_000;
const dayOf = (v: unknown) => String(v).slice(0, 10);
const near = (a: number, b: number) => Math.abs(a / b - 1) < TOLERANCE;

// an anonymous caller may ask a few questions and run 120 reads an hour: a limit is no answer, and the test says so
function skipLimited(status: number, body: string): void {
  if (status === 429) console.warn(`SKIPPED: the query route rate-limited this caller (429: ${body.slice(0, 160)})`);
  test.skip(status === 429, `the query route rate-limited this caller (429: ${body.slice(0, 160)}), so nothing ran`);
}

async function post(app: App, chainId: number, body: object, ms: number): Promise<{ status: number; text: string }> {
  const res = await appFetch(app, '/api/explorer/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chainId, ...body }), signal: AbortSignal.timeout(ms) });
  const text = await res.text();
  skipLimited(res.status, text);
  return { status: res.status, text };
}

// Runs SQL through the route's model-free path, with the server's tables written in front of it.
async function read(app: App, sql: string, chainId = PCHAIN) {
  const { status, text } = await post(app, chainId, { sql }, READ_MS);
  expect(status, `${sql}: ${text.slice(0, 300)}`).toBe(200);
  return expect(JSON.parse(text)).toMatchSchema(Read);
}

// The supply tables read the Data API when an instance has no copy yet, which can take longer than the read's
// timeout on a cold instance: read once to warm it, and allow one more try.
async function warmSupply(app: App): Promise<void> {
  for (let i = 0; i < 2; i++) {
    const { status } = await post(app, PCHAIN, { sql: 'SELECT total_supply_avax FROM p_avax_supply WHERE chain_id = 1' }, READ_MS);
    if (status === 200) return;
  }
}

// Asks a question and returns the route's last answer line, with the stages it passed.
async function ask(app: App, chainId: number, prompt: string) {
  const { status, text } = await post(app, chainId, { prompt, history: [] }, ANSWER_MS - 5_000);
  expect(status, text.slice(0, 300)).toBe(200);
  const events = text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => expect(JSON.parse(line)).toMatchSchema(Event));
  const errors = events.filter((e) => e.type === 'error');
  expect(errors, JSON.stringify(errors)).toEqual([]);
  const last = [...events].reverse().find((e) => e.type === 'answer');
  expect(last, `no answer line among ${events.length} events`).toBeDefined();
  const stages = events.flatMap((e) => (e.type === 'stage' ? [e.stage] : []));
  console.log(`${prompt}: stages ${stages.join(', ')}`);
  return { answer: expect(last?.type === 'answer' ? last.answer : null).toMatchSchema(Answer), stages };
}

/** a share column's values as percent: a writer may divide without the 100 */
function percents(rows: Record<string, unknown>[], column: string): (number | null)[] {
  const values = rows.map((r) => (r[column] === null || r[column] === undefined ? null : Number(r[column])));
  const scale = values.every((v) => v === null || v <= 1) ? 100 : 1;
  return values.map((v) => (v === null ? null : v * scale));
}

/** the checks every answer to the question passes: the days around Helicon, the base it divides by, and its figures */
async function checkShare(app: App, answer: z.infer<typeof Answer>): Promise<void> {
  expect(answer.route).toBeUndefined();
  expect(['line', 'area', 'bar']).toContain(answer.chart.kind);
  // the base is the supply of each day, never the P-Chain's own supply or one current figure
  expect(answer.sql).toMatch(/\bp_avax_supply_daily\b/);
  expect(answer.sql).not.toMatch(/\bp_exec_state_history\b/);
  expect(answer.sql).toMatch(/\bp_validator_snapshots\b/);

  const x = answer.chart.x ?? 't';
  const { rows, columns } = answer.result;
  const days = rows.map((r) => dayOf(r[x]));
  // at least two weeks, from days before the activation to days after it, in one series
  expect(rows.length).toBeGreaterThanOrEqual(14);
  expect(days.filter((d) => d < '2026-09-22').length, days.join(' ')).toBeGreaterThanOrEqual(7);
  expect(days.filter((d) => d > '2026-09-22').length, days.join(' ')).toBeGreaterThanOrEqual(7);

  const numeric = (re: RegExp) => columns.find((c) => re.test(c.name) && rows.some((r) => typeof r[c.name] === 'number'));
  const share = numeric(/pct|percent|share|ratio/i);
  const stake = numeric(/stak/i);
  const supply = numeric(/circulating|supply/i);
  expect(share, `no share column in ${columns.map((c) => c.name).join(', ')}`).toBeDefined();
  expect(stake, `no stake column in ${columns.map((c) => c.name).join(', ')}`).toBeDefined();
  expect(supply, `no supply column in ${columns.map((c) => c.name).join(', ')}`).toBeDefined();
  // the share is the stake over the supply, row by row
  const values = percents(rows, share!.name);
  rows.forEach((r, i) => {
    if (values[i] === null || r[stake!.name] === null) return;
    expect(Math.abs(Number(values[i]) - (100 * Number(r[stake!.name])) / Number(r[supply!.name])), JSON.stringify(r)).toBeLessThan(0.01);
  });
  // the page states how the supply per day is rebuilt
  expect(answer.sources?.map((s) => s.text).join(' ')).toContain('The supply on each day is rebuilt');

  // the day before Helicon holds about the share the model-free read of the worked example gives: a right answer may
  // take the day's mean snapshot, not its last, which moves it by a few tenths of a point at most
  const truth = (await read(app, SHARE)).result.rows.find((r) => dayOf(r.t) === '2026-09-21');
  const before = values[days.indexOf('2026-09-21')];
  expect(before, 'no share on 2026-09-21').not.toBeNull();
  expect(Math.abs(Number(before) - Number(truth?.staked_pct))).toBeLessThan(0.5);
}

// API tests run once, on the target without a browser engine (platform "api").
describe('Explorer query: the staked share of the supply around an upgrade', { platforms: ['api'], tags: ['api', 'explorer-query'] }, () => {
  test("reads each network upgrade's mainnet time as AvalancheGo's config sets it, on the P-Chain and the C-Chain", { timeout: 2 * READ_MS }, async ({ app }) => {
    const sql = (id: number) => `SELECT upgrade, toString(activated_at) AS at, acps FROM network_upgrades WHERE chain_id = ${id} ORDER BY activated_at`;
    const { result, sources } = await read(app, sql(1));
    const at = Object.fromEntries(result.rows.map((r) => [String(r.upgrade), String(r.at)]));
    // avalanchego upgrade/upgrade.go, the Mainnet Config
    expect(at).toMatchObject({ Durango: '2024-03-06 16:00:00', Etna: '2024-12-16 17:00:00', Fortuna: '2025-04-08 15:00:00', Granite: '2025-11-19 16:00:00', Helicon: '2026-09-22 15:00:00' });
    expect(result.rows.find((r) => r.upgrade === 'Helicon')?.acps).toBe('ACP-194, ACP-236, ACP-267, ACP-273, ACP-283, ACP-285');
    // an upgrade with no mainnet time has no row
    expect(Object.keys(at)).not.toContain('Igloo');
    expect(sources?.map((s) => s.text)).toContain("Upgrade times come from AvalancheGo's mainnet config (upgrade/upgrade.go).");
    // the C-Chain's page reads the same rows
    expect((await read(app, sql(43114), 43114)).result.rows).toEqual(result.rows);
  });

  test('holds the stake the P-Chain itself recorded at past snapshots', { timeout: 3 * READ_MS }, async ({ app }) => {
    for (const p of PAST) {
      const { result } = await read(app, `SELECT sum(weight + delegator_weight) AS nanoavax, count() AS validators FROM p_validator_snapshots WHERE chain_id = 1 AND subnet_id = ${PRIMARY} AND snapshot_time = toDateTime64('${p.at}', 3, 'UTC')`);
      expect(result.rows, p.at).toHaveLength(1);
      const [r] = result.rows;
      expect(r.validators, `${p.at}, getValidatorsAt(${p.height})`).toBe(p.validators);
      expect(near(Number(r.nanoavax), p.nanoavax), `${p.at}: ${String(r.nanoavax)}, getValidatorsAt(${p.height}) ${p.nanoavax}`).toBe(true);
    }
  });

  test('fills the days the snapshots miss from the P-Chain, and says which days stay missing', { timeout: 6 * READ_MS }, async ({ app }) => {
    const fill = await read(app, 'SELECT toString(snapshot_time) AS at, block_height, validators, staked_avax FROM p_stake_fill WHERE chain_id = 1 ORDER BY snapshot_time');
    expect(fill.result.rows.map((r) => dayOf(r.at))).toEqual(FILLED);
    expect(fill.sources?.[0].text).toContain("comes from the P-Chain's validator sets (platform.getValidatorsAt at each day's last block)");

    // the daily stake around the gap, as the worked example reads it: every day has a figure, each edge day is the one
    // named above, and each filled day lies between the edges' range widened by 5% (the stake moves under 2% a day there)
    const window = "snapshot_time >= toDateTime('2026-08-10 00:00:00', 'UTC') AND snapshot_time < toDateTime('2026-08-31 00:00:00', 'UTC')";
    const snaps = `SELECT snapshot_time, sum(weight + delegator_weight) / 1e9 AS staked FROM p_validator_snapshots WHERE chain_id = 1 AND subnet_id = ${PRIMARY} AND ${window} GROUP BY snapshot_time`;
    const daily = (from: string) => `WITH snaps AS (${from}) SELECT toDate(snapshot_time) AS day, toNullable(argMax(staked, snapshot_time)) AS staked_avax FROM snaps GROUP BY day ORDER BY day WITH FILL FROM toDate('2026-08-10') TO toDate('2026-08-31') STEP INTERVAL 1 DAY`;
    const filled = await read(app, daily(`${snaps} UNION ALL SELECT snapshot_time, staked_avax FROM p_stake_fill WHERE chain_id = 1 AND ${window}`));
    const stake = Object.fromEntries(filled.result.rows.map((r) => [dayOf(r.day), r.staked_avax]));
    expect(Object.keys(stake)).toHaveLength(21);
    expect(Object.entries(stake).filter(([, v]) => v === null)).toEqual([]);
    for (const [day, avax] of Object.entries(EDGES)) expect(near(Number(stake[day]), avax), `${day}: ${String(stake[day])}`).toBe(true);
    const lo = Math.min(...Object.values(EDGES)) * 0.95;
    const hi = Math.max(...Object.values(EDGES)) * 1.05;
    for (const day of FILLED) expect(Number(stake[day]), day).toBeGreaterThan(lo);
    for (const day of FILLED) expect(Number(stake[day]), day).toBeLessThan(hi);
    // the filled days are not named missing
    expect((filled.sources ?? []).map((s) => s.text)).not.toContain(GAP_NOTE('validator snapshots'));

    // without the fill, those 12 whole days are empty, and the page is told why
    const bare = await read(app, daily(snaps));
    expect(bare.result.rows.filter((r) => r.staked_avax === null).map((r) => dayOf(r.day))).toEqual(FILLED.slice(1));
    expect(bare.sources?.map((s) => s.text)).toContain(GAP_NOTE('validator snapshots'));

    // the delegator snapshots have no fill: a read over the gap is told so, and a read after it is not
    const delegators = (from: string, to: string) => `SELECT toDate(snapshot_time) AS day, uniqExact(delegator_tx_id) AS delegations FROM p_delegator_snapshots WHERE chain_id = 1 AND snapshot_time >= toDateTime('${from} 00:00:00', 'UTC') AND snapshot_time < toDateTime('${to} 00:00:00', 'UTC') GROUP BY day ORDER BY day`;
    expect((await read(app, delegators('2026-08-10', '2026-08-31'))).sources?.map((s) => s.text)).toContain(GAP_NOTE('delegator snapshots'));
    const after = (await read(app, delegators('2026-09-01', '2026-09-08'))).sources ?? [];
    expect(after.filter((s) => s.text.startsWith('No delegator snapshots exist'))).toEqual([]);
  });

  test('rebuilds the supply per day: a row a day that rises each whole day, and the Data API total today', { timeout: 6 * READ_MS }, async ({ app }) => {
    await warmSupply(app);
    const first = '2026-09-01';
    const { result, sources } = await read(app, `SELECT toString(t) AS day, total_supply_avax, circulating_supply_avax FROM p_avax_supply_daily WHERE chain_id = 1 AND t >= toDate('${first}') ORDER BY t`);
    const rows = result.rows;
    // one row for each day from the first to today. Today is the database's (its now()), which is the runner's day
    // or, in the minute around midnight UTC, the day next to it
    const today = dayOf(rows.at(-1)?.day);
    expect(Math.abs(Date.parse(today) - Date.parse(new Date().toISOString().slice(0, 10)))).toBeLessThanOrEqual(DAY);
    expect(rows.map((r) => dayOf(r.day))).toEqual(Array.from({ length: (Date.parse(today) - Date.parse(first)) / DAY + 1 }, (_, i) => new Date(Date.parse(first) + i * DAY).toISOString().slice(0, 10)));
    // rewards are paid every day: each whole day's supply is above the day's before (a stalled reward index stays flat)
    const whole = rows.filter((r) => dayOf(r.day) < today);
    for (let i = 1; i < whole.length; i++) expect(Number(whole[i].total_supply_avax), String(whole[i].day)).toBeGreaterThan(Number(whole[i - 1].total_supply_avax));
    for (const r of rows) {
      expect(r.circulating_supply_avax, String(r.day)).toBe(r.total_supply_avax);
      // 360M AVAX were unlocked at genesis, and the supply never passes the 720M cap
      expect(Number(r.total_supply_avax)).toBeGreaterThan(360e6);
      expect(Number(r.total_supply_avax)).toBeLessThan(720e6);
    }
    expect(sources?.[0].text).toMatch(/^The supply on each day is rebuilt: the Avalanche Data API's total supply/);
    // the last day subtracts no rewards, so it is the Data API's own figure: this holds the base to that source, and the
    // read and the table to one copy of it
    const now = await read(app, 'SELECT total_supply_avax FROM p_avax_supply WHERE chain_id = 1');
    expect(Math.abs(Number(rows.at(-1)?.total_supply_avax) / Number(now.result.rows[0].total_supply_avax) - 1)).toBeLessThan(0.001);
  });

  test('answers the question as the tester asked it with the staked share before and after Helicon, and marks Helicon', { timeout: ANSWER_MS + 3 * READ_MS }, async ({ app }) => {
    await warmSupply(app);
    const { answer } = await ask(app, PCHAIN, QUESTION);
    await checkShare(app, answer);
    // the answer's layout marks Helicon on the day it activated: a kept answer's layout is marked again on its fresh
    // rows, and a new answer's draft is marked before it is sent (lib/explorer-query/answer.ts), so no layout call is
    // needed to see it
    expect(answer.visual, 'an answer with no layout').toBeTruthy();
    const timed = answer.visual!.panels.filter((p) => ['line', 'area', 'bar'].includes(p.kind));
    expect(timed.length).toBeGreaterThan(0);
    // each time panel marks it once, on that day, whether its days are dates or times
    for (const p of timed) expect(p.markers.filter((m) => /^Helicon\b/.test(m.label)).map((m) => dayOf(m.x)), JSON.stringify(p.markers)).toEqual(['2026-09-22']);
  });

  test('answers another wording the same way, written fresh by the writer', { timeout: ANSWER_MS + 3 * READ_MS }, async ({ app }) => {
    await warmSupply(app);
    const { answer, stages } = await ask(app, PCHAIN, fresh());
    // no kept recipe answered it: the writer planned this answer now
    expect(stages).toContain('writing');
    expect(stages).not.toContain('cached');
    await checkShare(app, answer);
  });

  test('answers a C-Chain question about the time before and after Helicon over days on each side of it', { timeout: ANSWER_MS }, async ({ app }) => {
    const { answer, stages } = await ask(app, 43114, `daily transactions before and after the Helicon upgrade (check ${Date.now().toString(36)})`);
    expect(stages).not.toContain('cached');
    expect(answer.route).toBeUndefined();
    expect(['line', 'area', 'bar']).toContain(answer.chart.kind);
    // the C-Chain's own transactions, and an answer that names the upgrade
    expect(answer.sql).toMatch(/\braw_(?:txs|blocks)\b/);
    expect(`${answer.title} ${answer.note}`).toMatch(/Helicon/);
    const x = answer.chart.x ?? 't';
    const days = answer.result.rows.map((r) => dayOf(r[x]));
    expect(days.filter((d) => d < '2026-09-22').length, days.join(' ')).toBeGreaterThanOrEqual(7);
    expect(days.filter((d) => d > '2026-09-22').length, days.join(' ')).toBeGreaterThanOrEqual(7);
  });
});
