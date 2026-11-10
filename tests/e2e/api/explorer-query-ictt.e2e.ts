import { describe, expect, test, type App } from 'e2e';
import { z } from 'zod';
import { appFetch } from './app-fetch';

// The Explorer query asked a question about the ICTT bridges on the C-Chain. The answer must come from the $ICTT
// shorthand's ictt_held part (lib/explorer-query/ictt.ts), which counts what each token home holds from its own
// events, and never from ERC-20 Transfer logs. Explorer data is live, so the tests check the shape of each answer,
// not its figures.
const QUESTION = 'How many stablecoins are currently held in the ICTT bridges on the C-Chain?';

// A model writes the answer when no kept recipe holds it: allow for the slow writer and its retries.
const ANSWER_MS = 240_000;
// One read of the shorthand over the whole history takes a few seconds.
const READ_MS = 60_000;

const Columns = z.array(z.object({ name: z.string(), type: z.string() }));
const Rows = z.array(z.record(z.string(), z.unknown()));

const Answer = z.object({
  title: z.string().min(1),
  note: z.string(),
  sql: z.string().min(1),
  chart: z.object({ kind: z.string() }).passthrough(),
  route: z.string().optional(),
  result: z.object({ columns: Columns, rows: Rows }),
});

const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stage') }).passthrough(),
  z.object({ type: z.literal('step') }).passthrough(),
  z.object({ type: z.literal('error'), error: z.string(), status: z.number() }),
  z.object({ type: z.literal('answer'), answer: z.unknown() }),
]);

// The model-free path: the SQL as the route wrote it out, and its rows.
const Read = z.object({ sql: z.string().min(1), result: z.object({ columns: Columns, rows: Rows }) });

const ADDRESS = /^0x[0-9a-f]{40}$/;
// a column of figures held, in tokens or in dollars
const AMOUNT = /held|usd|amount|tokens|balance|locked|tvl/i;
// the held stablecoins per token, as the C-Chain chapter's worked example reads them
const HELD = "$ICTT() SELECT lower(concat('0x', hex(token))) AS token_address, count() AS homes, round(sum(held_tokens), 2) AS held_usd FROM ictt_held WHERE stable GROUP BY token ORDER BY held_usd DESC";
const STATUSES = ['delivered', 'call_failed', 'routed', 'execution_failed', 'received', 'undelivered', 'destination_not_indexed'];

// an anonymous caller may ask a few questions and run 120 reads an hour: a limit is no answer, and the test says so
function skipLimited(status: number, body: string): void {
  test.skip(status === 429, `the query route rate-limited this caller (429: ${body.slice(0, 160)}), so nothing ran`);
}

// Runs SQL through the route's model-free path. It writes $ICTT out with the deployed ictt.ts on every call, where a
// kept answer holds the SQL it was written with.
async function read(app: App, chainId: number | 'all', sql: string) {
  const res = await appFetch(app, '/api/explorer/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId, sql }),
    signal: AbortSignal.timeout(READ_MS),
  });
  const body = await res.text();
  skipLimited(res.status, body);
  expect(res.status, `${chainId} ${sql}: ${body.slice(0, 300)}`).toBe(200);
  return expect(JSON.parse(body)).toMatchSchema(Read).result;
}

