import { describe, expect, test, type App } from 'e2e';
import { z } from 'zod';
import { appFetch } from './app-fetch';

// A tester asked the mainnet C-Chain Query "How many transactions are needed to burn $1 worth of AVAX in gas?" and got
// no chart: "The C-Chain data has no AVAX price". Query now prices AVAX at Chainlink's AVAX/USD feed, read from the
// feed's own logs ($AVAXUSD, lib/explorer-query/avax-usd.ts). These tests hold the fix.
// - The reads run no model. They check the feed against Binance's AVAXUSDT on a past day, that every hour has a price,
//   that no hour before the feed began has one, and one past day's fees in USD. Their windows are written as dates,
//   so a test reads the same hours on every later run.
// - The asks run the writer, as api/explorer-query-staking.e2e.ts does. One wording carries a word of its own on each
//   run, so no kept recipe answers it. Each answer is checked against the feed: a fee in USD over a fee in AVAX is a
//   mean of the hours' prices, so it lies between the lowest and the highest hourly price of the window.

const ANSWER_MS = 180_000;
const READ_MS = 60_000;
const C = 43114;
// the source line the page shows under an answer priced in USD
const FEED_LINE = "AVAX is valued in USD at the hourly mean of Chainlink's AVAX/USD price feed on the C-Chain";

const Columns = z.array(z.object({ name: z.string(), type: z.string() }));
const Rows = z.array(z.record(z.string(), z.unknown()));
const Note = z.object({ table: z.string(), label: z.string(), text: z.string() }).passthrough();
const Read = z.object({ sql: z.string().min(1), result: z.object({ columns: Columns, rows: Rows }), sources: z.array(Note).optional() });
const Answer = z.object({
  title: z.string().min(1),
  note: z.string(),
  sql: z.string().min(1),
  chart: z.object({ kind: z.string(), x: z.string().optional(), series: z.array(z.object({ column: z.string() }).passthrough()) }).passthrough(),
  route: z.string().optional(),
  result: z.object({ columns: Columns, rows: Rows }),
  sources: z.array(Note).optional(),
  visual: z.object({ stats: z.array(z.object({ column: z.string() }).passthrough()), panels: z.array(z.object({ series: z.array(z.object({ column: z.string(), axis: z.string().optional() }).passthrough()) }).passthrough()) }).passthrough().nullable().optional(),
});
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stage'), stage: z.string() }).passthrough(),
  z.object({ type: z.literal('step') }).passthrough(),
  z.object({ type: z.literal('error'), error: z.string(), status: z.number() }),
  z.object({ type: z.literal('answer'), answer: z.unknown() }),
]);

// the question as the tester asked it, and two more dollar questions; the last carries a word of its own on each run
const QUESTION = 'How many transactions are needed to burn $1 worth of AVAX in gas?';
const WEEK = 'total fees burned in USD last 7 days';
const fresh = () => `average fee per transaction in USD yesterday (check ${Date.now().toString(36)})`;

// Binance AVAXUSDT on 2025-07-18, the mean of each hour's open and close (data-api.binance.vision klines, read
// 2026-10-23). The feed's hourly mean was within 0.62% of it every hour. That day the Uniswap v3 WAVAX/USDC median
// sat at $20.00 for 15 hours, so a price read from that pool fails this test.
const BINANCE_0718: Record<string, number> = { '00': 24.15, '05': 24.755, '10': 24.385, '15': 23.895, '20': 23.49, '23': 23.415 };
const NEAR_BINANCE = 0.015;
// 2026-10-20 UTC: fees burned 964.3132 AVAX in 301,333 transactions, $9,279.57 at the feed (read 2026-10-23); priced at
// Binance's hourly mean instead, $9,306.61. A past day's fees do not change; the tolerance allows a re-ingest's rounding
const DAY_1020 = { fees_avax: 964.31316532, fees_usd: 9279.570253, txs: 301333 };
const SAME = 1e-6;

// an anonymous caller may ask a few questions and run 120 reads an hour: a limit is no answer, and the test says so
function skipLimited(status: number, body: string): void {
  if (status === 429) console.warn(`SKIPPED: the query route rate-limited this caller (429: ${body.slice(0, 160)})`);
  test.skip(status === 429, `the query route rate-limited this caller (429: ${body.slice(0, 160)}), so nothing ran`);
}

