import "server-only";
import { chainRpc } from "./head";
import { tokenList } from "./enrich";
import { TRANSFER_TOPIC, addressesOf, mayBeEvents, mayBeMonitor, minAmountOf, monitorWords, parseMonitor, tokenOf, type MonitorItem, type MonitorRead, type MonitorSpec, type MonitorToken, type TokenMeta } from "./monitor";
import { MONITOR_CHAIN_ID, MONITOR_EVENTS, decodeMonitorLog, eventsFor, fitsMonitorLog, type MonitorEventDef } from "./monitor-events";

/* A monitor's read of its chain (monitor.ts says what a monitor is): the chain's own RPC, block by block. A first
   read covers the last few minutes; each next read starts where the last one ended. One read covers at most
   MAX_BLOCKS, so a page that comes back after longer starts again at the head and says so. Viewers of the same
   monitor share one read for SHARE_MS: the RPC sees one call however many are watching. An events monitor reads
   the DeFi catalog's logs (monitor-events.ts), and tells a pool's protocol by its factory, asked once per pool. */

/** ten minutes of C-Chain blocks and a little more (at 1.2 s a block); a native read fetches whole blocks, so it
    opens on fewer */
const OPEN_BLOCKS = 500;
const OPEN_BLOCKS_NATIVE = 150;
const MAX_BLOCKS = 1_000;
const MAX_ITEMS = 2_000;
const SHARE_MS = 2_000;
const TIMEOUT_MS = 8_000;
const BATCH = 50;
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
type Answer<T> = { result?: T | null; error?: { message?: string } } | undefined;

/** the RPC a monitor of this chain reads: our own node for the C-Chain, else the chain's public RPC; null for a
    chain with none, and for the P-Chain, which has no logs to read */
export function monitorRpc(chainId: number): string | null {
  return chainRpc(chainId);
}

/** each call's answer, in batches; a failure never names the RPC, whose URL can carry a token */
async function answers<T>(url: string, calls: Call[]): Promise<Answer<T>[]> {
  const out: Answer<T>[] = [];
  for (let i = 0; i < calls.length; i += BATCH) {
    const chunk = calls.slice(i, i + BATCH);
    const body = chunk.length === 1 ? { jsonrpc: "2.0", id: 0, ...chunk[0] } : chunk.map((c, j) => ({ jsonrpc: "2.0", id: j, ...c }));
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) throw new Error(`the chain's RPC answered ${res.status}`);
    const got = (await res.json()) as unknown;
    const list = (Array.isArray(got) ? got : [got]) as ({ id: number } & NonNullable<Answer<T>>)[];
    const byId = new Map(list.map((g) => [g.id, g]));
    chunk.forEach((_, j) => out.push(byId.get(j)));
  }
  return out;
}

/** calls in batches, every one of which must answer */
async function rpc<T>(url: string, calls: Call[]): Promise<T[]> {
  return (await answers<T>(url, calls)).map((g, i) => {
    if (!g || g.error || g.result === undefined || g.result === null) throw new Error(`the chain's RPC refused ${calls[i].method}${g?.error?.message ? `: ${g.error.message.slice(0, 120)}` : ""}`);
    return g.result;
  });
}