// API tests run once, on the target without a browser engine (platform "api").
describe('Explorer query: ICTT bridges', { platforms: ['api'], tags: ['api', 'explorer-query'] }, () => {
  test('answers the stablecoins held in the C-Chain ICTT bridges from the bridges\' own events', { timeout: ANSWER_MS }, async ({ app }) => {
    const res = await appFetch(app, '/api/explorer/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chainId: 43114, prompt: QUESTION, history: [] }),
      signal: AbortSignal.timeout(ANSWER_MS - 5_000),
    });
    // the route streams one JSON event per line and ends with the answer
    const body = await res.text();
    skipLimited(res.status, body);
    expect(res.status, body.slice(0, 300)).toBe(200);
    const events = body
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => expect(JSON.parse(line)).toMatchSchema(Event));
    const errors = events.filter((e) => e.type === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    const last = [...events].reverse().find((e) => e.type === 'answer');
    expect(last, `no answer line among ${events.length} events`).toBeDefined();
    const answer = expect(last?.type === 'answer' ? last.answer : null).toMatchSchema(Answer);

    // the C-Chain answers it: no route to another chain, and a figure to draw
    expect(answer.route).toBeUndefined();
    expect(answer.chart.kind).not.toBe('none');
    // the answer reads what the homes hold from the shorthand, written out or collapsed
    expect(answer.sql).toMatch(/\bictt_held\b/);
    expect(answer.sql).toMatch(/\bictt_held AS \(|\$ICTT\(/);

    const { rows, columns } = answer.result;
    expect(rows.length).toBeGreaterThan(0);
    // a token column: its rows hold 0x addresses
    const token = columns.find((c) => rows.every((r) => typeof r[c.name] === 'string' && ADDRESS.test(r[c.name] as string)));
    expect(token, `no column of token addresses in ${columns.map((c) => c.name).join(', ')}`).toBeDefined();
    // an amount column: numbers with a positive total
    const amount = columns.find((c) => AMOUNT.test(c.name) && rows.every((r) => typeof r[c.name] === 'number'));
    expect(amount, `no numeric amount column in ${columns.map((c) => c.name).join(', ')}`).toBeDefined();
    const total = rows.reduce((sum, r) => sum + (amount ? Number(r[amount.name]) : 0), 0);
    expect(total).toBeGreaterThan(0);
  });

  // A kept answer runs the SQL it was written with, so the test above can pass on an old $ICTT. These reads write the
  // shorthand out again, so every part runs on ClickHouse as ictt.ts writes it now. No model runs.
  test('runs every part of the $ICTT shorthand on the live index', { timeout: 10 * READ_MS }, async ({ app }) => {
    const held = await read(app, 43114, HELD);
    expect(held.rows.length).toBeGreaterThan(0);
    for (const r of held.rows) {
      expect(r.token_address, JSON.stringify(r)).toMatch(ADDRESS);
      expect(r.homes, JSON.stringify(r)).toBeGreaterThan(0);
      expect(typeof r.held_usd, JSON.stringify(r)).toBe('number');
    }
    expect(held.rows.reduce((sum, r) => sum + Number(r.held_usd), 0)).toBeGreaterThan(0);

    // a home's balance is its own events added up, and no home holds less than nothing
    for (const chainId of [43114, 'all'] as const) {
      const [r] = (await read(app, chainId, '$ICTT() SELECT count() AS homes, countIf(held < 0) AS negative FROM ictt_held')).rows;
      expect(r.homes, `${chainId}`).toBeGreaterThan(0);
      expect(r.negative, `${chainId}: homes that hold less than nothing`).toBe(0);
    }

    // the registry and the tokens over the whole history, and a month of sends and arrivals on the C-Chain and on an
    // L1 (Numi): each part is a valid query, whatever its count
    const parts: [number, string][] = [
      [43114, '$ICTT() SELECT count() AS n FROM ictt_bridges'],
      [43114, '$ICTT() SELECT count() AS n FROM ictt_tokens'],
      [43114, '$ICTT(now() - INTERVAL 30 DAY) SELECT count() AS n FROM ictt_sends'],
      [43114, '$ICTT(now() - INTERVAL 30 DAY) SELECT count() AS n FROM ictt_arrivals'],
      [8021, '$ICTT(now() - INTERVAL 30 DAY) SELECT count() AS n FROM ictt_sends'],
      [8021, '$ICTT(now() - INTERVAL 30 DAY) SELECT count() AS n FROM ictt_arrivals'],
    ];
    for (const [chainId, sql] of parts) {
      const { rows } = await read(app, chainId, sql);
      expect(rows, `${chainId} ${sql}`).toHaveLength(1);
      expect(typeof rows[0].n, `${chainId} ${sql}`).toBe('number');
      if (sql.startsWith('$ICTT()')) expect(rows[0].n, `${chainId} ${sql}`).toBeGreaterThan(0);
    }

    // every send names its token's home: a home's send itself, a remote's a home on another chain (never its own,
    // as a home cannot register a remote on its own chain); every token row has its decimals
    const [homes] = (
      await read(app, 'all', "$ICTT(now() - INTERVAL 30 DAY) SELECT count() AS n, countIf(role = 'home' AND (home_chain_id != chain_id OR home != bridge)) AS home_not_itself, countIf(role = 'remote' AND home_chain_id = chain_id) AS remote_home_here FROM ictt_sends")
    ).rows;
    expect(homes.n).toBeGreaterThan(0);
    expect(homes.home_not_itself, JSON.stringify(homes)).toBe(0);
    expect(homes.remote_home_here, JSON.stringify(homes)).toBe(0);
    const [decimals] = (await read(app, 'all', '$ICTT() SELECT count() AS n, countIf(decimals IS NULL) AS unknown FROM ictt_tokens')).rows;
    expect(decimals.n).toBeGreaterThan(0);
    expect(decimals.unknown, JSON.stringify(decimals)).toBe(0);

    // a chain page names the other chain from stats-api's indexed chains with ictt_chains
    const [named] = (await read(app, 43114, "$ICTT() SELECT count() AS n, countIf(c.chain != '') AS named FROM ictt_bridges AS b LEFT JOIN ictt_chains AS c ON c.blockchain_id = b.remote_blockchain_id")).rows;
    expect(named.n).toBeGreaterThan(0);
    expect(named.named, JSON.stringify(named)).toBeGreaterThan(0);

    // both sides of a week's transfers, on the network alone, each with a status the chapter names
    const week = await read(app, 'all', '$ICTT(now() - INTERVAL 7 DAY) SELECT status, count() AS n FROM ictt_transfers GROUP BY status');
    expect(week.rows.length).toBeGreaterThan(0);
    for (const r of week.rows) expect(STATUSES, JSON.stringify(r)).toContain(r.status);
  });
});
