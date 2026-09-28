import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/explorer-query/answer";
import { getRecipe, putVisual, recipeKey } from "@/lib/explorer-query/cache";
import { designVisual } from "@/lib/explorer-query/visual";
import { EXAMPLE_PROMPTS, PCHAIN_EXAMPLES } from "@/lib/explorer-query/examples";
import { siteBaseUrl } from "@/lib/chat/site-url";
import { fixedRecipe } from "@/lib/explorer-query/fixed";

/* Answers the suggested questions ahead of readers, so a first click on
   one only runs its SQL: the C-Chain's and the P-Chain's, since the
   city's chips ask both. Runs daily from vercel.json. A kept recipe runs
   again: while it finds rows and has its layout, the question is done;
   when it no longer runs or finds nothing, the engine writes it again
   here, not on a reader's first click. The chains take turns, so a cold
   cache fills on both, and one question runs at a time. Each line of the
   report counts the question's steps, the failed ones, and the ones the
   guard refused because they had no time bound. */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CCHAIN = { chainId: 43114, chainName: "Avalanche C-Chain", symbol: "AVAX" };
const PCHAIN = { chainId: 1, chainName: "P-Chain", symbol: "AVAX" };
const PCHAIN_PROMPTS = PCHAIN_EXAMPLES.flatMap((g) => g.items.map((i) => i.q));
/** the two chains' questions, in turns; a question with fixed SQL (fixed.ts) needs no warming */
const QUEUE = Array.from({ length: Math.max(EXAMPLE_PROMPTS.length, PCHAIN_PROMPTS.length) }, (_, i) => [
  ...(i < EXAMPLE_PROMPTS.length ? [{ chain: CCHAIN, prompt: EXAMPLE_PROMPTS[i] }] : []),
  ...(i < PCHAIN_PROMPTS.length ? [{ chain: PCHAIN, prompt: PCHAIN_PROMPTS[i] }] : []),
]).flat().filter(({ chain, prompt }) => !fixedRecipe(chain.chainId, prompt));
/** stop taking new questions after this long, so the slowest answer seen (about 160 s) still ends before the cutoff at 300 s */
const BUDGET_MS = 140_000;
/** the guard's refusal of a wide table read with no time or height bound */
const UNBOUND = /^bound\b/i;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  const baseUrl = siteBaseUrl();
  const report: { chain: string; prompt: string; outcome: string; ms: number; steps: number; failed: number; bound: number }[] = [];
  for (const { chain, prompt } of QUEUE) {
    const line = { chain: chain.chainName, prompt, steps: 0, failed: 0, bound: 0 };
    if (Date.now() - t0 > BUDGET_MS) {
      report.push({ ...line, outcome: "skipped: out of time", ms: 0 });
      continue;
    }
    const s0 = Date.now();
    const kept = await getRecipe(recipeKey(chain.chainId, prompt));
    let error = "";
    const answer = await answerQuestion({
      ...chain,
      prompt,
      history: [],
      baseUrl,
      emit: (e) => {
        if (e.type === "error") error = e.error;
        if (e.type !== "step") return;
        line.steps += 1;
        if (!e.ok) line.failed += 1;
        if (!e.ok && UNBOUND.test(e.detail)) line.bound += 1;
      },
    });
    if (!answer?.result || !answer.key) {
      report.push({ ...line, outcome: `failed: ${error || "no rows"}`, ms: Date.now() - s0 });
      continue;
    }
    // the kept recipe ran, found rows and has its layout: nothing to write
    if (answer.model?.cached && kept?.visual) {
      report.push({ ...line, outcome: "kept", ms: Date.now() - s0 });
      continue;
    }
    const d = await designVisual({ question: prompt, title: answer.title, note: answer.note, symbol: chain.symbol, columns: answer.result.columns, rows: answer.result.rows, names: answer.names, chart: answer.chart, totals: answer.totals, sql: answer.sql, anchor: answer.anchor });
    if (d.fromDesigner) await putVisual(answer.key, d.visual);
    const how = answer.model?.cached ? "kept, laid out" : `answered by ${answer.model?.writer}`;
    report.push({ ...line, outcome: d.fromDesigner ? how : `${how}, layout failed`, ms: Date.now() - s0 });
  }
  return NextResponse.json({ ms: Date.now() - t0, report });
}
