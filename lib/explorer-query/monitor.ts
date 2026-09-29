/* A monitor: a live feed of one chain's own activity, for words such as "monitor USDT transfers", "watch
   USDC transfers over 10k" or "live AVAX transfers". No model and no SQL: the words pick what to read and the
   filters, the route (app/api/explorer/monitor) reads the chain's RPC block by block, and the page draws each
   new block as it comes. The index behind the SQL answers runs minutes behind the chain; a monitor does not. */

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** transfers: one ERC-20's Transfer logs, or every token's when an address is the filter. native: the chain's own
    coin, moved by transactions with a value */
export type MonitorKind = "transfers" | "native";

export interface MonitorToken {
  /** lowercase 0x address */
  address: string;
  symbol: string;
  decimals: number;
}

export interface MonitorSpec {
  chainId: number;
  kind: MonitorKind;
  /** what the card is called: "USDT transfers over 10,000" */
  title: string;
  /** a transfers monitor of one token; none reads every token's transfers of the address filter */
  token?: MonitorToken;
  /** the chain's coin, for a native monitor: "AVAX" */
  coin?: string;
  /** only moves of at least this much, in whole tokens or coins */
  minAmount?: number;
  /** lowercase 0x addresses: only moves from it, to it, or either way */
  from?: string;
  to?: string;
  involving?: string;
}

/** one move the feed read */
export interface MonitorItem {
  block: number;
  /** the block's time, ms since epoch */
  at: number;
  tx: string;
  /** the log's index in its block, or the transaction's for a native move */
  index: number;
  from: string;
  to: string;
  /** whole tokens or coins; null when the token's decimals are unknown */
  amount: number | null;
  /** the token contract, for a transfers monitor that reads every token */
  token?: string;
  symbol?: string;
}

/** what one read of the feed returns: the moves in blocks from..head, newest first */
export interface MonitorRead {
  head: number;
  /** the head block's time, ms since epoch */
  headAt: number;
  /** the first block this read covers, and its time (ms since epoch): the page draws nothing before it as quiet */
  from: number;
  fromAt: number;
  items: MonitorItem[];
  /** the read skipped blocks (the page was away longer than one read covers) or kept only the newest moves */
  gap: boolean;
}

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
}

/** the chain's coin as a monitor reads it */
export interface ChainCoin {
  chainId: number;
  symbol: string;
}

/* the verb that asks for a monitor, anywhere in the words: "monitor USDT transfers", "I want to watch USDC" */
const LEAD = /\b(?:monitor|watch|track|tail|stream)\b\s*/i;
const LIVE = /\b(?:live|real[\s-]?time|as (?:they|it) happens?)\b/i;
const MOVES = /\b(?:transfers?|transferred|sends?|sent|moves?|movements?|payments?|flows?)\b/i;
/* words a monitor cannot read yet: these go to the SQL engine, which answers them as a chart of the index */
const OTHER = /\b(?:swaps?|trades?|liquidations?|borrows?|loans?|supplies|supply|deposits?|withdrawals?|stak\w*|bridg\w*|mints?|burns?|gas|fees?|blocks?|validators?|prices?|tvl|volume)\b/i;
const ADDRESS = /0x[0-9a-fA-F]{40}\b/g;
const AMOUNT =
  /\b(?:over|above|more than|greater than|bigger than|larger than|at least|min(?:imum)?(?: of)?)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b|(?:>=?)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b/i;
const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

/* the token a reader means by a symbol many list entries share: the live contract of the majors, from the chain's
   own issuers, before any bridged or older copy */
const CANONICAL: Record<number, Record<string, string>> = {
  43114: {
    usdt: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    usdc: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    wavax: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
  },
};
/* names a reader types for a token instead of its symbol */
const NAMED: Record<string, string> = { tether: "usdt", "usd coin": "usdc", "wrapped avax": "wavax" };

/** the address a phrase names, lowercase, with the role the words before it give it */
function addressesOf(text: string): { address: string; role: "from" | "to" | "involving" }[] {
  return [...text.matchAll(ADDRESS)].map((m) => {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index).toLowerCase();
    const role = /\b(?:from|by|sender)\s*$/.test(before) ? "from" : /\b(?:to|into|recipient|received by)\s*$/.test(before) ? "to" : "involving";
    return { address: m[0].toLowerCase(), role };
  });
}

/** the smallest amount the words ask for: "over 10k" is 10,000 */
export function minAmountOf(text: string): number | undefined {
  const m = AMOUNT.exec(text);
  if (!m) return undefined;
  const n = Number((m[1] ?? m[3]).replace(/,/g, ""));
  const scale = SCALE[(m[2] ?? m[4] ?? "").toLowerCase()] ?? 1;
  return Number.isFinite(n) && n > 0 ? n * scale : undefined;
}

