/* Query's Claude models, metered. A model made with a spend sink reports
   each of its calls (one step of a generateText run) there: its time and
   its tokens as Anthropic counts them, the uncached input apart from the
   cache's reads and writes. The route sends that spend to PostHog
   (analytics.ts). This file stays free of server-only imports: the
   designer's module (visual.ts) is in the page's bundle too. */

import { createAnthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel } from "ai";

/** one model call: its model, its time, and its tokens; a failed call reports its error and no tokens */
export interface ModelCall {
  model: string;
  ms: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  error?: string;
}

const provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** a Claude model for Query; with spent, each of its calls reports there */
export function anthropic(id: string, spent?: (call: ModelCall) => void) {
  if (!spent) return provider(id);
  return wrapLanguageModel({
    model: provider(id),
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: async ({ doGenerate }) => {
        const t0 = Date.now();
        try {
          const out = await doGenerate();
          const { inputTokens: i, outputTokens: o } = out.usage;
          const cacheRead = i.cacheRead ?? 0;
          const cacheWrite = i.cacheWrite ?? 0;
          spent({ model: id, ms: Date.now() - t0, input: i.noCache ?? Math.max(0, (i.total ?? 0) - cacheRead - cacheWrite), cacheRead, cacheWrite, output: o.total ?? 0 });
          return out;
        } catch (e) {
          spent({ model: id, ms: Date.now() - t0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) });
          throw e;
        }
      },
    },
  });
}
