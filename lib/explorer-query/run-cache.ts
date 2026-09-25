import "server-only";
import { anchored, runQuery, type QueryResult } from "./clickhouse";

/* SQL with no model in front of it (a tile refreshing, a group opened
   into its records) reads the database through this. The same query on
   the same chain within a minute shares one run, in flight or done, so a
   board many readers open at once costs the database each tile once.
   Kept per server instance; a failed run is never kept. */

const TTL_MS = 60_000;
const MAX = 64;

export interface KeptRun {
  result: QueryResult;
  /** now() was read as this block time, because the index runs behind the clock */
  anchor: string | null;
}

const kept = new Map<string, { at: number; run: Promise<KeptRun> }>();

export function runKept(sql: string, chainId: number): Promise<KeptRun> {
  const key = `${chainId}\n${sql}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.run;
  const run = (async () => {
    const a = await anchored(sql, chainId);
    return { result: await runQuery(a.sql), anchor: a.anchor };
  })();
  kept.delete(key);
  kept.set(key, { at: Date.now(), run });
  run.catch(() => {
    if (kept.get(key)?.run === run) kept.delete(key);
  });
  while (kept.size > MAX) kept.delete(kept.keys().next().value as string);
  return run;
}
