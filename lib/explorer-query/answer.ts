import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { guardSql } from "./guard";
import { runQuery, schemaCard, coverage, coverageText, anchored } from "./clickhouse";
import { chartSpecSchema, drillSchema, type QueryAnswer, type StepTiming, type Turn } from "./types";
import { fillDrill, nameRows } from "./enrich";
import { pchainPrompt, systemPrompt } from "./prompt";
import { targetOf } from "./target";
import { getRecipe, putRecipe, recipeKey } from "./cache";
import { basicVisual } from "./visual";

/* A question in, an answer out. A cached recipe answers at once: its SQL
   runs again for fresh rows and no model is asked. Otherwise a model
   writes the SQL: Haiku for a plain question about one thing, Sonnet
   for comparisons, follow-ups, and anything Haiku could not finish.
   Every step reports as it ends, so the page can show the work. */

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const WRITERS = {
  fast: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", steps: 8 },
  full: { id: "claude-sonnet-5", label: "Sonnet 5", steps: 14 },
} as const;
type Writer = keyof typeof WRITERS;

/** the most records one drill lists */
export const DRILL_ROWS = 100;

/** what the page hears while the answer is made */
export type QueryEvent =
  | { type: "stage"; stage: "cached" | "writing" | "escalated"; writer?: string }
  | ({ type: "step" } & StepTiming)
  | { type: "answer"; answer: QueryAnswer }
  | { type: "error"; error: string; status: number };

const HARD = /\b(compar\w*|vs\.?|versus|previous|prior|before|than|overlay|against|ratio|correlat\w*|relative|join|both|growth|change[sd]?|week over|day over|trend|why|each)\b/i;

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
}

