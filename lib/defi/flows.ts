/* On-chain flows between Avalanche DeFi protocols and the wallets that use
   them, read from the C-Chain ClickHouse (through stats-api's query
   endpoint, which caps a query at 8 KB).

   What is counted: ERC-20 transfers of 14 major tokens (9 dollar
   stablecoins at $1, WAVAX, sAVAX, BTC.b, WBTC.e, WETH.e), priced each
   hour from the busiest concentrated-liquidity pool of the asset, where
   one side is a contract in the Builder Hub registry. Receipt tokens
   (aTokens, qiTokens) are left unpriced on purpose, so a deposit counts
   once. Native AVAX is not counted.

   What is left out: MEV bots (two thirds of the raw flow), and
   transfers inside one protocol. The registry's "infrastructure"
   contracts are mostly smart wallets and relays, so they count as
   wallets. Routers pass tokens through, so a DEX's inflow and outflow
   are close and its net is the figure to read. */

export type FlowKind = "protocol" | "mev" | "wallet";

export interface FlowLabel {
  name: string;
  /** the registry's category: dex, lending, bridge, ... */
  category: string;
  kind: FlowKind;
}

export interface RegistryContract {
  address: string;
  name: string;
  protocol: string;
  category: string;
  type: string;
  subcategory?: string;
}

/** registry protocol names that are the same protocol */
const ALIAS: Record<string, string> = {
  "Aave V2 & V3": "Aave",
  BENQI: "Benqi",
  "Pharaoh Exchange": "Pharaoh",
  "LFJ (fka Trader Joe)": "Trader Joe",
  "Pangolin Exchange": "Pangolin",
  Blackhole: "Blackhole DEX",
};

export interface RegistryIndex {
  labels: Map<string, FlowLabel>;
  /** base64 of each contract's 4-byte key (address bytes 12 to 15) */
  keys: string;
}

/* The query matches both sides of a transfer against 4-byte keys, since
   the 20-byte addresses would not fit the 8 KB cap; the exact match is
   made here, on the rows that come back. */
export function registryIndex(contracts: RegistryContract[]): RegistryIndex {
  const labels = new Map<string, FlowLabel>();
  const keys = new Set<string>();
  for (const c of contracts) {
    const a = c.address.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]{40}$/.test(a)) continue;
    const kind: FlowKind = c.category === "mev" || c.subcategory ? "mev" : c.category === "infrastructure" || c.type === "token" ? "wallet" : "protocol";
    labels.set(a, { name: ALIAS[c.protocol] ?? c.protocol, category: kind === "mev" ? "mev" : c.category, kind });
    keys.add(a.slice(24, 32));
  }
  const bytes = Buffer.from([...keys].join(""), "hex");
  return { labels, keys: bytes.toString("base64") };
}

const WALLET: FlowLabel = { name: "Wallets", category: "wallet", kind: "wallet" };

export function labelOf(index: RegistryIndex, address: string): FlowLabel {
  return (address && index.labels.get(address.toLowerCase().replace(/^0x/, ""))) || WALLET;
}

/* ------------------------------------------------------------------ */
/* the tokens that carry a price, and the SQL                          */
/* ------------------------------------------------------------------ */

export interface PricedToken {
  address: string;
  symbol: string;
  decimals: number;
  /** usd: a dollar stablecoin at $1 */
  cls: "usd" | "avax" | "btc" | "eth";
}

