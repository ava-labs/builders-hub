import "server-only";
import l1ChainsData from "@/constants/l1-chains.json";
import { isPublicRpcUrl } from "@/lib/explorer-rpc";
import { targetOf } from "./target";
import { tokenList } from "./enrich";
import { TRANSFER_TOPIC, mayBeMonitor, parseMonitor, type MonitorItem, type MonitorRead, type MonitorSpec, type TokenMeta } from "./monitor";

/* A monitor's read of its chain (monitor.ts says what a monitor is): the chain's own RPC, block by block. A first
   read covers the last few minutes; each next read starts where the last one ended. One read covers at most
   MAX_BLOCKS, so a page that comes back after longer starts again at the head and says so. Viewers of the same
   monitor share one read for SHARE_MS: the RPC sees one call however many are watching. */

/** about ten minutes of C-Chain blocks; a native read fetches whole blocks, so it opens on fewer */
const OPEN_BLOCKS = 450;
const OPEN_BLOCKS_NATIVE = 150;
const MAX_BLOCKS = 1_000;
const MAX_ITEMS = 2_000;
const SHARE_MS = 2_000;
const TIMEOUT_MS = 8_000;
const BATCH = 50;
const C_CHAIN_PUBLIC = "https://api.avax.network/ext/bc/C/rpc";
const HEX40 = /^0x[0-9a-f]{40}$/;

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  removed?: boolean;
}

interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  transactionIndex: string;
}

interface RpcBlock {
  number: string;
  timestamp: string;
  /** ACP-226 chains stamp their blocks to the millisecond */
  timestampMilliseconds?: string;
  transactions: (RpcTx | string)[];
}

type Call = { method: string; params: unknown[] };

/** the RPC a monitor of this chain reads: our own node for the C-Chain, else the chain's public RPC; null for a
    chain with none, and for the P-Chain, which has no logs to read */
export function monitorRpc(chainId: number): string | null {
  if (targetOf(chainId).kind === "pchain") return null;
  if (chainId === 43114) return process.env.CCHAIN_DEBUG_RPC_URL || C_CHAIN_PUBLIC;
  const c = (l1ChainsData as { chainId: string; rpcUrl?: string; isTestnet?: boolean }[]).find((x) => x.chainId === String(chainId) && x.isTestnet !== true);
  return c && isPublicRpcUrl(c.rpcUrl) ? c.rpcUrl : null;
}

/** calls in batches; a failure never names the RPC, whose URL can carry a token */
async function rpc<T>(url: string, calls: Call[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < calls.length; i += BATCH) {
    const chunk = calls.slice(i, i + BATCH);
    const body = chunk.length === 1 ? { jsonrpc: "2.0", id: 0, ...chunk[0] } : chunk.map((c, j) => ({ jsonrpc: "2.0", id: j, ...c }));
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`the chain's RPC answered ${res.status}`);
    const got = (await res.json()) as unknown;
    const list = (Array.isArray(got) ? got : [got]) as { id: number; result?: T; error?: { message?: string } }[];
    const byId = new Map(list.map((g) => [g.id, g]));
    chunk.forEach((c, j) => {
      const g = byId.get(j);
      if (!g || g.error || g.result === undefined || g.result === null) throw new Error(`the chain's RPC refused ${c.method}${g?.error?.message ? `: ${g.error.message.slice(0, 120)}` : ""}`);
      out.push(g.result);
    });
  }
  return out;
}

const hex = (n: number) => `0x${n.toString(16)}`;
const num = (h: string) => parseInt(h, 16);
const topicOf = (address: string) => `0x${"0".repeat(24)}${address.slice(2)}`;
const addressOf = (topic: string) => `0x${topic.slice(26)}`.toLowerCase();
const timeOf = (b: RpcBlock) => (b.timestampMilliseconds ? num(b.timestampMilliseconds) : num(b.timestamp) * 1000);

/** a raw amount in whole units, to six places */
export function unitsOf(raw: bigint, decimals: number): number {
  if (decimals <= 6) return Number(raw) / 10 ** decimals;
  return Number(raw / 10n ** BigInt(decimals - 6)) / 1e6;
}