/** the answer, without its layout when none is kept: the page asks for that next */
export async function answerQuestion(a: Ask): Promise<QueryAnswer | null> {
  const key = recipeKey(a.chainId, a.prompt, a.history);
  const t0 = Date.now();

  const recipe = a.fresh ? null : await getRecipe(key);
  if (recipe) {
    a.emit({ type: "stage", stage: "cached", writer: recipe.writer });
    try {
      const run = await anchored(recipe.sql, a.chainId);
      const result = await runQuery(run.sql);
      if (result.rowCount === 0) throw new Error("empty");
      const names = await nameRows(a.chainId, result.columns, result.rows, a.baseUrl);
      const cover = await coverage(a.chainId);
      return {
        anchor: run.anchor,
        title: recipe.title,
        note: recipe.note,
        sql: recipe.sql,
        chart: recipe.chart,
        drill: recipe.drill,
        result,
        names,
        visual: recipe.visual ?? basicVisual(recipe.chart, result.columns),
        draftVisual: !recipe.visual,
        coverage: cover,
        key,
        model: { steps: 0, ms: Date.now() - t0, tries: 0, writer: recipe.writer, cached: true, timings: [] },
      };
    } catch {
      /* the recipe no longer runs (a schema change) or finds nothing now; write it again */
    }
  }

  let schema: string;
  try {
    schema = await schemaCard(a.chainId);
  } catch (e) {
    a.emit({ type: "error", error: `the database is not reachable: ${e instanceof Error ? e.message : String(e)}`, status: 503 });
    return null;
  }
  const cover = await coverage(a.chainId);
  const coverLine = cover ? coverageText(a.chainId, cover) : null;
  const system =
    targetOf(a.chainId).kind === "pchain"
      ? pchainPrompt({ chainId: a.chainId, network: a.chainId === 5 ? "Fuji" : "Mainnet", schema, coverage: coverLine })
      : systemPrompt({ chainId: a.chainId, chainName: a.chainName, symbol: a.symbol, schema, coverage: coverLine });

  // earlier turns, so "make it weekly" refines the last chart
  const messages: ModelMessage[] = [];
  for (const t of a.history.slice(-4)) {
    if (!t?.prompt || !t?.sql) continue;
    messages.push({ role: "user", content: String(t.prompt).slice(0, 1500) });
    messages.push({ role: "assistant", content: `Chart "${String(t.title).slice(0, 120)}" from:\n${String(t.sql).slice(0, 3000)}` });
  }
  messages.push({ role: "user", content: a.prompt });

  const timings: StepTiming[] = [];
  const errors: string[] = [];
  let tries = 0;
  let steps = 0;
  let cacheRead = 0;
  let inputTokens = 0;

  const loop = async (writer: Writer): Promise<QueryAnswer | null> => {
    const w = WRITERS[writer];
    let final: QueryAnswer | null = null;
    let emptyOnce = false;
    // the model's own time on a step is the gap since the last tool finished
    let mark = Date.now();
    const step = (kind: StepTiming["kind"], sqlMs: number, ok: boolean, detail: string) => {
      const s: StepTiming = { n: timings.length + 1, kind, writer: w.label, modelMs: Math.max(0, Date.now() - mark - sqlMs), sqlMs, ok, detail: detail.slice(0, 160) };
      timings.push(s);
      a.emit({ type: "step", ...s });
      mark = Date.now();
    };

    const run_sql = tool({
      description: "Test a query you are unsure of: the first rows and column types, or the database error. Skip it when a worked example fits.",
      inputSchema: z.object({ sql: z.string() }),
      execute: async ({ sql }) => {
        tries += 1;
        const g = guardSql(sql, a.chainId);
        if (!g.ok) {
          errors.push(g.error);
          step("test", 0, false, g.error);
          return { error: g.error };
        }
        const q0 = Date.now();
        try {
          const run = await anchored(`SELECT * FROM (${g.sql.replace(/\nLIMIT \d+$/, "")}) LIMIT 20`, a.chainId);
          const r = await runQuery(run.sql);
          step("test", Date.now() - q0, true, `${r.rowCount} rows`);
          return { columns: r.columns, rows: r.rows, rowCount: r.rowCount, elapsedMs: r.elapsedMs, rowsRead: r.rowsRead };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(msg);
          step("test", Date.now() - q0, false, msg);
          return { error: msg };
        }
      },
    });

    const render_chart = tool({
      description: "Hand back the final query and the chart spec. The server runs the query in full and tests the drill. Returns ok, or the error to fix.",
      inputSchema: z.object({
        title: z.string(),
        note: z.string(),
        sql: z.string(),
        chart: chartSpecSchema,
        drill: drillSchema.optional().describe("how one row opens into its records; required when rows are groups"),
        route: z.enum(["p-chain", "c-chain"]).optional().describe("with kind none: the question belongs to this chain's data instead"),
      }),
      execute: async ({ title, note, sql, chart, drill, route }) => {
        if (chart.kind === "none") {
          final = { title, note, sql: "", chart, drill: null, result: null, names: {}, visual: null, coverage: null, ...(route ? { route } : {}) };
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
        const q0 = Date.now();
        try {
          const run = await anchored(g.sql, a.chainId);
          const result = await runQuery(run.sql);
          // an empty answer is usually a window that misses the data; ask once
          if (result.rowCount === 0 && !emptyOnce) {
            emptyOnce = true;
            return fail(`the query returned no rows. The data runs ${cover ? `${cover.since} to ${cover.until} UTC` : "to the last indexed block"}. Check the window and the filters; call render_chart again unchanged only if no rows is the true answer.`, Date.now() - q0);
          }
          const cols = new Set(result.columns.map((c) => c.name));
          const missing = [chart.x, ...chart.series.map((s) => s.column)].filter((c): c is string => !!c && !cols.has(c));
          if (missing.length) return fail(`chart refers to columns the query does not return: ${missing.join(", ")}`, Date.now() - q0);
          // the drill must work on a real row before the answer ships
          if (drill && result.rows[0]) {
            const d = drillSql(drill.sql, result.rows[0], a.chainId);
            if (!d.ok) return fail(`drill: ${d.error}`, Date.now() - q0);
            try {
              const probe = await runQuery((await anchored(d.sql, a.chainId)).sql.replace(/\bLIMIT\s+\d+\s*$/i, "LIMIT 1"));
              // a drill that opens onto nothing is the "No records matched" a reader hits
              if (probe.rowCount === 0) return fail("drill: it found no records for the first row. Keep the main query's window and filters, and filter on that row's own values (use :bytes for hex ids and addresses).", Date.now() - q0);
            } catch (e) {
              return fail(`drill: ${e instanceof Error ? e.message : String(e)}`, Date.now() - q0);
            }
          }
          final = { title, note, sql: g.sql, chart, drill: drill ?? null, result, names: {}, visual: null, coverage: null, anchor: run.anchor };
          step("final", Date.now() - q0, true, `${result.rowCount} rows`);
          return { ok: true, rows: result.rowCount };
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e), Date.now() - q0);
        }
      },
    });

    const out = await generateText({
      model: anthropic(w.id),
      // the prompt and the tools are the same on every step and every
      // question; the cache mark lets each step after the first skip them
      system: { role: "system", content: system, providerOptions: CACHE },
      messages,
      tools: { run_sql, render_chart },
      stopWhen: [stepCountIs(w.steps), () => final !== null],
      prepareStep: ({ stepNumber, messages: sent }) => {
        // mark the newest turn too, so the next step reads the whole
        // conversation so far from the cache
        const m = [...sent];
        const last = m[m.length - 1];
        if (last && last.role !== "system") m[m.length - 1] = { ...last, providerOptions: { ...last.providerOptions, ...CACHE } } as ModelMessage;
        // near the end of the budget the only move left is to answer
        return { messages: m, ...(stepNumber >= w.steps - 2 && !final ? { activeTools: ["render_chart" as const] } : {}) };
      },
      onStepFinish: () => {
        steps += 1;
      },
    });
    cacheRead += out.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0;
    inputTokens += out.totalUsage.inputTokens ?? 0;
    return final;
  };

  let writer = pickWriter(a.prompt, a.history);
  a.emit({ type: "stage", stage: "writing", writer: WRITERS[writer].label });
  let final: QueryAnswer | null = null;
  try {
    final = await loop(writer);
    if (!final && writer === "fast") {
      writer = "full";
      a.emit({ type: "stage", stage: "escalated", writer: WRITERS.full.label });
      final = await loop("full");
    }
  } catch (e) {
    a.emit({ type: "error", error: `the model failed: ${e instanceof Error ? e.message : String(e)}`, status: 502 });
    return null;
  }

  if (!final) {
    const last = errors.slice(-2).join(" | ");
    a.emit({ type: "error", error: `The query could not be finished.${last ? ` Last database error: ${last.slice(0, 300)}` : ""} Try a narrower question.`, status: 422 });
    return null;
  }
  const done = final as QueryAnswer;
  if (done.result) done.names = await nameRows(a.chainId, done.result.columns, done.result.rows, a.baseUrl);
  done.coverage = cover;
  done.key = key;
  // draw something at once; the page asks the designer for the real layout
  if (done.result) {
    done.visual = basicVisual(done.chart, done.result.columns);
    done.draftVisual = true;
  }
  done.model = { steps, ms: Date.now() - t0, tries, writer: WRITERS[writer].label, cached: false, timings, cacheRead, inputTokens };
  // an answer with no rows is not kept: the next asker may find some
  if (done.result && done.result.rowCount > 0) {
    await putRecipe(key, { question: a.prompt, title: done.title, note: done.note, sql: done.sql, chart: done.chart, drill: done.drill, visual: null, writer: WRITERS[writer].label, at: Date.now() });
  }
  return done;
}
