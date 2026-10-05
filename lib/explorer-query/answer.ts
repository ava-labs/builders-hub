import "server-only";
import { anthropic, type ModelCall } from "./meter";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { MAX_ROWS, guardSql, literalWindow, negativeFigure } from "./guard";
import { protocolScope, unitName } from "./checks";
import { familyQuestion } from "./families";
import { mevQuestion } from "./mev";
import { lendingQuestion, pricedNote, zeroUsd } from "./lending";
import { collapseMacros } from "./macros";
import { runQuery, schemaCard, coverage, coverageText, anchored, type QueryResult } from "./clickhouse";
import { chartSpecSchema, drillSchema, type QueryAnswer, type StepTiming, type Turn } from "./types";
import { fillDrill, nameRows } from "./enrich";
import { dexQuestion, pchainPrompt, systemPrompt, userTurn } from "./prompt";
import { isCChain, isFuji, targetOf } from "./target";
import { getRecipe, putRecipe, recipeKey, type Recipe } from "./cache";
import { fixedRecipe, fixedRoute } from "./fixed";
import { versionLines } from "./sources";
import { codeWords, plainLabel, sqlNames, withoutCode } from "./visual";
import { basicVisual } from "./draft";
import { labelError } from "./stat-label";
import { cutOf, newestSql, totalsOf } from "./cut";
import { msOf } from "./edges";
import { asOfWords, scopeError, snapshotSql, sqlWindow, windowSpan, withWindow } from "./scope";
import { contradictions, withoutContradictions } from "./claims";
import { absurdFigure } from "./magnitude";
import { PCHAIN_EXAMPLES, examplesFor } from "./examples";

/* A question in, an answer out. A cached recipe answers at once: its SQL
   runs again for fresh rows and no model is asked. Otherwise a model
   writes the SQL: Sonnet 5.5 at low effort for a plain question about
   one thing, at medium effort for comparisons, follow-ups, and anything
   the first could not finish. Every step reports as it ends, so the
   page can show the work. */

/** the writers, each with its own output cap. The SDK sends a model's cap only for the models it knows, and gave
    claude-sonnet-5 4096 tokens, which a written-out query with its drill can pass: a cut call is lost. 16k is five
    times the longest call the traces saw (2,835 tokens, D20's final with its WITH written out) */
interface WriterSpec {
  id: string;
  label: string;
  steps: number;
  maxOutputTokens: number;
  /** sent only when set: Sonnet 5.5 recalibrated its levels, so a writer on it names one */
  effort?: "low" | "medium" | "high";
}
type Writer = "fast" | "full";
/* On 35 blind-graded questions (r22, 2026-09-28) these two were right on 31 against 27 for Haiku 4.5 and
   Sonnet 5, at a 6.9 s median answer against 13.5 s. Their one wrong answer skipped its test (D07) */
export const WRITERS: Record<Writer, WriterSpec> = {
  fast: { id: "claude-sonnet-5-5", label: "Sonnet 5.5 low", steps: 8, maxOutputTokens: 16_000, effort: "low" },
  full: { id: "claude-sonnet-5-5", label: "Sonnet 5.5 medium", steps: 14, maxOutputTokens: 16_000, effort: "medium" },
};
/** Fuji keeps the writers it had */
export const FUJI_WRITERS: Record<Writer, WriterSpec> = {
  fast: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", steps: 8, maxOutputTokens: 16_000 },
  full: { id: "claude-sonnet-5", label: "Sonnet 5", steps: 14, maxOutputTokens: 16_000 },
};

/* Models that refuse a forced tool call (tool_choice any or tool is a 400 on Sonnet 5.5). They run on auto: the
   question turn tells them every reply is a tool call, and a reply in prose goes back once */
const FREE_TOOL_MODELS = new Set(["claude-sonnet-5-5"]);
export const TOOLS_ONLY = "Reply only with tool calls: run_sql to test a query, render_chart to hand back the answer. Your last call is render_chart.";
export const PROSE_BACK = "That reply was prose. Call a tool: run_sql to test a query, or render_chart with the final query.";

/** the tests (run_sql) each writer may run before it must answer from what they showed. Of the 147 writer runs
    that answered in the audits, 141 tested 4 times or fewer; the runs past that made the slow tail (10 tests and
    151 s on one DEX question, 14 tests and no answer on a lending one). Fuji keeps its loop as it was */
