import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/explorer-query/answer";
import { getRecipe, putVisual, recipeKey } from "@/lib/explorer-query/cache";
import { designVisual } from "@/lib/explorer-query/visual";
import { EXAMPLE_PROMPTS } from "@/lib/explorer-query/examples";
import { siteBaseUrl } from "@/lib/chat/site-url";

/* Answers the suggested questions ahead of readers, so a first click on
   one only runs its SQL. Runs daily from vercel.json; a question whose
   recipe is already kept, with its layout, is skipped. */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHAIN = { chainId: 43114, chainName: "Avalanche C-Chain", symbol: "AVAX" };
/** stop taking new questions this long before the function is cut off */
const BUDGET_MS = 240_000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  const baseUrl = siteBaseUrl();
  const report: { prompt: string; outcome: string; ms: number }[] = [];
  for (const prompt of EXAMPLE_PROMPTS) {
    if (Date.now() - t0 > BUDGET_MS) {
      report.push({ prompt, outcome: "skipped: out of time", ms: 0 });
      continue;
    }
    const s0 = Date.now();
    const kept = await getRecipe(recipeKey(CHAIN.chainId, prompt));
    if (kept?.visual) {
      report.push({ prompt, outcome: "kept", ms: 0 });
      continue;
    }
    let failed = "";
    const answer = await answerQuestion({ ...CHAIN, prompt, history: [], baseUrl, emit: (e) => e.type === "error" && (failed = e.error) });
    if (!answer?.result || !answer.key) {
      report.push({ prompt, outcome: `failed: ${failed || "no rows"}`, ms: Date.now() - s0 });
      continue;
    }
    const d = await designVisual({ question: prompt, title: answer.title, note: answer.note, symbol: CHAIN.symbol, columns: answer.result.columns, rows: answer.result.rows, names: answer.names, chart: answer.chart });
    if (d.fromDesigner) await putVisual(answer.key, d.visual);
    report.push({ prompt, outcome: d.fromDesigner ? `answered by ${answer.model?.writer}` : "answered, layout failed", ms: Date.now() - s0 });
  }
  return NextResponse.json({ ms: Date.now() - t0, report });
}
