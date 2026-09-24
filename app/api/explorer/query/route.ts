import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import l1ChainsData from "@/constants/l1-chains.json";
import { guardSql } from "@/lib/explorer-query/guard";
import { runQuery, schemaCard, coverage } from "@/lib/explorer-query/clickhouse";
import { chartSpecSchema, type QueryAnswer, type Turn } from "@/lib/explorer-query/types";
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
const MODEL = "claude-sonnet-5";
const MAX_STEPS = 8;

interface Body {
  chainId?: string | number;
  prompt?: string;
  history?: Turn[];
  sql?: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const chainId = Number(body.chainId);
  const chain = (l1ChainsData as { chainId: string; chainName: string; networkToken?: { symbol?: string } }[]).find((c) => c.chainId === String(chainId));
  if (!Number.isFinite(chainId) || !chain) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  const symbol = chain.networkToken?.symbol ?? "AVAX";

  // the reader edited the SQL: run it, no model
  if (typeof body.sql === "string" && !body.prompt) {
    const g = guardSql(body.sql, chainId);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: 400 });
    try {
      const result = await runQuery(g.sql);
      return NextResponse.json({ sql: g.sql, result });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "query failed" }, { status: 400 });
    }
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
  const system = systemPrompt({ chainId, chainName: chain.chainName, symbol, schema, coverage: cover });

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
  const t0 = Date.now();

  const run_sql = tool({
    description: "Run a candidate query and see the first rows and column types, or the database error. Use it to test before render_chart.",
    inputSchema: z.object({ sql: z.string() }),
    execute: async ({ sql }) => {
      tries += 1;
      const g = guardSql(sql, chainId);
      if (!g.ok) return { error: g.error };
      try {
        const r = await runQuery(`SELECT * FROM (${g.sql.replace(/\nLIMIT \d+$/, "")}) LIMIT 20`);
        return { columns: r.columns, rows: r.rows, rowCount: r.rowCount, elapsedMs: r.elapsedMs, rowsRead: r.rowsRead };
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
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
    }),
    execute: async ({ title, note, sql, chart }) => {
      if (chart.kind === "none") {
        final = { title, note, sql: "", chart, result: null };
        return { ok: true };
      }
      const g = guardSql(sql, chainId);
      if (!g.ok) return { error: g.error };
      try {
        const result = await runQuery(g.sql);
        const cols = new Set(result.columns.map((c) => c.name));
        const missing = [chart.x, ...chart.series.map((s) => s.column)].filter((c): c is string => !!c && !cols.has(c));
        if (missing.length) return { error: `chart refers to columns the query does not return: ${missing.join(", ")}` };
        final = { title, note, sql: g.sql, chart, result };
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
      stopWhen: [stepCountIs(MAX_STEPS)],
      onStepFinish: () => {
        steps += 1;
      },
    });
    text = out.text;
  } catch (e) {
    return NextResponse.json({ error: `the model failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  if (!final) {
    return NextResponse.json({ error: "no chart came back", text: text.slice(0, 600) }, { status: 422 });
  }
  const answer: QueryAnswer = { ...(final as QueryAnswer), model: { steps, ms: Date.now() - t0, tries } };
  return NextResponse.json(answer);
}