export const PRICED_TOKENS: PricedToken[] = [
  { address: "b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", symbol: "USDC", decimals: 6, cls: "usd" },
  { address: "9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", symbol: "USDt", decimals: 6, cls: "usd" },
  { address: "a7d7079b0fead91f3e65f86e8915cb59c1a4c664", symbol: "USDC.e", decimals: 6, cls: "usd" },
  { address: "c7198437980c041c805a1edcba50c1ce5db95118", symbol: "USDT.e", decimals: 6, cls: "usd" },
  { address: "00000000efe302beaa2b3e6e1b18d08d69a9012a", symbol: "AUSD", decimals: 6, cls: "usd" },
  { address: "d586e7f844cea2f87f50152665bcbc2c279d8d70", symbol: "DAI.e", decimals: 18, cls: "usd" },
  { address: "5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", symbol: "USDe", decimals: 18, cls: "usd" },
  { address: "d24c2ad096400b6fbcd2ad8b24e7acbc21a1da64", symbol: "FRAX", decimals: 18, cls: "usd" },
  { address: "24de8771bc5ddb3362db529fc3358f2df3a0e346", symbol: "avUSD", decimals: 18, cls: "usd" },
  { address: "b31f66aa3c1e785363f0875a1b74e27b85fd66c7", symbol: "WAVAX", decimals: 18, cls: "avax" },
  { address: "2b2c81e08f1af8835a78bb2a90ae924ace0ea4be", symbol: "sAVAX", decimals: 18, cls: "avax" },
  { address: "152b9d0fdc40c096757f570a51e494bd4b943e50", symbol: "BTC.b", decimals: 8, cls: "btc" },
  { address: "50b7545627a5162f82a992c33b87adc75187b218", symbol: "WBTC.e", decimals: 8, cls: "btc" },
  { address: "49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", symbol: "WETH.e", decimals: 18, cls: "eth" },
];

const SYMBOL = new Map(PRICED_TOKENS.map((t) => [t.address, t.symbol]));
export const symbolOf = (token: string) => SYMBOL.get(token.toLowerCase().replace(/^0x/, "")) ?? "token";

const SWAP_V3 = "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const TRANSFER = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/* the busiest concentrated-liquidity pool per asset: WAVAX/USDC, BTC.b/WAVAX, WETH.e/WAVAX, sAVAX/WAVAX */
const POOL = { avax: "fae3f424a0a47706811521e3ee268f00cfb5c45e", btc: "5ca009013f6b898d134b6798b336a4592f3b4af2", eth: "7b602f98d71715916e7c963f51bfebc754ade2d0", savax: "65b9016c376604fe0af38c1e336ffcec0f8ecbbd" };

/* USD per raw token unit, per hour: the pool's median price that hour,
   with the decimals folded in; a dollar stablecoin is $1 */
function unitPrice(t: PricedToken): string {
  const scale = `1e-${t.decimals}`;
  if (t.cls === "usd") return scale;
  if (t.symbol === "sAVAX") return `savax * avax * ${scale}`;
  if (t.cls === "avax") return `avax * ${scale}`;
  if (t.cls === "btc") return `btc * avax * ${scale}`;
  return `eth * avax * ${scale}`;
}

function head(keys: string, hours: number): string {
  const h = Math.max(1, Math.min(168, Math.round(hours)));
  const pools = Object.values(POOL).map((a) => `unhex('${a}')`).join(", ");
  return `WITH base64Decode('${keys}') AS K,
  (SELECT min(block_number) FROM raw_blocks WHERE chain_id = 43114 AND block_time >= now() - INTERVAL ${h} HOUR AND block_number > 90000000) AS b0,
  ks AS (SELECT arrayJoin(arrayMap(i -> substring(K, i * 4 + 1, 4), range(intDiv(length(K), 4)))) AS k),
  px AS (
    SELECT toStartOfHour(block_time) AS h,
      ifNotFinite(medianIf(p, address = unhex('${POOL.avax}')), 0) * 1e12 AS avax,
      ifNotFinite(medianIf(p, address = unhex('${POOL.btc}')), 0) * 1e-10 AS btc,
      ifNotFinite(medianIf(p, address = unhex('${POOL.eth}')), 0) AS eth,
      ifNotFinite(medianIf(p, address = unhex('${POOL.savax}')), 0) AS savax
    FROM (
      SELECT block_time, address, pow(toFloat64(reinterpretAsUInt256(reverse(substring(data, 65, 32)))) / pow(2, 96), 2) AS p
      FROM raw_logs
      WHERE chain_id = 43114 AND topic0 = unhex('${SWAP_V3}') AND block_number >= b0 AND address IN (${pools})
    )
    GROUP BY h
  ),
  pu AS (
    SELECT h, tk, u, cls FROM px
    ARRAY JOIN
      [${PRICED_TOKENS.map((t) => `unhex('${t.address}')`).join(", ")}] AS tk,
      [${PRICED_TOKENS.map(unitPrice).join(", ")}] AS u,
      [${PRICED_TOKENS.map((t) => `'${t.cls}'`).join(", ")}] AS cls
  )`;
}

