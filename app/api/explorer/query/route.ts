import { NextResponse, after } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { guardSql } from "@/lib/explorer-query/guard";
import { runQuery, anchored, indexState, type ColumnMeta, type QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Turn } from "@/lib/explorer-query/types";
import { nameRows } from "@/lib/explorer-query/enrich";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { designVisual } from "@/lib/explorer-query/visual";
import { writeReading } from "@/lib/explorer-query/reading";
import { showPrice } from "@/lib/explorer-query/avax-usd";
import { markUpgrades, upgradeLines } from "@/lib/explorer-query/upgrades";
import type { ChartSpec, Names, QueryAnswer, Totals } from "@/lib/explorer-query/types";
import { monitorNote } from "@/lib/explorer-query/monitor";
import { monitorFor } from "@/lib/explorer-query/monitor-feed";
import { answerQuestion, drillSql, keptWords, type QueryEvent } from "@/lib/explorer-query/answer";
import { cutOf, totalsOf } from "@/lib/explorer-query/cut";
import { msOf } from "@/lib/explorer-query/edges";
import { answerMoves, movedSql, movedWords, priorOf } from "@/lib/explorer-query/window-ops";
import { SPANS, type SpanKey } from "@/lib/explorer-query/window-shift";
import { getRecipe, putVisual } from "@/lib/explorer-query/cache";
import { fixedRecipe } from "@/lib/explorer-query/fixed";
import { isKept, runKept } from "@/lib/explorer-query/run-cache";
import { profileSql, type DrillProfile } from "@/lib/explorer-query/drill-profile";
import { sourceNotes } from "@/lib/explorer-query/sources";
import { NETWORK_ID, NETWORK_SLUG, targetOf } from "@/lib/explorer-query/target";
import { checkChatRateLimit, formatResetTime, getClientIP, type RateLimits } from "@/lib/chat/rateLimit";
import { getAuthSession } from "@/lib/auth/authSession";
import { TRACE, askerOf, sendQuestion, sendStage, sourceOf, type Asked, type Asker, type Stage } from "@/lib/explorer-query/analytics";
import type { ModelCall } from "@/lib/explorer-query/meter";

/* A question in, a chart out. POST { chainId, prompt, history? } streams
   the work as NDJSON (lib/explorer-query/answer.ts): each model step as
   it ends, then the answer with its rows and the SQL that made them, so
   every figure can be audited and re-run by hand. POST { sql } re-runs a
   query the reader edited; POST { drill } opens one row into its
   records; POST { design } lays out rows the page already has; POST
   { move } reads an answer again over another span, and POST { prior }
   over the period before its window (window-ops.ts). Each
   question, and what its model calls cost, goes to PostHog
   (lib/explorer-query/analytics.ts). */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  chainId?: string | number;
  prompt?: string;
  history?: Turn[];
  sql?: string;
  /** with sql: the column the answer's chart runs along, so the page learns whether its window can move */
  x?: string;
  /** read an answer again over another span: its query, its drill and its words, as the page holds them */
  move?: { sql: string; drill?: string | null; x?: string; span: string; title?: string; note?: string };
  /** read an answer's query over the period before its window */
  prior?: { sql: string; x?: string };
  /** open one row of an answer into its records; span is the opened mark's bucket, in unix seconds */
  drill?: { sql: string; row: Record<string, unknown>; span?: [number, number] };
  /** lay out a kept answer, by its key */
  key?: string;
  /** with key: write the kept layout's reading again from fresh rows */
  reading?: boolean;
  /** with key or design: the PostHog trace of the question the layout serves */
  trace?: string;
  /** lay out rows the page already has */
  design?: { question: string; title: string; note: string; columns: ColumnMeta[]; rows: Record<string, unknown>[]; names: Names; chart: ChartSpec };
}

/* An answer's own read, kept a minute under its key on this instance: the layout the page asks for next is designed
   from the rows the reader was shown, not from a second read of the same SQL (a full scan again, and the totals with
   it). The layout is still made from the kept recipe's SQL on this server, never from rows a reader sends; on an
   instance that did not answer, the SQL is read again as before. */