async function post(app: App, body: object, ms: number): Promise<{ status: number; text: string }> {
  const res = await appFetch(app, '/api/explorer/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chainId: C, ...body }), signal: AbortSignal.timeout(ms) });
  const text = await res.text();
  skipLimited(res.status, text);
  return { status: res.status, text };
}

// Runs SQL through the route's model-free path, with the shorthand written out.
async function read(app: App, sql: string) {
  const { status, text } = await post(app, { sql }, READ_MS);
  expect(status, `${sql}: ${text.slice(0, 300)}`).toBe(200);
  return expect(JSON.parse(text)).toMatchSchema(Read);
}

// Asks a question and returns the route's last answer line, with the stages it passed.
async function ask(app: App, prompt: string) {
  const { status, text } = await post(app, { prompt, history: [] }, ANSWER_MS - 5_000);
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

// the answer's SQL holds $AVAXUSD written out (lib/explorer-query/avax-usd.ts): its series starts at this hour
const FEED_FROM = 'WHERE hour >= toStartOfHour(toDateTime(';

/** the window's start the answer gave $AVAXUSD: the expression its series starts from */
function feedStart(sql: string): string {
  const at = sql.indexOf(FEED_FROM);
  expect(at, `the answer does not read the feed: ${sql.slice(0, 300)}`).toBeGreaterThan(0);
  const from = at + FEED_FROM.length;
  for (let i = from, depth = 1; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')' && --depth === 0) return sql.slice(from, i).trim();
  }
  throw new Error(`the feed's start is not closed in ${sql.slice(0, 300)}`);
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

/** the checks every dollar answer passes: a chart priced at the feed, with the page's line that says so, and USD
    figures that are AVAX figures at the feed's prices */
async function checkPriced(app: App, answer: z.infer<typeof Answer>): Promise<void> {
  expect(answer.route).toBeUndefined();
  expect(answer.chart.kind, answer.note).not.toBe('none');
  expect(answer.sources?.map((s) => s.text).join(' ')).toContain(FEED_LINE);
  const { rows, columns } = answer.result;
  expect(rows.length).toBeGreaterThan(0);
  const names = columns.map((c) => c.name);
  const usd = names.filter((n) => /usd/i.test(n) && rows.some((r) => typeof num(r[n]) === 'number'));
  expect(usd, `no USD column in ${names.join(', ')}`).not.toEqual([]);
  for (const n of usd) for (const r of rows) if (num(r[n]) !== null) expect(Number.isFinite(num(r[n])) && num(r[n])! >= 0, `${n} in ${JSON.stringify(r)}`).toBe(true);

  // a fee in USD over the same fee in AVAX is a mean of the window's hourly prices
  const feeUsd = names.find((n) => /fee/i.test(n) && /usd$/i.test(n) && !/per|avg|average|mean/i.test(n));
  const feeAvax = names.find((n) => /fee/i.test(n) && /avax$/i.test(n) && !/per|avg|average|mean/i.test(n));
  const start = feedStart(answer.sql);
  const { result } = await read(app, `$AVAXUSD(${start}) SELECT min(price) AS lo, max(price) AS hi, count() AS hours FROM avax_usd`);
  const [{ lo, hi, hours }] = result.rows as { lo: number; hi: number; hours: number }[];
  expect(Number(hours)).toBeGreaterThan(0);
  // every row shows the AVAX price it was valued at, a mean of the window's hourly prices, and the layout shows it
  expect(names, `no AVAX price in ${names.join(', ')}`).toContain('avax_price_usd');
  for (const r of rows) {
    const p = num(r.avax_price_usd);
    if (p === null) continue;
    expect(p, `avax_price_usd in ${JSON.stringify(r)}, hourly prices ${lo} to ${hi}`).toBeGreaterThanOrEqual(lo - 1e-4);
    expect(p, `avax_price_usd in ${JSON.stringify(r)}, hourly prices ${lo} to ${hi}`).toBeLessThanOrEqual(hi + 1e-4);
  }
  if (answer.visual) expect(answer.visual.stats.map((t) => t.column)).toContain('avax_price_usd');
  if (feeUsd && feeAvax) {
    for (const r of rows) {
      const [u, a] = [num(r[feeUsd]), num(r[feeAvax])];
      if (!u || !a) continue;
      // rounding to cents moves a small figure by up to half a cent
      expect(u / a, `${feeUsd} / ${feeAvax} in ${JSON.stringify(r)}, hourly prices ${lo} to ${hi}`).toBeGreaterThanOrEqual(lo * 0.995 - 0.005 / a);
      expect(u / a, `${feeUsd} / ${feeAvax} in ${JSON.stringify(r)}, hourly prices ${lo} to ${hi}`).toBeLessThanOrEqual(hi * 1.005 + 0.005 / a);
    }
  }
}

// API tests run once, on the target without a browser engine (platform "api").
describe('Explorer query: fees and gas in USD at the Chainlink AVAX/USD feed', { platforms: ['api'], tags: ['api', 'explorer-query'] }, () => {
  test("reads the feed's hourly price as Binance had AVAX on a past day, every hour of it", { timeout: 2 * READ_MS }, async ({ app }) => {
    const { result, sources } = await read(app, "$AVAXUSD(toDateTime('2025-07-18 00:00:00'), toDateTime('2025-07-19 00:00:00')) SELECT formatDateTime(hour, '%H') AS h, price FROM avax_usd ORDER BY hour");
    expect(result.rows.map((r) => r.h)).toEqual(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')));
    for (const [h, price] of Object.entries(BINANCE_0718)) {
      const p = Number(result.rows.find((r) => r.h === h)?.price);
      expect(Math.abs(p / price - 1), `${h}:00 feed ${p}, Binance ${price}`).toBeLessThan(NEAR_BINANCE);
    }
    expect(sources?.map((s) => s.text).join(' ')).toContain(FEED_LINE);
  });

  test('has a price for every hour since the feed began, across its change of aggregator, and none before', { timeout: 2 * READ_MS }, async ({ app }) => {
    // 2024-09 to 2024-10 crosses the hour the second aggregator took over, 2024-09-30 09:00
    const across = await read(app, "$AVAXUSD(toDateTime('2024-09-01 00:00:00'), toDateTime('2024-11-01 00:00:00')) SELECT count() AS hours, countIf(price <= 0) AS empty, min(price) AS lo, max(price) AS hi FROM avax_usd");
    expect(across.result.rows[0]).toMatchObject({ hours: 61 * 24, empty: 0 });
    expect(Number(across.result.rows[0].lo)).toBeGreaterThan(15);
    expect(Number(across.result.rows[0].hi)).toBeLessThan(50);
    // the feed's first answer is at 2021-07-14 20:47:32
    const first = await read(app, "$AVAXUSD(toDateTime('2021-07-13 00:00:00'), toDateTime('2021-07-16 00:00:00')) SELECT min(hour) AS first, count() AS hours FROM avax_usd");
    expect(first.result.rows[0]).toMatchObject({ hours: 4 + 24 });
    expect(String(first.result.rows[0].first)).toMatch(/^2021-07-14[ T]20:00:00/);
  });

  test("values a past day's fees at the feed's hourly prices", { timeout: 2 * READ_MS }, async ({ app }) => {
    const day = "toDateTime('2026-10-20 00:00:00'), toDateTime('2026-10-21 00:00:00')";
    const { result } = await read(app, `$AVAXUSD(${day}), f AS (SELECT toStartOfHour(block_time) AS h, sum(toFloat64(gas_used) * gas_price) / 1e18 AS fee, count() AS n FROM raw_txs WHERE chain_id = ${C} AND block_time >= toDateTime('2026-10-20 00:00:00') AND block_time < toDateTime('2026-10-21 00:00:00') GROUP BY h) SELECT sum(f.fee) AS fees_avax, sum(f.fee * nullIf(p.price, 0)) AS fees_usd, sum(f.n) AS txs FROM f LEFT JOIN avax_usd AS p ON f.h = p.hour`);
    const [r] = result.rows;
    expect(Number(r.txs)).toBe(DAY_1020.txs);
    expect(Math.abs(Number(r.fees_avax) / DAY_1020.fees_avax - 1), String(r.fees_avax)).toBeLessThan(SAME);
    expect(Math.abs(Number(r.fees_usd) / DAY_1020.fees_usd - 1), String(r.fees_usd)).toBeLessThan(SAME);
  });

  test('answers the question about the transactions it takes to burn $1', { timeout: ANSWER_MS }, async ({ app }) => {
    const { answer } = await ask(app, QUESTION);
    await checkPriced(app, answer);
    // a count per dollar is the transactions over the fees in USD, row by row
    const names = answer.result.columns.map((c) => c.name);
    const per = names.find((n) => /per_(usd|dollar)|_per_1|txs_per/i.test(n));
    expect(per, `no count per dollar in ${names.join(', ')}`).toBeDefined();
    const txs = names.find((n) => /^(txs|transactions|tx_count)$/i.test(n));
    const usd = names.find((n) => /fee/i.test(n) && /usd$/i.test(n));
    if (txs && usd) {
      for (const r of answer.result.rows) {
        const [t, u, p] = [num(r[txs]), num(r[usd]), num(r[per!])];
        if (!t || !u || p === null) continue;
        expect(Math.abs(p / (t / u) - 1), JSON.stringify(r)).toBeLessThan(0.01);
      }
    }
  });

  test('answers the fees burned in USD over the last 7 days', { timeout: ANSWER_MS }, async ({ app }) => {
    const { answer } = await ask(app, WEEK);
    await checkPriced(app, answer);
  });

  test('writes a new dollar question fresh, and prices its fee per transaction at the feed', { timeout: ANSWER_MS }, async ({ app }) => {
    const { answer, stages } = await ask(app, fresh());
    expect(stages).toContain('writing');
    await checkPriced(app, answer);
  });
});