const FROM_TRANSFERS = `FROM raw_logs t
JOIN pu p ON p.h = toStartOfHour(t.block_time) AND p.tk = t.address
WHERE t.chain_id = 43114 AND t.topic0 = unhex('${TRANSFER}')
  AND t.block_number >= b0 AND t.topic3 IS NULL
  AND t.address IN (SELECT tk FROM pu)
  AND (substring(t.topic1, 25, 4) IN ks OR substring(t.topic2, 25, 4) IN ks)`;

/** USD moved between each pair of registry contracts, or a contract and anyone else ('' ) */
export function pairsSql(keys: string, hours: number): string {
  return `${head(keys, hours)}
SELECT
  if(substring(t.topic1, 25, 4) IN ks, lower(hex(substring(t.topic1, 13, 20))), '') AS src,
  if(substring(t.topic2, 25, 4) IN ks, lower(hex(substring(t.topic2, 13, 20))), '') AS dst,
  p.cls AS cls,
  round(ifNotFinite(sum(toFloat64(reinterpretAsUInt256(reverse(substring(t.data, 1, 32)))) * p.u), 0)) AS usd,
  count() AS n
${FROM_TRANSFERS}
GROUP BY src, dst, cls
HAVING usd > 0`;
}

/** the largest single transfers that touch a registry contract */
export function largestSql(keys: string, hours: number, limit = 300): string {
  return `${head(keys, hours)}
SELECT toString(t.block_time) AS time, lower(hex(t.transaction_hash)) AS tx, t.log_index AS log_index, lower(hex(t.address)) AS token,
  lower(hex(substring(t.topic1, 13, 20))) AS from_addr,
  lower(hex(substring(t.topic2, 13, 20))) AS to_addr,
  round(ifNotFinite(toFloat64(reinterpretAsUInt256(reverse(substring(t.data, 1, 32)))) * p.u, 0)) AS usd
${FROM_TRANSFERS}
ORDER BY usd DESC
LIMIT ${Math.max(1, Math.min(1000, Math.round(limit)))}`;
}

/* ------------------------------------------------------------------ */
/* the rows, labeled and summed                                        */
/* ------------------------------------------------------------------ */

export interface PairRow {
  src: string;
  dst: string;
  cls: string;
  usd: number;
  n: number;
}

export interface FlowTotals {
  inflow: number;
  outflow: number;
  net: number;
}

export interface CategoryFlow extends FlowTotals {
  category: string;
  /** of which dollar stablecoins */
  stableNet: number;
}

export interface ProtocolFlow extends FlowTotals {
  name: string;
  category: string;
}

export interface FlowEdge {
  source: string;
  target: string;
  usd: number;
}

export interface FlowSummary {
  hours: number;
  /** every labeled flow, MEV included, before anything is left out */
  gross: number;
  /** the part that touches an MEV bot, left out */
  mev: number;
  categories: CategoryFlow[];
  protocols: ProtocolFlow[];
  /** category to category, with "wallet" for everyone outside the registry */
  edges: FlowEdge[];
}