const READ_MS = 60_000;
const READS_MAX = 32;
type Read = { result: QueryResult; names: Names; totals: Totals | null; anchor: string | null };
const reads = new Map<string, Read & { at: number }>();

function keepRead(key: string, read: Read) {
  reads.delete(key);
  reads.set(key, { ...read, at: Date.now() });
  while (reads.size > READS_MAX) reads.delete(reads.keys().next().value as string);
}

/** the note as the layout and the reading models read it: with the comparison before and since an upgrade the
    question names (upgrades.ts), so a reading drawn from two days does not contradict the page's own line */
const compared = (note: string, recipe: { question: string; chart: ChartSpec }, rows: Record<string, unknown>[], chainId: number) =>
  [note, ...upgradeLines(recipe.question, recipe.chart, rows, chainId).map((l) => l.text)].filter(Boolean).join(" ");

/** reads with no model in front of them (an edited query, a board's tile, a drill), per address an hour, counted only
    when no kept run answers them: a cold board takes one per tile, and its next readers take none. By address alone,
    so no read waits on a session */
const READS: RateLimits = { anonymous: { maxRequests: 120, windowMs: 3600_000 }, authenticated: { maxRequests: 120, windowMs: 3600_000 } };

/** a 429 when this address has run too many reads the run cache did not answer; null when the read may run */
function overReads(req: Request, sql: string, chainId: number): NextResponse | null {
  if (isKept(sql, chainId)) return null;
  const limit = checkChatRateLimit(getClientIP(req), false, READS, "query-read");
  return limit.allowed ? null : NextResponse.json({ error: `This address has run ${limit.limit} queries this hour. Try again ${formatResetTime(limit.resetTime)}.` }, { status: 429 });
}

/** the answer's read while it is fresh, else the kept SQL read again with its names and totals */
async function readOf(key: string, sql: string, chainId: number, baseUrl: string): Promise<Read> {
  const hit = reads.get(key);
  if (hit && Date.now() - hit.at < READ_MS) return hit;
  const run = await anchored(sql, chainId);
  const result = await runQuery(run.sql, chainId);
  // the totals read follows the main query and runs beside no other query on stats-api: naming the rows runs none
  const [names, totals] = await Promise.all([nameRows(chainId, result.columns, result.rows, baseUrl), totalsOf(sql, result, chainId)]);
  return { result, names, totals, anchor: run.anchor };
}

/** a ranked drill's whole population over the opened bucket, in bins (drill-profile.ts); null when the drill ranks
    nothing, or the read fails: the records still stand alone */