export const TESTS = 4;

/** the most records one drill lists */
export const DRILL_ROWS = 100;

/** what the page hears while the answer is made */
export type QueryEvent =
  | { type: "stage"; stage: "cached" | "writing" | "escalated"; writer?: string }
  | ({ type: "step" } & StepTiming)
  | { type: "answer"; answer: QueryAnswer }
  | { type: "error"; error: string; status: number };

const HARD = /\b(compar\w*|vs\.?|versus|previous|prior|before|than|overlay|against|ratio|correlat\w*|relative|join|both|growth|change[sd]?|(?:day|week|month|year) over (?:day|week|month|year)|trend|why|each)\b/i;

/** a plain question about one thing goes to the fast writer */
export function pickWriter(prompt: string, history: Turn[]): Writer {
  if (history.length > 0 || prompt.length > 140 || HARD.test(prompt)) return "full";
  return "fast";
}

/** a drill template filled from one row, guarded, capped */
export function drillSql(template: string, row: Record<string, unknown>, chainId: number): { ok: true; sql: string } | { ok: false; error: string } {
  const filled = fillDrill(template, row);
  if (!filled.ok) return filled;
  const g = guardSql(filled.sql, chainId);
  if (!g.ok) return g;
  const sql = g.sql.replace(/\bLIMIT\s+(\d+)\s*$/i, (_m, n: string) => `LIMIT ${Math.min(Number(n), DRILL_ROWS)}`);
  return { ok: true, sql };
}

const CACHE = { anthropic: { cacheControl: { type: "ephemeral" as const } } };

interface Ask {
  chainId: number;
  chainName: string;
  symbol: string;
  prompt: string;
  history: Turn[];
  baseUrl: string;
  emit: (e: QueryEvent) => void;
  /** answer from the model even when a recipe is kept (the warm job) */
  fresh?: boolean;
  /** each model call the writer makes reports here (meter.ts) */
  spent?: (call: ModelCall) => void;
}

/** what a reader is told when no answer came: a question with no words, one the chain's records cannot
    answer, a writer that ran out of steps, or SQL that kept failing on the database; each with a next step,
    never the database's own words */
function noAnswer(a: Ask, steps: number, outOfSteps = false): string {
  const pchain = targetOf(a.chainId).kind === "pchain";
  const example = (pchain ? PCHAIN_EXAMPLES : examplesFor(a.chainId))[0]?.items[0]?.q;
  const tryThis = example ? ` For example: “${example}”.` : "";
  if (!/\p{L}/u.test(a.prompt)) return `Ask a question in words.${tryThis}`;
  if (steps === 0) return `Query reads the ${a.chainName} records (${pchain ? "validators, stake, L1s and P-Chain transactions" : "transactions, blocks, contracts and tokens"}) and could not turn this question into a query.${tryThis}`;
  if (outOfSteps) return "Query ran out of steps before it could write an answer. Try a narrower question: one figure, over a shorter window.";
  return "The query kept failing on the database, so there is no answer. Try a shorter window, or one figure at a time.";
}

/** a kept or a fixed recipe, run again for fresh rows: no model is asked. A fixed one has no key, so the page asks
    for no layout and no reading; null when it no longer runs, or when a kept one finds nothing */
