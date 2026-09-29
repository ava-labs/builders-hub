import { NextResponse } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { guardSql } from "@/lib/explorer-query/guard";
import { runQuery, anchored, indexState, type ColumnMeta, type QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Turn } from "@/lib/explorer-query/types";
import { nameRows } from "@/lib/explorer-query/enrich";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { designVisual, writeReading } from "@/lib/explorer-query/visual";
import type { ChartSpec, Names, QueryAnswer, Totals } from "@/lib/explorer-query/types";
import { monitorNote } from "@/lib/explorer-query/monitor";
import { monitorFor } from "@/lib/explorer-query/monitor-feed";
import { answerQuestion, drillSql, keptWords, type QueryEvent } from "@/lib/explorer-query/answer";
import { totalsOf } from "@/lib/explorer-query/cut";
import { getRecipe, putVisual } from "@/lib/explorer-query/cache";
import { runKept } from "@/lib/explorer-query/run-cache";
import { sourceNotes } from "@/lib/explorer-query/sources";
import { targetOf } from "@/lib/explorer-query/target";
import { checkChatRateLimit, formatResetTime, getClientIP } from "@/lib/chat/rateLimit";
import { getAuthSession } from "@/lib/auth/authSession";

/* A question in, a chart out. POST { chainId, prompt, history? } streams
   the work as NDJSON (lib/explorer-query/answer.ts): each model step as
   it ends, then the answer with its rows and the SQL that made them, so
   every figure can be audited and re-run by hand. POST { sql } re-runs a
   query the reader edited; POST { drill } opens one row into its
   records; POST { design } lays out rows the page already has. */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Body {
  chainId?: string | number;
  prompt?: string;
  history?: Turn[];
  sql?: string;
  /** open one row of an answer into its records */
  drill?: { sql: string; row: Record<string, unknown> };
  /** lay out a kept answer, by its key */
  key?: string;
  /** with key: write the kept layout's reading again from fresh rows */
  reading?: boolean;
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

/** the answer's read while it is fresh, else the kept SQL read again with its names and totals */
async function readOf(key: string, sql: string, chainId: number, baseUrl: string): Promise<Read> {
  const hit = reads.get(key);
  if (hit && Date.now() - hit.at < READ_MS) return hit;
  const run = await anchored(sql, chainId);
  const result = await runQuery(run.sql);
  // the totals read follows the main query and runs beside no other query on stats-api: naming the rows runs none
  const [names, totals] = await Promise.all([nameRows(chainId, result.columns, result.rows, baseUrl), totalsOf(sql, result, chainId)]);
  return { result, names, totals, anchor: run.anchor };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const chainId = Number(body.chainId);
  // the P-Chain's tables key their rows 1 (mainnet) and 5 (Fuji); EVM chains by their chain id
  const chain =
    targetOf(chainId).kind === "pchain"
      ? { chainId: String(chainId), chainName: chainId === 5 ? "P-Chain (Fuji)" : "P-Chain", networkToken: { symbol: "AVAX" } }
      : (l1ChainsData as { chainId: string; chainName: string; networkToken?: { symbol?: string } }[]).find((c) => c.chainId === String(chainId));
  if (!Number.isFinite(chainId) || !chain) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  const symbol = chain.networkToken?.symbol ?? "AVAX";

  const baseUrl = siteBaseUrl();

  // one row of an answer, opened: the records behind it, no model
  if (body.drill && typeof body.drill.sql === "string" && body.drill.row && typeof body.drill.row === "object") {
    const d = drillSql(body.drill.sql, body.drill.row, chainId);
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: 400 });
    try {
      const run = await runKept(d.sql, chainId);
      const result = run.result;
      const names = await nameRows(chainId, result.columns, result.rows, baseUrl);
      return NextResponse.json({ sql: d.sql, result, names, anchor: run.anchor, sources: run.sources });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "drill failed" }, { status: 400 });
    }
  }

  // the reader edited the SQL: run it, no model
  if (typeof body.sql === "string" && !body.prompt) {
    const g = guardSql(body.sql, chainId);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: 400 });
    try {
      // a board's tiles: many readers, one run a minute per query
      const run = await runKept(g.sql, chainId);
      const result = run.result;
      const names = await nameRows(chainId, result.columns, result.rows, baseUrl);
      return NextResponse.json({ sql: g.sql, result, names, anchor: run.anchor, sources: run.sources });
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
      try {
        const { result, names, totals, anchor } = await readOf(body.key, recipe.sql, chainId, baseUrl);
        // the reading is written from the words the page shows, not the ones the recipe kept
        const said = keptWords(recipe, recipe.sql, result.rows, anchor, chainId);
        const callouts = await writeReading({ question: recipe.question, title: said.title, note: said.note, symbol, columns: result.columns, rows: result.rows, names, totals, x: recipe.chart.x, sql: recipe.sql, anchor });
        return NextResponse.json({ callouts, ms: Date.now() - t0 });
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "reading failed" }, { status: 400 });
      }
    }
    if (recipe.visual) return NextResponse.json({ visual: recipe.visual, designer: true, ms: 0 });
    try {
      const { result, names, totals, anchor } = await readOf(body.key, recipe.sql, chainId, baseUrl);
      const said = keptWords(recipe, recipe.sql, result.rows, anchor, chainId);
      const out = await designVisual({ question: recipe.question, title: said.title, note: said.note, symbol, columns: result.columns, rows: result.rows, names, chart: recipe.chart, totals, sql: recipe.sql, anchor });
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
    const out = await designVisual({
      question: String(d.question ?? "").slice(0, 1500),
      title: String(d.title ?? "").slice(0, 200),
      note: String(d.note ?? "").slice(0, 800),
      symbol,
      columns: d.columns.slice(0, 40),
      rows: d.rows.slice(0, 2000),
      names: d.names ?? {},
      chart: d.chart ?? { kind: "table", series: [] },
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

  // "monitor USDT transfers": a live feed of the chain's own moves, read from its RPC block by block. No model and
  // no SQL, so no question is counted and the index's coverage does not matter
  const monitor = await monitorFor(prompt, chainId, symbol, baseUrl);
  if (monitor) {
    const answer: QueryAnswer = { title: monitor.title, note: monitorNote(monitor, chain.chainName), sql: "", chart: { kind: "none", series: [] }, drill: null, result: null, names: {}, visual: null, coverage: null, monitor };
    return new Response(`${JSON.stringify({ type: "answer", answer })}\n`, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  }

  // a chain with no indexed rows has nothing to read; no model is asked
  if ((await indexState(chainId)) === "empty") return NextResponse.json({ error: `${chain.chainName}'s history is not indexed yet, so Query has nothing to read.` }, { status: 404 });

  // the same budget as the chat: model calls are the cost here
  const session = await getAuthSession();
  const isAuthenticated = !!session?.user?.id;
  const limit = checkChatRateLimit(isAuthenticated ? session!.user!.id! : getClientIP(req), isAuthenticated);
  if (!limit.allowed) {
    // signed out, the reader can lift the limit now: the page offers sign-in
    const when = formatResetTime(limit.resetTime);
    return NextResponse.json(
      isAuthenticated
        ? { error: `Question limit reached. Try again ${when}.` }
        : { error: `You have asked ${limit.limit} questions this hour. Sign in to keep asking, or try again ${when}.`, signIn: true },
      { status: 429 },
    );
  }

  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];

  // one JSON event per line: each step as it ends, then the answer or the error
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctl) {
      const emit = (e: QueryEvent) => ctl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const answer = await answerQuestion({ chainId, chainName: chain.chainName, symbol, prompt, history, baseUrl, emit });
        // the rows just read are the ones the layout request designs from
        if (answer?.key && answer.result) keepRead(answer.key, { result: answer.result, names: answer.names, totals: answer.totals ?? null, anchor: answer.anchor ?? null });
        // what the server's tables in the answer cover, for the page to state
        if (answer?.sql && !answer.sources) answer.sources = await sourceNotes(answer.sql, chainId);
        if (answer) emit({ type: "answer", answer });
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : "the query failed", status: 500 });
      } finally {
        ctl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
