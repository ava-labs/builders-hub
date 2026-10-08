import { catalogOf } from "@/lib/explorer-catalog";
import { getGasHistory, type GasHistoryDays } from "@/lib/explorer-clickhouse";
import { targetOf, type TargetHeader } from "@/lib/gas-target-math";

/* The ACP-176 target per UTC day for one chain, from its own headers. The
   target can move block by block, so each day reads the header at its first
   block and at the next day's first block and takes the mean. Day starts come
   from the daily block counts, counted back from the head. A finished day's
   start never changes, so its target is kept for the life of the process. */

export interface GasTargetDay {
  /** ISO date */
  d: string;
  /** mean target over the day, gas per second */
  target: number;
}

interface Header extends TargetHeader {
  number: string;
}

const RPC_TIMEOUT_MS = 6_000;
const CONCURRENCY = 8;
const startTargets = new Map<string, number>();

function rpcUrlOf(evmChainId: number): string | undefined {
  const id = String(evmChainId);
  return (catalogOf("mainnet").get(id) ?? catalogOf("fuji").get(id))?.rpcUrl;
}

async function header(rpcUrl: string, tag: string): Promise<Header | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [tag, false] }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: Header | null };
    return body.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function inBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    out.push(...(await Promise.all(items.slice(i, i + CONCURRENCY).map(fn))));
  }
  return out;
}

/** null when the chain has no RPC in the catalog or prices without ACP-176 */
export async function getGasTargets(evmChainId: number, days: GasHistoryDays): Promise<GasTargetDay[] | null> {
  const rpcUrl = rpcUrlOf(evmChainId);
  if (!rpcUrl) return null;
  const head = await header(rpcUrl, "latest");
  const headTarget = head ? targetOf(head, evmChainId) : null;
  if (!head || headTarget === null) return null;

  const daily = await getGasHistory(evmChainId, days);
  if (!daily.length) return null;

  // each day's first block, walking back from the head
  const today = new Date().toISOString().slice(0, 10);
  const starts: number[] = new Array(daily.length);
  let next = parseInt(head.number, 16) + 1;
  for (let i = daily.length - 1; i >= 0; i--) {
    next -= daily[i].blocks;
    starts[i] = Math.max(0, next);
  }

  const atStart = await inBatches(daily.map((row, i) => ({ row, start: starts[i] })), async ({ row, start }) => {
    const key = `${evmChainId}:${row.d}`;
    const kept = startTargets.get(key);
    if (kept !== undefined) return kept;
    const h = await header(rpcUrl, `0x${start.toString(16)}`);
    const t = h ? targetOf(h, evmChainId) : null;
    if (t !== null && row.d < today) startTargets.set(key, t);
    return t;
  });

  const out: GasTargetDay[] = [];
  daily.forEach((row, i) => {
    const from = atStart[i];
    const to = i + 1 < daily.length ? atStart[i + 1] : headTarget;
    if (from === null && to === null) return;
    out.push({ d: row.d, target: from !== null && to !== null ? (from + to) / 2 : (from ?? to)! });
  });
  return out;
}