async function fromRecipe(a: Ask, recipe: Recipe, key: string | null, t0: number, emptyOk = false): Promise<QueryAnswer | null> {
  try {
    let sql = recipe.sql;
    let run = await anchored(sql, a.chainId);
    let result = await runQuery(run.sql);
    // a kept recipe that finds nothing is written again; a suggestion's fixed SQL says it found nothing, and asks no model
    if (result.rowCount === 0 && !emptyOk) throw new Error("empty");
    // a time series the row cap cut from its latest end keeps its newest rows, from now on
    const newest = newestSql(sql, result, recipe.chart.x);
    if (newest) {
      sql = newest;
      run = await anchored(sql, a.chainId);
      result = await runQuery(run.sql);
      if (key) await putRecipe(key, { ...recipe, sql });
    }
    // rows that stop at the query's own LIMIT are cut too, not only rows at the cap
    result.truncated ||= !!cutOf(sql, result.rowCount);
    const cover = await coverage(a.chainId);
    // the totals read follows the main query and runs beside no other query on stats-api: naming the rows runs none
    const [names, totals] = await Promise.all([nameRows(a.chainId, result.columns, result.rows, a.baseUrl), totalsOf(sql, result, a.chainId)]);
    // rows that only reach their LIMIT leave nothing out
    if (totals && totals.rows <= result.rowCount) result.truncated = false;
    // a kept layout that misstates these rows (stats named for the rows a LIMIT kept, a share, a stack) is laid out again
    const stale = !!key && !!recipe.visual && !!labelError(recipe.visual, result.rows, totals, sql);
    if (stale && key) await putRecipe(key, { ...recipe, sql, visual: null });
    const visual = stale ? null : recipe.visual;
    const said = keptWords(recipe, sql, result.rows, run.anchor, a.chainId);
    // a snapshot's figures stand at its time, read after the rows and their totals, beside no other query
    const span = said.span ?? (isFuji(a.chainId) ? null : await snapshotSpan(run.sql));
    return {
      anchor: run.anchor,
      sources: run.sources,
      title: said.title,
      note: said.note,
      span,
      sql,
      chart: recipe.chart,
      drill: recipe.drill,
      result,
      totals,
      names,
      visual: visual ?? basicVisual(recipe.chart, result.columns),
      draftVisual: !visual,
      coverage: cover,
      key: key ?? undefined,
      model: { steps: 0, ms: Date.now() - t0, tries: 0, writer: recipe.writer, cached: true, timings: [] },
    };
  } catch {
    return null;
  }
}

/** the time a snapshot answer's figures stand at, read by the snapshot's own subquery run alone; null for an answer
    that reads no snapshot, and when the read fails */
async function snapshotSpan(sql: string): Promise<string | null> {
  const pick = snapshotSql(sql);
  if (!pick) return null;
  try {
    const t = msOf((await runQuery(pick)).rows[0]?.at);
    return t > 0 ? asOfWords(t, Date.now()) : null;
  } catch {
    return null;
  }
}

/** a kept recipe's title and note as the page shows them: the note loses any sentence that names the SQL's parts,
    and both name the window the query reads, in the reader's dates when the index runs behind. The second phase
    writes its reading from these words too, so the reading never says today for a day the index ended on */
export function keptWords(recipe: Pick<Recipe, "title" | "note" | "chart">, sql: string, rows: readonly Record<string, unknown>[], anchor: string | null | undefined, chainId: number): { title: string; note: string; span: string | null } {
  const words = { title: plainLabel(recipe.title), note: withoutCode(recipe.note, sqlNames(sql)) };
  if (isFuji(chainId)) return { ...words, span: null };
  const read = collapseMacros(sql, chainId);
  const now = anchor ? msOf(anchor) : Date.now();
  return { ...withWindow(words, read, rows, recipe.chart.x, now, Date.now()), span: windowSpan(read, rows, recipe.chart.x, now, Date.now()) };
}

/** the answer, without its layout when none is kept: the page asks for that next */
/** a refusal of a read's size (ScanLimitError in clickhouse.ts), by its name, so a test that stubs that module keeps it */
const scanRefusal = (e: unknown): e is Error => e instanceof Error && e.name === "ScanLimitError";