async function binsOf(sql: string, span: unknown, chainId: number): Promise<DrillProfile | null> {
  const s = Array.isArray(span) && span.length === 2 && span.every((v) => typeof v === "number" && Number.isFinite(v)) ? (span as [number, number]) : null;
  // no drill opens a bucket longer than a year
  const p = s && s[1] - s[0] <= 366 * 86_400 ? profileSql(sql, s) : null;
  const g = p ? guardSql(p.sql, chainId) : null;
  if (!p || !g?.ok) return null;
  try {
    const run = await runKept(g.sql, chainId);
    return { col: p.col, agg: p.agg, step: p.step, bins: run.result.rows.map((r) => ({ t: Number(r.bin), n: Number(r.n), v: Number(r.v) })) };
  } catch (e) {
    console.warn("[explorer-query] drill bins failed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  // the network (the C-Chain and every mainnet L1) by its slug; any other target by its chain id
  const chainId = body.chainId === NETWORK_SLUG ? NETWORK_ID : Number(body.chainId);
  // the P-Chain's tables key their rows 1 (mainnet) and 5 (Fuji); EVM chains by their chain id
  const chain =
    chainId === NETWORK_ID
      ? { chainId: NETWORK_SLUG, chainName: "the Avalanche network", networkToken: { symbol: "each chain's own, named in its token column; amounts in two tokens never add up, rank against each other or make a share of one sum" } }
      : targetOf(chainId).kind === "pchain"
        ? { chainId: String(chainId), chainName: chainId === 5 ? "P-Chain (Fuji)" : "P-Chain", networkToken: { symbol: "AVAX" } }
        : (l1ChainsData as { chainId: string; chainName: string; networkToken?: { symbol?: string } }[]).find((c) => c.chainId === String(chainId));
  if (!Number.isFinite(chainId) || !chain) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  const symbol = chain.networkToken?.symbol ?? "AVAX";

  const baseUrl = siteBaseUrl();

  /* what the models cost, for PostHog: each call a stage makes, sent once the response is out, under the trace of
     the question the page sends back, else under a trace of its own */
  const calls: ModelCall[] = [];
  const spent = (c: ModelCall) => void calls.push(c);
  const trace = typeof body.trace === "string" && TRACE.test(body.trace) ? body.trace : crypto.randomUUID();
  // who asked is read once the response is out, so no answer waits on it
  const asker = async () => askerOf(req, (await getAuthSession())?.user?.id);
  const counted = (stage: Stage, question: string, key?: string) =>
    after(async () => {
      if (calls.length) await sendStage(calls, { who: await asker(), trace, stage, chainId, question, key });
    });

  // one row of an answer, opened: the records behind it, no model
  if (body.drill && typeof body.drill.sql === "string" && body.drill.row && typeof body.drill.row === "object") {
    const d = drillSql(body.drill.sql, body.drill.row, chainId);
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: 400 });
    const over = overReads(req, d.sql, chainId);
    if (over) return over;
    try {
      // the bucket's bins read beside the records: two queries, the most one request holds on stats-api
      const [run, profile] = await Promise.all([runKept(d.sql, chainId), binsOf(d.sql, body.drill.span, chainId)]);
      const result = run.result;
      const names = await nameRows(chainId, result.columns, result.rows, baseUrl);
      return NextResponse.json({ sql: d.sql, result, names, anchor: run.anchor, sources: run.sources, profile });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "drill failed" }, { status: 400 });
    }
  }

  // a window button: the answer's own query over another span, no model
  if (body.move && typeof body.move.sql === "string" && SPANS.some((s) => s.key === body.move!.span)) {
    const mv = body.move;
    const [x, span] = [typeof mv.x === "string" ? mv.x : undefined, mv.span as SpanKey];
    const moved = movedSql(mv.sql, typeof mv.drill === "string" ? mv.drill : null, x, span, chainId, Date.now());
    if (!moved.ok) return NextResponse.json({ error: moved.error }, { status: 400 });
    const over = overReads(req, moved.sql, chainId);
    if (over) return over;
    try {
      const run = await runKept(moved.sql, chainId);
      const result = { ...run.result, truncated: run.result.truncated || !!cutOf(moved.sql, run.result.rowCount) };
      const [names, totals] = await Promise.all([nameRows(chainId, result.columns, result.rows, baseUrl), totalsOf(moved.sql, result, chainId)]);
      if (totals && totals.rows <= result.rowCount) result.truncated = false;
      const now = run.anchor ? msOf(run.anchor) : Date.now();
      const said = movedWords({ title: String(mv.title ?? "").slice(0, 200), note: String(mv.note ?? "").slice(0, 800) }, mv.sql, moved.sql, x, span, result.rows, chainId, now, Date.now());
      return NextResponse.json({ ...said, sql: moved.sql, drill: moved.drill, result, names, totals, anchor: run.anchor, sources: run.sources, moves: answerMoves(moved.sql, x, chainId, Date.now()) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "query failed" }, { status: 400 });
    }
  }

  // the period before an answer's window: the same query, its window moved back by its own length, no model
  if (body.prior && typeof body.prior.sql === "string") {
    const before = priorOf(body.prior.sql, typeof body.prior.x === "string" ? body.prior.x : undefined, chainId, Date.now());
    if (!before.ok) return NextResponse.json({ error: before.error }, { status: 400 });
    const over = overReads(req, before.sql, chainId);
    if (over) return over;
    try {
      const { result } = await runKept(before.sql, chainId);
      return NextResponse.json({ result, totals: await totalsOf(before.sql, result, chainId) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "query failed" }, { status: 400 });
    }
  }

  // the reader edited the SQL: run it, no model
  if (typeof body.sql === "string" && !body.prompt) {
    const g = guardSql(body.sql, chainId);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: 400 });
    const over = overReads(req, g.sql, chainId);
    if (over) return over;
    try {
      // a board's tiles: many readers, one run a minute per query
      const run = await runKept(g.sql, chainId);
      const result = run.result;
      // rows a LIMIT cut carry the whole result's figures, as an answer's do, so a tile's figures stay whole after a refresh
      const [names, totals] = await Promise.all([nameRows(chainId, result.columns, result.rows, baseUrl), totalsOf(g.sql, result, chainId)]);
      return NextResponse.json({ sql: g.sql, result, names, totals, anchor: run.anchor, sources: run.sources, moves: answerMoves(g.sql, typeof body.x === "string" ? body.x : undefined, chainId, Date.now()) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "query failed" }, { status: 400 });
    }
  }

  // the second phase: a kept answer is laid out from its own SQL, so what
  // is stored for every reader never depends on what one reader sent
  if (typeof body.key === "string" && /^[0-9a-f]{32}$/.test(body.key) && !body.prompt) {
    const recipe = await getRecipe(body.key);
    // a kept answer's SQL names one chain; it never lays out for another
    if (!recipe || !guardSql(recipe.sql, chainId).ok) return NextResponse.json({ error: "unknown answer" }, { status: 404 });
    // a kept layout: only its reading is written again, from fresh rows
    if (recipe.visual && body.reading) {
      const t0 = Date.now();
      counted("reader", recipe.question, body.key);
      try {
        const { result, names, totals, anchor } = await readOf(body.key, recipe.sql, chainId, baseUrl);
        // the reading is written from the words the page shows, not the ones the recipe kept
        const said = keptWords(recipe, recipe.sql, result.rows, anchor, chainId);
        const callouts = await writeReading({ question: recipe.question, title: said.title, note: compared(said.note, recipe, result.rows, chainId), symbol, columns: result.columns, rows: result.rows, names, totals, x: recipe.chart.x, sql: recipe.sql, anchor, spent });
        return NextResponse.json({ callouts, ms: Date.now() - t0 });
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "reading failed" }, { status: 400 });
      }
    }
    if (recipe.visual) return NextResponse.json({ visual: recipe.visual, designer: true, ms: 0 });
    counted("designer", recipe.question, body.key);
    try {
      const { result, names, totals, anchor } = await readOf(body.key, recipe.sql, chainId, baseUrl);
      const said = keptWords(recipe, recipe.sql, result.rows, anchor, chainId);
      const out = await designVisual({ question: recipe.question, title: said.title, note: compared(said.note, recipe, result.rows, chainId), symbol, columns: result.columns, rows: result.rows, names, chart: recipe.chart, totals, sql: recipe.sql, anchor, spent });
      out.visual = showPrice(markUpgrades(out.visual, recipe.question, result.rows, chainId), result.rows, chainId);
      if (out.fromDesigner) await putVisual(body.key, out.visual);
      // the design's own time, its model steps and each visual its tool turned back: a slow layout shows whether it retried
      return NextResponse.json({ visual: out.visual, designer: out.fromDesigner, ms: out.ms, steps: out.steps, refused: out.refused?.length ? out.refused : undefined, error: out.fromDesigner ? undefined : out.error });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "design failed" }, { status: 400 });
    }
  }

  // rows the reader made by hand: laid out for this reader only, never kept
  if (body.design && Array.isArray(body.design.rows) && Array.isArray(body.design.columns)) {
    const d = body.design;
    const question = String(d.question ?? "").slice(0, 1500);
    counted("designer", question);
    const out = await designVisual({
      question,
      title: String(d.title ?? "").slice(0, 200),
      note: String(d.note ?? "").slice(0, 800),
      symbol,
      columns: d.columns.slice(0, 40),
      rows: d.rows.slice(0, 2000),
      names: d.names ?? {},
      chart: d.chart ?? { kind: "table", series: [] },
      spent,
    });
    return NextResponse.json({ visual: out.visual, designer: out.fromDesigner, ms: out.ms, steps: out.steps, refused: out.refused?.length ? out.refused : undefined, error: out.fromDesigner ? undefined : out.error });
  }

  const prompt = String(body.prompt ?? "").trim().slice(0, 1500);
  if (!prompt) return NextResponse.json({ error: "empty prompt" }, { status: 400 });
  // "??" or a row of digits is not a question: no model is asked, and no question is counted
  if (!/\p{L}/u.test(prompt)) {
    const example = targetOf(chainId).kind === "pchain" ? "AVAX staked per day" : "transactions per hour today";
    return NextResponse.json({ error: `Ask a question in words, for example "${example}".` }, { status: 400 });
  }

  const t0 = Date.now();
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
  // the question as PostHog counts it, sent once its answer or its error is out
  const asked = (who: Asker, out: Pick<Asked, "answer" | "failed" | "escalated">) =>
    sendQuestion({ who, trace, chainId, chain: chain.chainName, question: prompt, followUp: history.length > 0, ms: Date.now() - t0, source: sourceOf(out.answer ?? null, calls), calls, ...out });

  // "monitor USDT transfers": a live feed of the chain's own moves, read from its RPC block by block. No model and
  // no SQL, so the question does not count against the limit, and the index's coverage does not matter
  const monitor = await monitorFor(prompt, chainId, symbol, baseUrl);
  if (monitor) {
    const answer: QueryAnswer = { title: monitor.title, note: monitorNote(monitor, chain.chainName), sql: "", chart: { kind: "none", series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, monitor };
    after(async () => asked(await asker(), { answer }));
    return new Response(`${JSON.stringify({ type: "answer", answer })}\n`, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  }

  // a chain with no indexed rows has nothing to read; no model is asked
  if ((await indexState(chainId)) === "empty") {
    const error = `${chain.chainName}'s history is not indexed yet, so Query has nothing to read.`;
    after(async () => asked(await asker(), { failed: { error, status: 404 } }));
    return NextResponse.json({ error }, { status: 404 });
  }

  const session = await getAuthSession();
  const isAuthenticated = !!session?.user?.id;
  const who = askerOf(req, session?.user?.id);
  // a suggestion runs its fixed SQL and asks no model: it is a read, counted with the reads and not with the questions.
  // Any other question takes the same budget as the chat: model calls are the cost there
  const fixed = history.length === 0 && !!fixedRecipe(chainId, prompt, symbol);
  const limit = fixed ? checkChatRateLimit(getClientIP(req), false, READS, "query-read") : checkChatRateLimit(isAuthenticated ? session!.user!.id! : getClientIP(req), isAuthenticated);
  if (!limit.allowed) {
    // signed out, the reader can lift the question limit now: the page offers sign-in
    const when = formatResetTime(limit.resetTime);
    const out = fixed
      ? { error: `This address has run ${limit.limit} queries this hour. Try again ${when}.` }
      : isAuthenticated
        ? { error: `Question limit reached. Try again ${when}.` }
        : { error: `You have asked ${limit.limit} questions this hour. Sign in to keep asking, or try again ${when}.`, signIn: true };
    after(() => asked(who, { failed: { error: out.error, status: 429 } }));
    return NextResponse.json(out, { status: 429 });
  }

  // one JSON event per line: each step as it ends, then the answer or the error
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctl) {
      let answer: QueryAnswer | null = null;
      let failed: Asked["failed"] = null;
      let escalated = false;
      const emit = (e: QueryEvent) => {
        if (e.type === "error") failed = { error: e.error, status: e.status };
        if (e.type === "stage" && e.stage === "escalated") escalated = true;
        ctl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      };
      try {
        answer = await answerQuestion({ chainId, chainName: chain.chainName, symbol, prompt, history, baseUrl, emit, spent });
        // the rows just read are the ones the layout request designs from
        if (answer?.key && answer.result) keepRead(answer.key, { result: answer.result, names: answer.names, totals: answer.totals ?? null, anchor: answer.anchor ?? null });
        // what the server's tables in the answer cover, for the page to state
        if (answer?.sql && !answer.sources) answer.sources = await sourceNotes(answer.sql, chainId);
        // the page sends the trace back with the answer's layout and reading, so their model calls join the question's
        if (answer) emit({ type: "answer", answer: { ...answer, trace, moves: answer.result ? answerMoves(answer.sql, answer.chart.x, chainId, Date.now()) : null } });
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : "the query failed", status: 500 });
      } finally {
        // the page has what it waited for: the question goes to PostHog before the stream ends
        await asked(who, { answer, failed, escalated }).catch(() => undefined);
        ctl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