export function summarize(rows: PairRow[], index: RegistryIndex, hours: number): FlowSummary {
  let gross = 0;
  let mev = 0;
  const cat = new Map<string, { i: number; o: number; s: number }>();
  const proto = new Map<string, { i: number; o: number; category: string }>();
  const edge = new Map<string, number>();
  const bump = <T>(m: Map<string, T>, k: string, make: () => T) => m.get(k) ?? (m.set(k, make()), m.get(k)!);

  for (const r of rows) {
    const usd = Number(r.usd) || 0;
    if (usd <= 0) continue;
    const s = labelOf(index, r.src);
    const d = labelOf(index, r.dst);
    // a move inside one protocol, or between two wallets, is not a flow
    if (s.kind === d.kind && s.name === d.name) continue;
    if (s.kind === "wallet" && d.kind === "wallet") continue;
    gross += usd;
    if (s.kind === "mev" || d.kind === "mev") {
      mev += usd;
      continue;
    }
    const stable = r.cls === "usd" ? usd : 0;
    if (s.kind === "protocol") {
      const c = bump(cat, s.category, () => ({ i: 0, o: 0, s: 0 }));
      c.o += usd;
      c.s -= stable;
      bump(proto, s.name, () => ({ i: 0, o: 0, category: s.category })).o += usd;
    }
    if (d.kind === "protocol") {
      const c = bump(cat, d.category, () => ({ i: 0, o: 0, s: 0 }));
      c.i += usd;
      c.s += stable;
      bump(proto, d.name, () => ({ i: 0, o: 0, category: d.category })).i += usd;
    }
    const key = `${s.kind === "wallet" ? "wallet" : s.category}>${d.kind === "wallet" ? "wallet" : d.category}`;
    edge.set(key, (edge.get(key) ?? 0) + usd);
  }

  const totals = (i: number, o: number) => ({ inflow: Math.round(i), outflow: Math.round(o), net: Math.round(i - o) });
  return {
    hours,
    gross: Math.round(gross),
    mev: Math.round(mev),
    categories: [...cat.entries()]
      .map(([category, c]) => ({ category, ...totals(c.i, c.o), stableNet: Math.round(c.s) }))
      .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow)),
    protocols: [...proto.entries()]
      .map(([name, p]) => ({ name, category: p.category, ...totals(p.i, p.o) }))
      .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow)),
    edges: [...edge.entries()]
      .map(([k, usd]) => {
        const [source, target] = k.split(">");
        return { source, target, usd: Math.round(usd) };
      })
      .sort((a, b) => b.usd - a.usd),
  };
}

export interface MoveRow {
  time: string;
  tx: string;
  log_index: number;
  token: string;
  from_addr: string;
  to_addr: string;
  usd: number;
}

export interface Move {
  /** UTC, "2026-09-25 13:44:02" */
  time: string;
  tx: string;
  token: string;
  usd: number;
  from: { address: string; name: string | null; category: string | null };
  to: { address: string; name: string | null; category: string | null };
  /** into DeFi from a wallet, out of DeFi to a wallet, or from one protocol to another */
  direction: "in" | "out" | "between";
}

const side = (address: string, l: FlowLabel) => ({
  address: `0x${address.toLowerCase().replace(/^0x/, "")}`,
  name: l.kind === "protocol" ? l.name : null,
  category: l.kind === "protocol" ? l.category : null,
});

/** the biggest transfers into, out of and between protocols; one per transaction */
export function largestMoves(rows: MoveRow[], index: RegistryIndex, limit = 25): Move[] {
  const seen = new Set<string>();
  const out: Move[] = [];
  for (const r of [...rows].sort((a, b) => Number(b.usd) - Number(a.usd))) {
    const f = labelOf(index, r.from_addr);
    const t = labelOf(index, r.to_addr);
    if (f.kind === "mev" || t.kind === "mev") continue;
    if (f.kind !== "protocol" && t.kind !== "protocol") continue;
    if (f.kind === "protocol" && t.kind === "protocol" && f.name === t.name) continue;
    if (seen.has(r.tx)) continue;
    seen.add(r.tx);
    out.push({
      time: r.time,
      tx: `0x${r.tx.replace(/^0x/, "")}`,
      token: symbolOf(r.token),
      usd: Math.round(Number(r.usd) || 0),
      from: side(r.from_addr, f),
      to: side(r.to_addr, t),
      direction: f.kind === "protocol" && t.kind === "protocol" ? "between" : t.kind === "protocol" ? "in" : "out",
    });
    if (out.length >= limit) break;
  }
  return out;
}

export interface FlowsResponse {
  asOf: number;
  hours: number;
  summary: FlowSummary;
  moves: Move[];
}