export async function answerQuestion(a: Ask): Promise<QueryAnswer | null> {
  const key = recipeKey(a.chainId, a.prompt, a.history);
  const t0 = Date.now();

  // a suggestion of the other chain's goes there, as the model would send it
  const route = a.history.length === 0 ? fixedRoute(a.chainId, a.prompt) : null;
  if (route) return { title: "", note: "", sql: "", chart: { kind: "none", series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, route };

  // a suggested question runs its fixed SQL: no model writes it or lays it out
  const fixed = a.history.length === 0 ? fixedRecipe(a.chainId, a.prompt, a.symbol) : null;
  if (fixed) {
    a.emit({ type: "stage", stage: "cached", writer: fixed.writer });
    const done = await fromRecipe(a, fixed, null, t0, true);
    if (done) return done;
    // a fixed query that no longer runs is a bug to fix here; the reader still gets an answer from the model
    console.warn("[explorer-query] fixed SQL failed:", a.chainId, a.prompt);
  }

  const recipe = a.fresh ? null : await getRecipe(key);
  if (recipe) {
    a.emit({ type: "stage", stage: "cached", writer: recipe.writer });
    const done = await fromRecipe(a, recipe, key, t0);
    if (done) return done;
    /* the recipe no longer runs (a schema change) or finds nothing now; write it again */
  }

  let schema: string;
  try {
    schema = await schemaCard(a.chainId);
  } catch (e) {
    console.warn("[explorer-query] schema card failed:", e instanceof Error ? e.message : e);
    a.emit({ type: "error", error: "The database did not answer. Try again in a minute.", status: 503 });
    return null;
  }
  const cover = await coverage(a.chainId);
  // only the C-Chain and the P-Chain send a question to each other; an L1 answers or says why not
  const canRoute = targetOf(a.chainId).kind === "pchain" || isCChain(a.chainId);
  const coverLine = cover ? coverageText(a.chainId, cover) : null;
  const system =
    targetOf(a.chainId).kind === "pchain"
      ? pchainPrompt({ chainId: a.chainId, network: a.chainId === 5 ? "Fuji" : "Mainnet", schema, coverage: coverLine, lines: await versionLines(a.chainId) })
      : systemPrompt({ chainId: a.chainId, chainName: a.chainName, symbol: a.symbol, schema, coverage: coverLine, dex: dexQuestion(a.chainId, a.prompt, a.history), lending: lendingQuestion(a.chainId, a.prompt, a.history), families: familyQuestion(a.chainId, a.prompt, a.history), mev: mevQuestion(a.chainId, a.prompt, a.history) });

  // earlier turns, so "make it weekly" refines the last chart
  const messages: ModelMessage[] = [];
  for (const t of a.history.slice(-4)) {
    if (!t?.prompt || !t?.sql) continue;
    messages.push({ role: "user", content: String(t.prompt).slice(0, 1500) });
    // the shorthand in place of the WITH it wrote, so the SELECT after it stays in view
    messages.push({ role: "assistant", content: `Chart "${String(t.title).slice(0, 120)}" from:\n${collapseMacros(String(t.sql), a.chainId).slice(0, 3000)}` });
  }
  // a follow-up keeps the window of the chart it refines: a question on its own is told a series default, a follow-up
  // the window of the chart before it
  const before = [...a.history].reverse().find((t) => t?.prompt && t?.sql)?.sql;
  const question = userTurn(a.chainId, a.prompt, new Date(), !messages.length, before ? String(before) : undefined);
  messages.push({ role: "user", content: question });

  const timings: StepTiming[] = [];
  const errors: string[] = [];
  /* a read ClickHouse stopped as too large or too slow goes back to the writer like any database error, and the
     writer answers over the longest window that fits, which its note names; a question that never gets an answer
     ends with what to narrow */
  let overScan: Error | null = null;
  // the SQL the final answer keeps, as written: its cut and its totals are read from it
  let keptSql: string | null = null;
  let tries = 0;
  let steps = 0;
  let cacheRead = 0;
  let inputTokens = 0;
  // a run with no answer blames the database only when every query it sent failed there
  let ranFine = 0;
  let dbFailed = 0;
  // the drill probes that found records in this request: a final sent back after its probe hands back the same drill
  const probed = new Set<string>();
  // Fuji keeps the loop it had: no test budget, and every step may test
  const fuji = isFuji(a.chainId);
  // the server writes out the WITH a C-Chain shorthand stands for. A writer that writes it out itself spends about
  // 2,300 more output tokens, 25 s a call (D20's final); asked for the shorthand, 6 of 6 replays of that final kept it
  const shorthand = isCChain(a.chainId) && !fuji;

  const writers = fuji ? FUJI_WRITERS : WRITERS;

  const loop = async (writer: Writer): Promise<QueryAnswer | null> => {
    const w = writers[writer];
    const free = FREE_TOOL_MODELS.has(w.id);
    const turns: ModelMessage[] = free ? [...messages.slice(0, -1), { role: "user", content: `${question}\n\n${TOOLS_ONLY}` }] : messages;
    let final: QueryAnswer | null = null;
    let emptyOnce = false;
    let capOnce = false;
    let wordsOnce = false;
    let negOnce = false;
    let bigOnce = false;
    let zeroOnce = false;
    let datedOnce = false;
    let windowOnce = false;
    let scopeOnce = false;
    let unitOnce = false;
    let noteOnce = false;
    let tested = 0;
    // the rows of the last final query: a final sent back for its words reads them again rather than the database
    let lastRun: { sql: string; result: QueryResult } | null = null;
    // the model's own time on a step is the gap since the last tool finished
    let mark = Date.now();
    const step = (kind: StepTiming["kind"], sqlMs: number, ok: boolean, detail: string) => {
      const s: StepTiming = { n: timings.length + 1, kind, writer: w.label, modelMs: Math.max(0, Date.now() - mark - sqlMs), sqlMs, ok, detail: detail.slice(0, 160) };
      timings.push(s);
      a.emit({ type: "step", ...s });
      mark = Date.now();
    };

    const run_sql = tool({
      description: `Test a query you are unsure of: the first rows and column types, or the database error. Skip it when a worked example fits.${shorthand ? " Write a shorthand ($DEX, $LEND, $LIQUIDATIONS) as it stands, never the WITH it stands for: the server writes its WITH out." : ""}`,
      inputSchema: z.object({ sql: z.string() }),
      execute: async ({ sql }) => {
        // a writer past its tests answers from what they showed: a test it still calls runs nothing
        if (!fuji && tested >= TESTS) {
          step("test", 0, false, "no tests left");
          return { error: `No tests are left for this question. Call render_chart with the final query, from what the ${TESTS} tests showed.` };
        }
        tested += 1;
        tries += 1;
        // each result says how many tests are left
        const left = fuji ? {} : { testsLeft: TESTS - tested };
        const g = guardSql(sql, a.chainId);
        if (!g.ok) {
          errors.push(g.error);
          step("test", 0, false, g.error);
          return { error: g.error, ...left };
        }
        const q0 = Date.now();
        try {
          const run = await anchored(`SELECT * FROM (${g.sql.replace(/\nLIMIT \d+$/, "")}) LIMIT 20`, a.chainId);
          const r = await runQuery(run.sql);
          ranFine += 1;
          step("test", Date.now() - q0, true, `${r.rowCount} rows`);
          return { columns: r.columns, rows: r.rows, rowCount: r.rowCount, elapsedMs: r.elapsedMs, rowsRead: r.rowsRead, ...left };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (scanRefusal(e)) overScan = e;
          dbFailed += 1;
          errors.push(msg);
          step("test", Date.now() - q0, false, msg);
          return { error: msg, ...left };
        }
      },
    });

    const render_chart = tool({
      description: `Hand back the final query and the chart spec. The server runs the query in full and tests the drill. Returns ok, or the error to fix.${shorthand ? " Write sql and drill.sql with the shorthand your tests used ($DEX, $LEND, $LIQUIDATIONS): the server writes its WITH out." : ""}`,
      inputSchema: z.object({
        title: z.string(),
        note: z.string(),
        sql: z.string(),
        chart: chartSpecSchema,
        drill: drillSchema.optional().describe("how one row opens into its records; required when rows are groups"),
        route: z.enum(["p-chain", "c-chain"]).optional().describe("with kind none: the question belongs to this chain's data instead"),
        reason: z.string().max(300).optional().describe("with kind none and no route: why this chain's data cannot answer, one plain sentence for the reader"),
      }),
      execute: async ({ title, note, sql, chart, drill, route, reason }) => {
        if (chart.kind === "none") {
          const routed = !!route && canRoute;
          // an answer with no figure says why, and a question the rows can answer gets its SQL instead
          if (!routed && !reason?.trim()) {
            step("final", 0, false, "no figure and no reason");
            return {
              error:
                "kind none leaves the reader with no figure and no reason. If the rows can answer the question, write the SQL and chart it: a count or a total over a window is one row, and the page shows it as a figure. If this chain's data cannot answer it, call render_chart again with kind none and the reason in reason, one plain sentence for the reader.",
            };
          }
          final = { title, note: routed ? note : reason!.trim(), sql: "", chart, drill: null, result: null, names: {}, visual: null, coverage: null, ...(routed ? { route } : {}) };
          step("final", 0, true, "no chart");
          return { ok: true };
        }
        const fail = (msg: string, ms: number) => {
          errors.push(msg);
          step("final", ms, false, msg);
          return { error: msg };
        };
        const g = guardSql(sql, a.chainId);
        if (!g.ok) return fail(g.error, 0);
        // a title, note or label with words the page never shows (the SQL's parts, settled) is written again once, then left out
        const own = sqlNames(sql);
        const named = codeWords([title, note, ...chart.series.map((s) => s.label)].join("\n"), own);
        if (named.length && !wordsOnce) {
          wordsOnce = true;
          step("final", 0, false, `reader words: ${named.join(", ")}`);
          return {
            error: `the title, note or a series label has ${named.join(", ")}, words the page never shows: the reader never sees the SQL or its columns, and a transaction is final, never settled. Say it in plain words ("seen in the last 7 days", not seen_7d; final, not settled), and call render_chart again with the same SQL.`,
          };
        }
        // a relative window written as a date reads the same days on every later run of a kept answer: ask once
        const dated = datedOnce ? null : literalWindow(sql, [a.prompt, ...a.history.map((t) => String(t?.prompt ?? ""))].join("\n"), a.chainId);
        if (dated) {
          datedOnce = true;
          return fail(dated, 0);
        }
        // a question that names a protocol the registry lists is answered from that protocol's contracts: ask once
        const questions = [a.prompt, ...a.history.map((t) => String(t?.prompt ?? "")).reverse()];
        const unscoped = scopeOnce ? null : protocolScope(sql, questions, a.chainId);
        if (unscoped) {
          scopeOnce = true;
          return fail(unscoped, 0);
        }
        // a value column holds the unit its name says: ask once
        const misnamed = unitOnce ? null : unitName(sql, a.chainId);
        if (misnamed) {
          unitOnce = true;
          return fail(misnamed, 0);
        }
        const q0 = Date.now();
        try {
          const run = await anchored(g.sql, a.chainId);
          // a title or a note that names a window the query does not read is written again once, before the query runs
          const now = run.anchor ? msOf(run.anchor) : Date.now();
          // a shorthand's window is its own start and end, so the window is read with the guard's WITH written back into it
          const read = collapseMacros(g.sql, a.chainId);
          const win = fuji ? null : sqlWindow(read, now);
          const unnamed = win && win !== "unknown" && !windowOnce ? scopeError(title, note, win, now) : null;
          if (unnamed) {
            windowOnce = true;
            step("final", Date.now() - q0, false, "window words");
            return { error: unnamed };
          }
          const result = !fuji && lastRun?.sql === run.sql ? lastRun.result : await runQuery(run.sql);
          lastRun = { sql: run.sql, result };
          ranFine += 1;
          // an empty answer is usually a window that misses the data; ask once
          if (result.rowCount === 0 && !emptyOnce) {
            emptyOnce = true;
            return fail(`the query returned no rows. The data runs ${cover ? `${cover.since} to ${cover.until} UTC` : "to the last indexed block"}. Check the window and the filters; call render_chart again unchanged only if no rows is the true answer.`, Date.now() - q0);
          }
          // an empty result comes back with no columns, so there is no chart to check it against: when no rows is the
          // true answer the query ships with its own chart (L04 backed into SELECT 1 AS nothing ... LIMIT 0 before)
          const cols = new Set(result.columns.map((c) => c.name));
          const unchecked = !fuji && result.rowCount === 0 && !result.columns.length;
          const missing = unchecked ? [] : [chart.x, ...chart.series.map((s) => s.column)].filter((c): c is string => !!c && !cols.has(c));
          if (missing.length) return fail(`chart refers to columns the query does not return: ${missing.join(", ")}`, Date.now() - q0);
          // a fee, a volume or a value in USD below zero is a sign or a price gone wrong: ask once
          const neg = negOnce ? null : negativeFigure(result, a.chainId);
          if (neg) {
            negOnce = true;
            return fail(neg, Date.now() - q0);
          }
          // a figure in dollars past a trillion, or a token amount past a quadrillion units, is a decimals or a sign gone wrong: ask once
          const big = bigOnce ? null : absurdFigure(result, a.chainId);
          if (big) {
            bigOnce = true;
            return fail(big, Date.now() - q0);
          }
          // a USD figure NULL where its amount is 0 is a sum over no rows, not a missing price: ask once
          const zero = zeroOnce ? null : zeroUsd(g.sql, note, result, a.chainId);
          if (zero) {
            zeroOnce = true;
            return fail(zero, Date.now() - q0);
          }
          // a note that says an asset has no USD price, over rows that all have theirs, loses those sentences here: the
          // writer's own fix each time it was sent back for one, with no second call
          note = pricedNote(g.sql, note, result, a.chainId) ?? note;
          // a time series the row cap cut from its latest end runs again for its newest rows, and is kept that way
          let kept = g.sql;
          let ran = run;
          let rows = result;
          const newest = newestSql(g.sql, result, chart.x);
          // once, the writer may bucket a series coarser so the whole window fits; after that it keeps its newest rows
          if (newest && !capOnce) {
            capOnce = true;
            return fail(`the series runs past ${MAX_ROWS} rows, so the row cap cut its latest part. Use a coarser bucket (toStartOfFifteenMinutes, toStartOfHour, toDate) so the whole window fits in ${MAX_ROWS} rows.`, Date.now() - q0);
          }
          if (newest) {
            kept = newest;
            ran = await anchored(newest, a.chainId);
            rows = await runQuery(ran.sql);
          }
          // the drill must work on a real row before the answer ships
          if (drill && rows.rows[0]) {
            const d = drillSql(drill.sql, rows.rows[0], a.chainId);
            if (!d.ok) return fail(`drill: ${d.error}`, Date.now() - q0);
            try {
              const probeSql = (await anchored(d.sql, a.chainId)).sql.replace(/\bLIMIT\s+\d+\s*$/i, "LIMIT 1");
              // a probe byte for byte the same as one that found records in this request is not run again
              if (fuji || !probed.has(probeSql)) {
                const probe = await runQuery(probeSql);
                // a drill that opens onto nothing is the "No records matched" a reader hits
                if (probe.rowCount === 0) return fail("drill: it found no records for the first row. Keep the main query's window and filters, and filter on that row's own values (use :bytes for hex ids and addresses).", Date.now() - q0);
                probed.add(probeSql);
              }
            } catch (e) {
              return fail(`drill: ${e instanceof Error ? e.message : String(e)}`, Date.now() - q0);
            }
          }
          rows.truncated ||= !!cutOf(kept, rows.rowCount);
          // the note came with the query, before its rows: one that says none of what they hold, gives a figure where
          // they hold only zeros, or a total they hold another figure for (a per-row sum only over rows not cut), is
          // sent back once with their figures; a sentence still against them is left out, or takes their figure
          const against = fuji ? [] : contradictions(note, title, rows);
          if (against.length && !noteOnce) {
            noteOnce = true;
            step("final", Date.now() - q0, false, "note against the rows");
            return { error: `${against.map((c) => c.error).join(" ")} Write the note from these rows, and call render_chart again with the same SQL.` };
          }
          // what is left of a wrong window's words gives way to the window the query reads, or else its rows cover
          const words = { title: plainLabel(title), note: withoutCode(against.length ? withoutContradictions(note, title, rows) : note, own) };
          const said = fuji ? words : withWindow(words, read, rows.rows, chart.x, now, Date.now());
          final = { title: said.title, note: said.note, span: fuji ? null : (windowSpan(read, rows.rows, chart.x, now, Date.now()) ?? (await snapshotSpan(ran.sql))), sql: kept, chart: { ...chart, series: chart.series.map((s) => ({ ...s, label: plainLabel(s.label) })) }, drill: drill ?? null, result: rows, names: {}, visual: null, coverage: null, anchor: ran.anchor, sources: ran.sources };
          keptSql = kept;
          step("final", Date.now() - q0, true, `${rows.rowCount} rows`);
          return { ok: true, rows: rows.rowCount };
        } catch (e) {
          if (scanRefusal(e)) overScan = e;
          dbFailed += 1;
          return fail(e instanceof Error ? e.message : String(e), Date.now() - q0);
        }
      },
    });

    const call = (msgs: ModelMessage[], budget: number) => generateText({
      model: anthropic(w.id, a.spent),
      // the writer's own cap on mainnet; Fuji keeps the SDK's
      ...(fuji ? {} : { maxOutputTokens: w.maxOutputTokens }),
      ...(w.effort ? { providerOptions: { anthropic: { effort: w.effort } } } : {}),
      // the prompt and the tools are the same on every step and every
      // question; the cache mark lets each step after the first skip them
      system: { role: "system", content: system, providerOptions: CACHE },
      messages: msgs,
      tools: { run_sql, render_chart },
      // every step calls a tool, so a reply in prose never ends the run with no answer; a model that refuses a
      // forced call runs on auto, and its prose goes back once (below)
      toolChoice: free ? "auto" : "required",
      stopWhen: [stepCountIs(budget), () => final !== null],
      prepareStep: ({ stepNumber, messages: sent }) => {
        // mark the newest turn too, so the next step reads the whole
        // conversation so far from the cache
        const m = [...sent];
        const last = m[m.length - 1];
        if (last && last.role !== "system") m[m.length - 1] = { ...last, providerOptions: { ...last.providerOptions, ...CACHE } } as ModelMessage;
        // near the end of the budget, or once the tests are spent, the only move left is to answer. The SDK still
        // runs a tool that activeTools leaves out when the model calls it, so on mainnet the call itself is forced,
        // with the tools every step before sent: a new tool list misses the prompt cache (D20's final wrote its
        // 31.8k tokens again), and a new tool choice reads it. Fuji narrows its tools as it did
        // a free model is not forced: once its tests are spent, run_sql tells it to answer
        if (final || free || (stepNumber < w.steps - 2 && (fuji || tested < TESTS))) return { messages: m };
        return fuji ? { messages: m, activeTools: ["render_chart" as const] } : { messages: m, toolChoice: { type: "tool" as const, toolName: "render_chart" as const } };
      },
      onStepFinish: () => {
        steps += 1;
      },
    });
    let out = await call(turns, w.steps);
    cacheRead += out.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
    inputTokens += out.totalUsage.inputTokens ?? 0;
    // on auto a reply in prose ends the run with no answer: it goes back once, as a send-back
    if (free && !final && out.steps.length < w.steps && !out.steps.at(-1)?.toolCalls.length) {
      step("final", 0, false, "replied in prose, not a tool call");
      out = await call([...turns, ...out.response.messages, { role: "user", content: PROSE_BACK }], w.steps - out.steps.length);
      cacheRead += out.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
      inputTokens += out.totalUsage.inputTokens ?? 0;
    }
    return final;
  };

  let writer = pickWriter(a.prompt, a.history);
  a.emit({ type: "stage", stage: "writing", writer: writers[writer].label });
  let final: QueryAnswer | null = null;
  try {
    final = await loop(writer);
    if (!final && writer === "fast") {
      writer = "full";
      a.emit({ type: "stage", stage: "escalated", writer: writers.full.label });
      final = await loop("full");
    }
  } catch (e) {
    console.warn("[explorer-query] writer failed:", e instanceof Error ? e.message : e);
    a.emit({ type: "error", error: "The answer could not be written this time. Try again.", status: 502 });
    return null;
  }

  if (!final) {
    // the database's own words stay in the log; the reader gets what to do next
    if (errors.length) console.warn("[explorer-query] no answer:", errors.slice(-3).join(" | ").slice(0, 900));
    // set inside the tools, so TypeScript reads it as still null here
    const over = overScan as Error | null;
    if (over) {
      a.emit({ type: "error", error: over.message, status: 422 });
      return null;
    }
    // on mainnet a writer with no answer ran out of steps, and says so unless every query it sent failed on the database
    a.emit({ type: "error", error: noAnswer(a, timings.length, !fuji && (ranFine > 0 || dbFailed === 0)), status: 422 });
    return null;
  }
  const done = final as QueryAnswer;
  if (done.result) {
    // the totals read follows the main query and runs beside no other query on stats-api: naming the rows runs none
    const [names, totals] = await Promise.all([nameRows(a.chainId, done.result.columns, done.result.rows, a.baseUrl), keptSql ? totalsOf(keptSql, done.result, a.chainId) : null]);
    done.names = names;
    done.totals = totals;
    // rows that only reach their LIMIT leave nothing out
    if (totals && totals.rows <= done.result.rowCount) done.result.truncated = false;
  }
  done.coverage = cover;
  done.key = key;
  // draw something at once; the page asks the designer for the real layout
  if (done.result) {
    done.visual = basicVisual(done.chart, done.result.columns);
    done.draftVisual = true;
  }
  done.model = { steps, ms: Date.now() - t0, tries, writer: writers[writer].label, cached: false, timings, cacheRead, inputTokens };
  // an answer with no rows is not kept: the next asker may find some
  if (done.result && done.result.rowCount > 0) {
    await putRecipe(key, { question: a.prompt, title: done.title, note: done.note, sql: done.sql, chart: done.chart, drill: done.drill, visual: null, writer: writers[writer].label, at: Date.now() });
  }
  return done;
}
