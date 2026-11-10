/* the questions a reader may ask next about an answer: what its findings raise, then what its writer (or its fixed
   list) offers. Each is a chip, and a click asks it as a follow-up, which a model answers. */

import type { Finding } from "./findings";

/** the most questions an answer offers */
export const ASKS = 5;

const same = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** the next questions, each once: at most two from the findings, the rest from the answer's own list */
export function nextAsks(findings: readonly Finding[], followups: readonly string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (q: string | undefined) => {
    const key = q ? same(q) : "";
    if (!q || !key || seen.has(key) || out.length >= ASKS) return;
    seen.add(key);
    out.push(q);
  };
  for (const f of findings.filter((f) => f.ask).slice(0, 2)) add(f.ask);
  for (const q of followups ?? []) add(q);
  return out;
}
