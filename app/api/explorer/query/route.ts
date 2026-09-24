import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import l1ChainsData from "@/constants/l1-chains.json";
import { guardSql } from "@/lib/explorer-query/guard";
import { runQuery, schemaCard, coverage, coverageText, type ColumnMeta } from "@/lib/explorer-query/clickhouse";
import { chartSpecSchema, drillSchema, type QueryAnswer, type Turn } from "@/lib/explorer-query/types";
import { enrichNames, fillDrill } from "@/lib/explorer-query/enrich";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { designVisual } from "@/lib/explorer-query/visual";
import type { ChartSpec, Names } from "@/lib/explorer-query/types";
import { systemPrompt } from "@/lib/explorer-query/prompt";
import { checkChatRateLimit, getClientIP } from "@/lib/chat/rateLimit";
import { getAuthSession } from "@/lib/auth/authSession";

/* A question in, a chart out. The model writes one guarded ClickHouse
   SELECT and a chart spec; the server runs the query and returns the
   rows with the SQL that made them, so every figure on the chart can be
   audited and re-run by hand. POST { chainId, prompt, history? } asks
   the model; POST { chainId, sql } re-runs a query the reader edited. */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// two models, two jobs: Sonnet turns the question into SQL and a drill;
// Opus (lib/explorer-query/visual.ts) then designs how the rows are shown
const MODEL = "claude-sonnet-5";
/** the most records one drill lists */
const DRILL_ROWS = 100;
// comparisons and joins can take several test runs; the last two steps
// may only hand back an answer, so the loop always ends with one
const MAX_STEPS = 14;

interface Body {
  chainId?: string | number;
  prompt?: string;
  history?: Turn[];
  sql?: string;
  /** open one row of an answer into its records */
  drill?: { sql: string; row: Record<string, unknown> };
  /** answer with the data and a basic layout; the page asks for the design next */
  skipDesign?: boolean;
  /** lay out rows the page already has */
  design?: { question: string; title: string; note: string; columns: ColumnMeta[]; rows: Record<string, unknown>[]; names: Names; chart: ChartSpec };
}