/** the token a word names: the chain's canonical contract for a shared symbol, else the one list entry not marked
    old, else none (an unknown or unclear symbol is no filter to guess at) */
export function tokenOf(word: string, chainId: number, tokens: Map<string, TokenMeta>): MonitorToken | null {
  const w = (NAMED[word] ?? word).toLowerCase();
  const canonical = CANONICAL[chainId]?.[w];
  if (canonical) {
    const t = tokens.get(canonical);
    if (t) return { address: canonical, symbol: t.symbol, decimals: t.decimals };
  }
  const hits = [...tokens].filter(([, t]) => t.symbol.toLowerCase() === w && !/\[?\bold\b\]?|deprecated|legacy/i.test(t.name));
  if (hits.length !== 1) return null;
  const [address, t] = hits[0];
  return { address, symbol: t.symbol, decimals: t.decimals };
}

/** a count or amount as a title writes it: 10,000; 1.5M */
function amountText(n: number): string {
  if (n >= 1e6 && n % 1e5 === 0) return `${n / 1e6}M`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** the card's name for what it reads: "USDT transfers over 10,000 to 0x1234…abcd" */
export function monitorTitle(spec: Omit<MonitorSpec, "title">): string {
  const what = spec.kind === "native" ? `${spec.coin ?? "Coin"} transfers` : spec.token ? `${spec.token.symbol} transfers` : "Token transfers";
  const over = spec.minAmount ? ` over ${amountText(spec.minAmount)}` : "";
  const who = spec.from ? ` from ${short(spec.from)}` : spec.to ? ` to ${short(spec.to)}` : spec.involving ? ` of ${short(spec.involving)}` : "";
  return `${what}${over}${who}`;
}

/** the line under the title: what the card reads and where from */
export function monitorNote(spec: MonitorSpec, chainName: string): string {
  const what =
    spec.kind === "native"
      ? `Every transaction that moves ${spec.coin ?? "the chain's coin"}`
      : spec.token
        ? `Every ${spec.token.symbol} transfer`
        : "Every token transfer";
  const over = spec.minAmount ? ` of at least ${amountText(spec.minAmount)}` : "";
  return `${what}${over} on ${chainName}, read live from the chain's RPC: the last few minutes, then each new block as it is made.`;
}

/** whether the words could ask for a monitor at all: the cheap test before the token list is read. "live" alone
    asks for one only beside a move: "live USDC transfers", not "live validators" */
export function mayBeMonitor(prompt: string): boolean {
  return LEAD.test(prompt) || (LIVE.test(prompt) && MOVES.test(prompt));
}

/** a monitor the words ask for, or null: a question the SQL engine answers instead */
export function parseMonitor(prompt: string, coin: ChainCoin, tokens: Map<string, TokenMeta>): MonitorSpec | null {
  const text = prompt.trim();
  if (!mayBeMonitor(text)) return null;
  const lead = LEAD.exec(text);
  const rest = lead ? text.slice((lead.index ?? 0) + lead[0].length) : text;
  const minAmount = minAmountOf(rest);
  const addresses = addressesOf(rest);
  const words = rest
    .replace(ADDRESS, " ")
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean);
  // a phrase the monitor cannot read yet is a question for the SQL engine
  if (OTHER.test(rest.replace(ADDRESS, " ")) && !MOVES.test(rest)) return null;

  const coinWord = coin.symbol.toLowerCase();
  const named = Object.keys(NAMED).find((n) => rest.toLowerCase().includes(n));
  let token: MonitorToken | null = named ? tokenOf(named, coin.chainId, tokens) : null;
  let native = false;
  for (const w of words) {
    if (token || native) break;
    if (w === coinWord) native = true;
    else token = tokenOf(w, coin.chainId, tokens);
  }
  // an address the list knows as a token is that token, whatever word stands before it
  const known = addresses.find((a) => tokens.has(a.address));
  if (!token && !native && known) {
    const t = tokens.get(known.address)!;
    token = { address: known.address, symbol: t.symbol, decimals: t.decimals };
  }
  const people = addresses.filter((a) => a !== known);
  if (!token && !native && people.length === 0) return null;

  const spec: Omit<MonitorSpec, "title"> = { chainId: coin.chainId, kind: native ? "native" : "transfers" };
  if (token) spec.token = token;
  if (native) spec.coin = coin.symbol;
  if (minAmount !== undefined && (token || native)) spec.minAmount = minAmount;
  for (const p of people.slice(0, 1)) spec[p.role] = p.address;
  return { ...spec, title: monitorTitle(spec) };
}