/** calls in batches where a revert is an answer too: null */
async function rpcOrNull<T>(url: string, calls: Call[]): Promise<(T | null)[]> {
  return (await answers<T>(url, calls)).map((g) => (g && !g.error && g.result !== undefined ? g.result : null));
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
  if (s.kind !== "transfers" && s.kind !== "native" && s.kind !== "events") return null;
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
  // an events monitor names catalog events, each once, on the C-Chain the catalog describes
  if (spec.kind === "events") {
    const keys = Array.isArray(s.events) ? s.events : [];
    if (chainId !== MONITOR_CHAIN_ID || !keys.length || keys.length > MAX_EVENTS || new Set(keys).size !== keys.length || !keys.every((k) => typeof k === "string" && EVENT_DEFS.has(k))) return null;
    spec.events = keys as string[];
    if (typeof s.unit === "string" && /^[\w.$+-]{1,24}$/.test(s.unit)) spec.unit = s.unit;
  }
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

/** the monitor a question asks for on this chain, or null: the token list is read only when the words could be one.
    DeFi events come first: "monitor wavax wraps" is WAVAX's Deposit logs, not its transfers */
export async function monitorFor(prompt: string, chainId: number, symbol: string, baseUrl: string): Promise<MonitorSpec | null> {
  if (!(mayBeMonitor(prompt) || mayBeEvents(prompt)) || !monitorRpc(chainId)) return null;
  const tokens = await monitorTokens(chainId, baseUrl);
  return eventsMonitor(prompt, chainId, tokens) ?? parseMonitor(prompt, { chainId, symbol }, tokens);
}

/* ------------------------------------------------------------------ */
/* DeFi events: the catalog's logs on the C-Chain                       */

/** the catalog's events by key: what an events monitor may read */
const EVENT_DEFS = new Map(MONITOR_EVENTS.map((d) => [d.key, d]));
/** the most events one monitor reads: every DEX's swaps is 18 */
const MAX_EVENTS = 24;
/** a busy events monitor (every DEX's swaps) opens on more rows than one token's transfers */
const MAX_EVENT_ITEMS = 5_000;
const NATIVE = "0x0000000000000000000000000000000000000000";
const ADDRESS = /0x[0-9a-fA-F]{40}\b/g;
/** words no token filter is read from, though a token may have one of them as its symbol */
const PLAIN = new Set(["the", "and", "for", "all", "any", "new", "big", "top", "live", "over", "from", "into", "with", "each", "every", "real", "time", "large", "largest"]);
/** the pool checks' calls: factory() and getFactory() on a pool, isPair(address) on a Solidly factory */
const FACTORY = "0xc45a0155";
const GET_FACTORY = "0x88cc58e4";
const IS_PAIR = "0xe5e31b13";
/** each pool's factory (null where no getter answers), and each Solidly factory's pairs, for the life of the
    server: a pool never changes its factory. At most MAX_POOLS of each, the oldest going first */
const factoryOf = new Map<string, string | null>();
const pairOf = new Map<string, boolean>();
const MAX_POOLS = 50_000;
function remember<V>(m: Map<string, V>, k: string, v: V) {
  if (m.size >= MAX_POOLS) m.delete(m.keys().next().value as string);
  m.set(k, v);
}

/** what an event's label says after its protocol: "flash loans" of "Aave v3 flash loans" */
const kindOf = (d: MonitorEventDef) => (d.label.startsWith(d.protocol) ? d.label.slice(d.protocol.length).trim() : d.label) || d.label;
const lastWord = (t: string) => t.split(/\s+/).at(-1) ?? t;
const listed = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
/** the words every kind begins with: "sAVAX" of "sAVAX stakes" and "sAVAX redemptions" */
function leading(kinds: string[]): string {
  const split = kinds.map((k) => k.split(/\s+/));
  const out: string[] = [];
  for (let i = 0; split.every((w) => i < w.length - 1 && w[i] === split[0][i]); i++) out.push(split[0][i]);
  return out.join(" ");
}

/** the card's name for a set of events: its one label; "Pharaoh swaps"; "Liquidations on Aave v3 and Benqi"; over
    protocols whose events have different names, the reader's own word for them ("Deposits on 6 protocols") */
export function eventsTitle(defs: MonitorEventDef[], asked?: string): string {
  if (defs.length === 1) return defs[0].label;
  const protocols = [...new Set(defs.map((d) => d.protocol))];
  const kinds = [...new Set(defs.map(kindOf))];
  const words = [...new Set(kinds.map(lastWord))];
  if (protocols.length === 1) {
    const [p] = protocols;
    if (words.length === 1) return `${p} ${words[0]}`;
    if (kinds.length <= 3) return `${p} ${listed(kinds)}`;
    const common = leading(kinds);
    return words.length <= 3 ? `${p}${common ? ` ${common}` : ""} ${listed(words)}` : `${p}${common ? ` ${common}` : ""} activity`;
  }
  const where = protocols.length <= 3 ? listed(protocols) : `${protocols.length} protocols`;
  const word = words.length === 1 ? words[0] : asked;
  return word ? `${word[0].toUpperCase()}${word.slice(1)} on ${where}` : `DeFi activity on ${where}`;
}

/** a row's name for its event: its label in the singular, less the protocol when the monitor reads one ("Repayment"
    under "Aave v3 activity", "Pangolin v3 swap" under "Swaps on 8 protocols") */
function rowLabel(d: MonitorEventDef, oneProtocol: boolean): string {
  const t = (oneProtocol ? kindOf(d) : d.label).replace(/ies$/, "y").replace(/(?<!s)s$/, "");
  // "repayment" takes a capital; a name with its own ("sAVAX unlock request") keeps it
  return /^[a-z]+[A-Z]/.test(t) ? t : `${t[0].toUpperCase()}${t.slice(1)}`;
}

const symbolOf = (token: string, tokens: Map<string, TokenMeta>) => (token === NATIVE ? "AVAX" : tokens.get(token)?.symbol);

/** the DeFi events the words ask for, as a monitor: "monitor aave liquidations", "watch pharaoh swaps", "live sAVAX
    staking". Mainnet C-Chain only. Any token's ERC-20 Transfer is not one: a transfers monitor reads one token's,
    or one address's. A token the words name beside events whose token varies keeps the rows in it: "usdc supplies
    on aave" */
export function eventsMonitor(prompt: string, chainId: number, tokens: Map<string, TokenMeta>): MonitorSpec | null {
  if (chainId !== MONITOR_CHAIN_ID || !mayBeEvents(prompt)) return null;
  const rest = monitorWords(prompt);
  const bare = rest.replace(ADDRESS, " ");
  const defs = eventsFor(bare).filter((d) => d.key !== "erc-20/transfer");
  if (!defs.length || defs.length > MAX_EVENTS) return null;
  // a token named apart from the events' own names, for events whose amounts can be in any token
  const own = new Set(defs.flatMap((d) => `${d.label} ${d.protocol}`.toLowerCase().split(/[^a-z0-9.]+/)));
  const varies = defs.every((d) => d.amount && !d.amount.token);
  let token: MonitorToken | null = null;
  if (varies)
    for (const w of bare.toLowerCase().split(/[^a-z0-9.]+/)) {
      if (w.length < 3 || PLAIN.has(w) || own.has(w)) continue;
      token = tokenOf(w, chainId, tokens);
      if (token) break;
    }
  // one unit for the figures: the named token, or the one token every event's amount is in
  const fixed = [...new Set(defs.map((d) => (d.amount ? (d.amount.token ?? "") : "-")))];
  const unit = token?.symbol ?? (fixed.length === 1 && fixed[0] !== "" && fixed[0] !== "-" ? symbolOf(fixed[0], tokens) : undefined);
  const spec: MonitorSpec = { chainId, kind: "events", events: defs.map((d) => d.key), title: "" };
  if (token) spec.token = token;
  if (unit) spec.unit = unit;
  const min = unit ? minAmountOf(rest) : undefined;
  if (min !== undefined) spec.minAmount = min;
  const who = addressesOf(rest)[0];
  if (who) spec[who.role] = who.address;
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  // the reader's own word for the events, for a title over protocols that name them differently
  const asked = bare.toLowerCase().split(/[^a-z0-9.]+/).find((w) => defs.some((d) => d.words.includes(w)));
  spec.title = `${eventsTitle(defs, asked)}${token ? ` in ${token.symbol}` : ""}${min !== undefined ? ` over ${min.toLocaleString("en-US")}` : ""}${who ? ` ${who.role === "to" ? "at" : "of"} ${short(who.address)}` : ""}`;
  return spec;
}

/** the account an event is about, by the first of its fields that names one: the account credited, the borrower,
    the staker, the depositor, a swap's recipient */
const ACTOR = ["onBehalfOf", "user", "borrower", "minter", "redeemer", "owner", "lender", "depositor", "mintRecipient", "dst", "src", "recipient", "to", "sender", "from", "initiator"];
function actorOf(fields: Record<string, string | bigint | boolean>): string {
  for (const k of ACTOR) {
    const v = fields[k];
    if (typeof v !== "string") continue;
    if (HEX40.test(v)) return v;
    // a bytes32 that holds an address, as CCTP's mintRecipient does for an EVM chain
    if (/^0x0{24}[0-9a-f]{40}$/.test(v)) return `0x${v.slice(26)}`;
  }
  return "";
}

/** an event's figure in whole units of its token, by the catalog's amount: a field that holds the token, a fixed
    token, the token of each emitting contract, or the emitter itself; null for a swap or a token the list lacks */
function eventAmount(d: MonitorEventDef, fields: Record<string, string | bigint | boolean>, emitter: string, tokens: Map<string, TokenMeta>): { amount: number | null; token?: string; symbol?: string } {
  if (!d.amount) return { amount: null };
  const held = d.amount.tokenField ? fields[d.amount.tokenField] : undefined;
  const token = (d.amount.token ?? (typeof held === "string" ? held : undefined) ?? d.amount.tokens?.[emitter] ?? emitter).toLowerCase();
  const meta = token === NATIVE ? { symbol: "AVAX", decimals: 18 } : tokens.get(token);
  const raw = fields[d.amount.field];
  if (!meta || typeof raw !== "bigint") return { amount: null, token, symbol: meta?.symbol };
  return { amount: unitsOf(raw < 0n ? -raw : raw, meta.decimals), token, symbol: meta.symbol };
}

/** the def each log is, by its topic0, shape and address and, for a pool, its factory; null for none of them. A
    pool's factory is asked once for the life of the server: getFactory() of an LB pair, factory() of the rest,
    and isPair(pool) of each Solidly factory for a pool no getter names */
async function eventDefsOf(url: string, logs: RpcLog[], defs: MonitorEventDef[]): Promise<(MonitorEventDef | null)[]> {
  const fits = logs.map((l) => defs.filter((d) => fitsMonitorLog(d, l)));
  const getters = new Map<string, string>();
  logs.forEach((l, i) => {
    const p = l.address.toLowerCase();
    for (const d of fits[i]) if (d.poolCheck && "getter" in d.poolCheck && !factoryOf.has(p)) getters.set(p, d.poolCheck.getter === "getFactory()" ? GET_FACTORY : FACTORY);
  });
  const pools = [...getters.keys()];
  const named = await rpcOrNull<string>(url, pools.map((p) => ({ method: "eth_call", params: [{ to: p, data: getters.get(p) }, "latest"] })));
  pools.forEach((p, i) => {
    const r = named[i];
    remember(factoryOf, p, typeof r === "string" && /^0x[0-9a-f]{64}$/i.test(r) && BigInt(r) !== 0n ? addressOf(r) : null);
  });
  const asks = new Map<string, { factory: string; pool: string }>();
  logs.forEach((l, i) => {
    const p = l.address.toLowerCase();
    if (factoryOf.get(p)) return;
    for (const d of fits[i])
      if (d.poolCheck && "onFactory" in d.poolCheck)
        for (const f of d.factories ?? []) if (!pairOf.has(`${f}:${p}`)) asks.set(`${f}:${p}`, { factory: f, pool: p });
  });
  const pairs = [...asks.values()];
  const said = await rpcOrNull<string>(url, pairs.map((a) => ({ method: "eth_call", params: [{ to: a.factory, data: `${IS_PAIR}${"0".repeat(24)}${a.pool.slice(2)}` }, "latest"] })));
  pairs.forEach((a, i) => remember(pairOf, `${a.factory}:${a.pool}`, typeof said[i] === "string" && /^0x0*1$/.test(said[i]!)));
  return logs.map((l, i) => {
    const p = l.address.toLowerCase();
    return (
      fits[i].find((d) => {
        // a def of listed contracts: fitsMonitorLog held the log to them
        if (!d.factories) return true;
        if (d.poolCheck && "getter" in d.poolCheck) return d.factories.includes(factoryOf.get(p) ?? "");
        return d.factories.some((f) => pairOf.get(`${f}:${p}`) === true);
      }) ?? null
    );
  });
}

async function events(url: string, spec: MonitorSpec, start: number, head: number, tokens: Map<string, TokenMeta>): Promise<{ items: MonitorItem[]; headAt: number; fromAt: number }> {
  const defs = (spec.events ?? []).map((k) => EVENT_DEFS.get(k)).filter((d): d is MonitorEventDef => !!d);
  // one filter a topic: its listed contracts, or every contract once a pool family emits it
  const byTopic = new Map<string, Set<string> | null>();
  for (const d of defs) {
    const had = byTopic.get(d.topic0);
    byTopic.set(d.topic0, !d.addresses || had === null ? null : new Set([...(had ?? []), ...d.addresses]));
  }
  const range = { fromBlock: hex(start), toBlock: hex(head) };
  const found = (await rpc<RpcLog[]>(url, [...byTopic].map(([topic0, at]) => ({ method: "eth_getLogs", params: [{ ...range, ...(at ? { address: [...at] } : {}), topics: [topic0] }] })))).flat();
  const seen = new Set<string>();
  const logs = found.filter((l) => {
    const k = `${l.transactionHash}:${l.logIndex}`;
    if (l.removed || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const which = await eventDefsOf(url, logs, defs);
  const oneProtocol = new Set(defs.map((d) => d.protocol)).size === 1;
  const heights = [...new Set([head, start, ...logs.map((l) => num(l.blockNumber))])];
  const blocks = await rpc<RpcBlock>(url, heights.map((h) => ({ method: "eth_getBlockByNumber", params: [hex(h), false] })));
  const at = new Map(blocks.map((b) => [num(b.number), timeOf(b)]));
  const items: MonitorItem[] = [];
  logs.forEach((l, i) => {
    const d = which[i];
    if (!d) return;
    let fields: Record<string, string | bigint | boolean>;
    try {
      fields = decodeMonitorLog(d, l);
    } catch {
      return;
    }
    const emitter = l.address.toLowerCase();
    const { amount, token, symbol } = eventAmount(d, fields, emitter, tokens);
    if (spec.token && token !== spec.token.address) return;
    const from = actorOf(fields);
    if ((spec.from && from !== spec.from) || (spec.involving && from !== spec.involving) || (spec.to && emitter !== spec.to)) return;
    items.push({ block: num(l.blockNumber), at: at.get(num(l.blockNumber)) ?? 0, tx: l.transactionHash, index: num(l.logIndex), from, to: emitter, amount, event: rowLabel(d, oneProtocol), ...(token ? { token } : {}), ...(symbol ? { symbol } : {}) });
  });
  return { items, headAt: at.get(head) ?? 0, fromAt: at.get(start) ?? 0 };
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
  const read = spec.kind === "native" ? await native(url, spec, start, head) : spec.kind === "events" ? await events(url, spec, start, head, tokens) : await transfers(url, spec, start, head, tokens);
  const min = spec.minAmount ?? 0;
  const kept = read.items
    .filter((i) => !min || (i.amount !== null && i.amount >= min))
    .sort((a, b) => b.block - a.block || b.index - a.index);
  // a read that keeps only its newest rows covers from the oldest one it keeps: the page draws nothing before it
  const cap = spec.kind === "events" ? MAX_EVENT_ITEMS : MAX_ITEMS;
  const items = kept.slice(0, cap);
  const cut = kept.length > cap ? items[items.length - 1] : null;
  return { head, headAt: read.headAt, from: cut ? cut.block : start, fromAt: cut ? cut.at : read.fromAt, items, gap: gap || !!cut };
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