/** a drill template filled from one row, guarded, capped */
function drillSql(template: string, row: Record<string, unknown>, chainId: number): { ok: true; sql: string } | { ok: false; error: string } {
  const filled = fillDrill(template, row);
  if (!filled.ok) return filled;
  const g = guardSql(filled.sql, chainId);
  if (!g.ok) return g;
  const sql = g.sql.replace(/\bLIMIT\s+(\d+)\s*$/i, (_m, n: string) => `LIMIT ${Math.min(Number(n), DRILL_ROWS)}`);
  return { ok: true, sql };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const chainId = Number(body.chainId);
  const chain = (l1ChainsData as { chainId: string; chainName: string; networkToken?: { symbol?: string } }[]).find((c) => c.chainId === String(chainId));
  if (!Number.isFinite(chainId) || !chain) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  const symbol = chain.networkToken?.symbol ?? "AVAX";

  const baseUrl = siteBaseUrl();

  // one row of an answer, opened: the records behind it, no model
  if (body.drill && typeof body.drill.sql === "string" && body.drill.row && typeof body.drill.row === "object") {
    const d = drillSql(body.drill.sql, body.drill.row, chainId);
    if (!d.ok) return NextResponse.json({ error: d.error }, { status: 400 });
    try {
      const result = await runQuery(d.sql);
      const names = await enrichNames(chainId, result.columns, result.rows, baseUrl);
      return NextResponse.json({ sql: d.sql, result, names });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "drill failed" }, { status: 400 });
    }
  }

  // the reader edited the SQL: run it, no model
  if (typeof body.sql === "string" && !body.prompt) {
    const g = guardSql(body.sql, chainId);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: 400 });
    try {
      const result = await runQuery(g.sql);
      const names = await enrichNames(chainId, result.columns, result.rows, baseUrl);
      return NextResponse.json({ sql: g.sql, result, names });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "query failed" }, { status: 400 });
    }
  }

  // the second phase: the designer lays out rows the page already drew
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
    return NextResponse.json({ visual: out.visual, designer: out.fromDesigner, ms: out.ms, error: out.fromDesigner ? undefined : out.error });
  }

  const prompt = String(body.prompt ?? "").trim().slice(0, 1500);
  if (!prompt) return NextResponse.json({ error: "empty prompt" }, { status: 400 });

  // the same budget as the chat: model calls are the cost here
  const session = await getAuthSession();
  const isAuthenticated = !!session?.user?.id;
  const limit = checkChatRateLimit(isAuthenticated ? session!.user!.id! : getClientIP(req), isAuthenticated);
  if (!limit.allowed) return NextResponse.json({ error: "rate limit reached; try again later" }, { status: 429 });

  let schema: string;
  try {
    schema = await schemaCard();
  } catch (e) {
    return NextResponse.json({ error: `the database is not reachable: ${e instanceof Error ? e.message : String(e)}` }, { status: 503 });
  }
  const cover = await coverage(chainId);
  const system = systemPrompt({ chainId, chainName: chain.chainName, symbol, schema, coverage: cover ? coverageText(chainId, cover) : null });

  // earlier turns, so "make it weekly" refines the last chart
  const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
  const messages: ModelMessage[] = [];
  for (const t of history) {
    if (!t?.prompt || !t?.sql) continue;
    messages.push({ role: "user", content: String(t.prompt).slice(0, 1500) });
    messages.push({ role: "assistant", content: `Chart "${String(t.title).slice(0, 120)}" from:\n${String(t.sql).slice(0, 3000)}` });
  }
  messages.push({ role: "user", content: prompt });

  let final: QueryAnswer | null = null;
  let tries = 0;
  const errors: string[] = [];
  const t0 = Date.now();

  const run_sql = tool({
    description: "Run a candidate query and see the first rows and column types, or the database error. Use it to test before render_chart.",
    inputSchema: z.object({ sql: z.string() }),
    execute: async ({ sql }) => {
      tries += 1;
      const g = guardSql(sql, chainId);
      if (!g.ok) {
        errors.push(g.error);
        return { error: g.error };
      }
      try {
        const r = await runQuery(`SELECT * FROM (${g.sql.replace(/\nLIMIT \d+$/, "")}) LIMIT 20`);
        return { columns: r.columns, rows: r.rows, rowCount: r.rowCount, elapsedMs: r.elapsedMs, rowsRead: r.rowsRead };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        return { error: msg };
      }
    },
  });

  const render_chart = tool({
    description: "Hand back the final query and the chart spec. The server runs the query in full and draws it. Returns ok, or the error to fix.",
    inputSchema: z.object({
      title: z.string(),
      note: z.string(),
      sql: z.string(),
      chart: chartSpecSchema,
      drill: drillSchema.optional().describe("how one row opens into its records; required when rows are groups"),
    }),
    execute: async ({ title, note, sql, chart, drill }) => {
      if (chart.kind === "none") {
        final = { title, note, sql: "", chart, drill: null, result: null, names: {}, visual: null, coverage: null };
        return { ok: true };
      }
      const g = guardSql(sql, chainId);
      if (!g.ok) return { error: g.error };
      try {
        const result = await runQuery(g.sql);
        const cols = new Set(result.columns.map((c) => c.name));
        const missing = [chart.x, ...chart.series.map((s) => s.column)].filter((c): c is string => !!c && !cols.has(c));
        if (missing.length) return { error: `chart refers to columns the query does not return: ${missing.join(", ")}` };
        // the drill must work on a real row before the answer ships
        if (drill && result.rows[0]) {
          const d = drillSql(drill.sql, result.rows[0], chainId);
          if (!d.ok) return { error: `drill: ${d.error}` };
          try {
            await runQuery(d.sql.replace(/\bLIMIT\s+\d+\s*$/i, "LIMIT 1"));
          } catch (e) {
            return { error: `drill: ${e instanceof Error ? e.message : String(e)}` };
          }
        }
        final = { title, note, sql: g.sql, chart, drill: drill ?? null, result, names: {}, visual: null, coverage: null };
        return { ok: true, rows: result.rowCount };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    },
  });

  let steps = 0;
  let text = "";
  try {
    const out = await generateText({
      model: anthropic(MODEL),
      system,
      messages,
      tools: { run_sql, render_chart },
      stopWhen: [stepCountIs(MAX_STEPS), () => final !== null],
      // near the end of the budget the only move left is to answer
      prepareStep: ({ stepNumber }) => (stepNumber >= MAX_STEPS - 2 && !final ? { activeTools: ["render_chart"] } : undefined),
      onStepFinish: () => {
        steps += 1;
      },
    });
    text = out.text;
  } catch (e) {
    return NextResponse.json({ error: `the model failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  if (!final) {
    const last = errors.slice(-2).join(" | ");
    return NextResponse.json(
      { error: `The query could not be finished in ${MAX_STEPS} steps.${last ? ` Last database error: ${last.slice(0, 300)}` : ""} Try a narrower question.`, text: text.slice(0, 600) },
      { status: 422 },
    );
  }
  const done = final as QueryAnswer;
  const sqlMs = Date.now() - t0;
  let designMs = 0;
  let designer = false;
  let designError: string | undefined;
  if (done.result) {
    done.names = await enrichNames(chainId, done.result.columns, done.result.rows, baseUrl);
  }
  done.coverage = cover;
  if (done.result && body.skipDesign) {
    done.visual = null;
  } else if (done.result) {
    const d = await designVisual({ question: prompt, title: done.title, note: done.note, symbol, columns: done.result.columns, rows: done.result.rows, names: done.names, chart: done.chart });
    done.visual = d.visual;
    designMs = d.ms;
    designer = d.fromDesigner;
    designError = d.error;
  }
  const answer: QueryAnswer = { ...done, model: { steps, ms: sqlMs, tries, designMs, designer, designError } };
  return NextResponse.json(answer);
}