/** a spec the page sent back, held to what a monitor may read; null for anything else */
export function checkedSpec(raw: unknown): MonitorSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const chainId = Number(s.chainId);
  if (!Number.isInteger(chainId) || !monitorRpc(chainId)) return null;
  if (s.kind !== "transfers" && s.kind !== "native") return null;
  const addr = (v: unknown) => (typeof v === "string" && HEX40.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
  const spec: MonitorSpec = { chainId, kind: s.kind, title: typeof s.title === "string" ? s.title.slice(0, 160) : "" };
  if (s.token !== undefined) {
    const t = s.token as Record<string, unknown>;
    const address = addr(t?.address);
    const decimals = Number(t?.decimals);
    if (!address || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || typeof t.symbol !== "string" || !/^[\w.$+-]{1,24}$/.test(t.symbol)) return null;
    spec.token = { address, symbol: t.symbol, decimals };
  }
  if (typeof s.coin === "string" && /^[\w.$+-]{1,12}$/.test(s.coin)) spec.coin = s.coin;
  const min = Number(s.minAmount);
  if (s.minAmount !== undefined) {
    if (!Number.isFinite(min) || min < 0 || min > 1e15) return null;
    if (min > 0) spec.minAmount = min;
  }
  for (const k of ["from", "to", "involving"] as const) {
    if (s[k] === undefined) continue;
    const a = addr(s[k]);
    if (!a) return null;
    spec[k] = a;
  }
  // every token's transfers on a whole chain is too much to read: that monitor names an address
  if (spec.kind === "transfers" && !spec.token && !spec.from && !spec.to && !spec.involving) return null;
  return spec;
}

/** the chain's token list with the decimals a monitor scales by; a token the list gives none is left out */
export async function monitorTokens(chainId: number, baseUrl: string): Promise<Map<string, TokenMeta>> {
  const out = new Map<string, TokenMeta>();
  if (chainId !== 43114) return out;
  const list = await tokenList(chainId, baseUrl).catch(() => null);
  for (const [address, t] of list ?? []) {
    // the list's own JSON carries decimals; enrich's type names only what it reads
    const decimals = Number((t as { decimals?: unknown }).decimals);
    if (Number.isInteger(decimals) && decimals >= 0 && decimals <= 36) out.set(address, { symbol: t.symbol, name: t.name, decimals });
  }
  return out;
}

/** the monitor a question asks for on this chain, or null: the token list is read only when the words could be one */
export async function monitorFor(prompt: string, chainId: number, symbol: string, baseUrl: string): Promise<MonitorSpec | null> {
  if (!mayBeMonitor(prompt) || !monitorRpc(chainId)) return null;
  return parseMonitor(prompt, { chainId, symbol }, await monitorTokens(chainId, baseUrl));
}

/** the log filters a transfers monitor reads: an address both ways is two filters */
function filtersOf(spec: MonitorSpec): { address?: string; topics: (string | null)[] }[] {
  const at = spec.token ? { address: spec.token.address } : {};
  if (spec.from) return [{ ...at, topics: [TRANSFER_TOPIC, topicOf(spec.from)] }];
  if (spec.to) return [{ ...at, topics: [TRANSFER_TOPIC, null, topicOf(spec.to)] }];
  if (spec.involving) return [{ ...at, topics: [TRANSFER_TOPIC, topicOf(spec.involving)] }, { ...at, topics: [TRANSFER_TOPIC, null, topicOf(spec.involving)] }];
  return [{ ...at, topics: [TRANSFER_TOPIC] }];
}

async function transfers(url: string, spec: MonitorSpec, start: number, head: number, tokens: Map<string, TokenMeta>): Promise<{ items: MonitorItem[]; headAt: number; fromAt: number }> {
  const range = { fromBlock: hex(start), toBlock: hex(head) };
  const found = (await rpc<RpcLog[]>(url, filtersOf(spec).map((f) => ({ method: "eth_getLogs", params: [{ ...range, ...f }] })))).flat();
  // an ERC-721 Transfer shares the topic and indexes its token id as a fourth topic: only ERC-20 moves count here
  const seen = new Set<string>();
  const logs = found.filter((l) => {
    const k = `${l.transactionHash}:${l.logIndex}`;
    if (l.removed || l.topics.length !== 3 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const heights = [...new Set([head, start, ...logs.map((l) => num(l.blockNumber))])];
  const blocks = await rpc<RpcBlock>(url, heights.map((h) => ({ method: "eth_getBlockByNumber", params: [hex(h), false] })));
  const at = new Map(blocks.map((b) => [num(b.number), timeOf(b)]));
  const items = logs.map((l): MonitorItem => {
    const token = l.address.toLowerCase();
    const meta = spec.token?.address === token ? spec.token : tokens.get(token);
    let amount: number | null = null;
    try {
      amount = meta ? unitsOf(BigInt(l.data === "0x" ? 0 : l.data), meta.decimals) : null;
    } catch {
      amount = null;
    }
    return {
      block: num(l.blockNumber),
      at: at.get(num(l.blockNumber)) ?? 0,
      tx: l.transactionHash,
      index: num(l.logIndex),
      from: addressOf(l.topics[1]),
      to: addressOf(l.topics[2]),
      amount,
      ...(spec.token ? {} : { token, symbol: meta?.symbol }),
    };
  });
  return { items, headAt: at.get(head) ?? 0, fromAt: at.get(start) ?? 0 };
}

async function native(url: string, spec: MonitorSpec, start: number, head: number): Promise<{ items: MonitorItem[]; headAt: number; fromAt: number }> {
  const heights = Array.from({ length: head - start + 1 }, (_, i) => start + i);
  const blocks = await rpc<RpcBlock>(url, heights.map((h) => ({ method: "eth_getBlockByNumber", params: [hex(h), true] })));
  const items: MonitorItem[] = [];
  let headAt = 0;
  let fromAt = 0;
  for (const b of blocks) {
    const block = num(b.number);
    const time = timeOf(b);
    if (block === head) headAt = time;
    if (block === start) fromAt = time;
    for (const t of b.transactions) {
      if (typeof t === "string" || !t.to) continue;
      const raw = BigInt(t.value);
      if (raw === 0n) continue;
      const from = t.from.toLowerCase();
      const to = t.to.toLowerCase();
      if ((spec.from && from !== spec.from) || (spec.to && to !== spec.to) || (spec.involving && from !== spec.involving && to !== spec.involving)) continue;
      items.push({ block, at: time, tx: t.hash, index: num(t.transactionIndex), from, to, amount: unitsOf(raw, 18) });
    }
  }
  return { items, headAt, fromAt };
}

async function freshRead(spec: MonitorSpec, from: number | null, tokens: Map<string, TokenMeta>): Promise<MonitorRead> {
  const url = monitorRpc(spec.chainId);
  if (!url) throw new Error("this chain has no RPC a monitor can read");
  const [headHex] = await rpc<string>(url, [{ method: "eth_blockNumber", params: [] }]);
  const head = num(headHex);
  const open = spec.kind === "native" ? OPEN_BLOCKS_NATIVE : OPEN_BLOCKS;
  let start = from ?? head - open + 1;
  let gap = false;
  // back after longer than one read covers: the last few minutes again, and the page is told
  if (head - start + 1 > MAX_BLOCKS) {
    start = head - open + 1;
    gap = true;
  }
  start = Math.max(0, start);
  if (start > head) return { head, headAt: 0, from: start, fromAt: 0, items: [], gap: false };
  const read = spec.kind === "native" ? await native(url, spec, start, head) : await transfers(url, spec, start, head, tokens);
  const min = spec.minAmount ?? 0;
  const kept = read.items
    .filter((i) => !min || (i.amount !== null && i.amount >= min))
    .sort((a, b) => b.block - a.block || b.index - a.index);
  if (kept.length > MAX_ITEMS) gap = true;
  return { head, headAt: read.headAt, from: start, fromAt: read.fromAt, items: kept.slice(0, MAX_ITEMS), gap };
}

const shared = new Map<string, { at: number; read: Promise<MonitorRead> }>();

/** one read of a monitor; the same read within SHARE_MS is shared */
export function readMonitor(spec: MonitorSpec, from: number | null, tokens: Map<string, TokenMeta> = new Map()): Promise<MonitorRead> {
  const { title: _title, ...what } = spec;
  const key = `${JSON.stringify(what)}:${from ?? "open"}`;
  const now = Date.now();
  const hit = shared.get(key);
  if (hit && now - hit.at < SHARE_MS) return hit.read;
  for (const [k, v] of shared) if (now - v.at >= SHARE_MS) shared.delete(k);
  const read = freshRead(spec, from, tokens);
  shared.set(key, { at: now, read });
  read.catch(() => shared.delete(key));
  return read;
}
