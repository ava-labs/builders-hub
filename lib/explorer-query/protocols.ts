/* The C-Chain's DEXs as Query reads them: each protocol's pool factories
   and the event family their pools emit, from the contract registry the
   dApp pages read (data/contract-registry.json), and the tokens whose
   amounts a query scales. Pools are not listed: a query finds them in its
   factories' creation logs, so the tables stay small enough to send with
   the query (sources.ts). Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";

/** the event layouts pools emit, as the registry names them; the prompt gives each one's topics and offsets */
export type DexFamily = "univ2" | "solidly" | "univ3" | "cl-ramses" | "algebra" | "lb" | "univ4" | "woofi";
export const DEX_FAMILY_ORDER: readonly DexFamily[] = ["univ2", "solidly", "univ3", "cl-ramses", "algebra", "lb", "univ4", "woofi"];

export interface DexFactory {
  /** the protocol's slug, as the dApp pages name it */
  protocol: string;
  /** the protocol's own name for the factory's pools: v1, LB v2.2, DLMM */
  version: string;
  family: DexFamily;
  /** the factory, or for univ4 the PoolManager and for woofi the contract that hold every pool */
  factory: string;
  /** the contracts that hold the pools' positions as NFTs */
  positions: readonly string[];
}

/** what a volume counts a token's amount in: US dollars (a stablecoin), AVAX (WAVAX or native AVAX), or neither */
export type Quote = "usd" | "avax" | "";

export interface DexToken {
  token: string;
  /** for the prompt and the tests; the table does not send it, the token list names tokens */
  symbol: string;
  decimals: number;
  quote: Quote;
}

/** the C-Chain the tables describe */
export const DEX_CHAIN_ID = 43114;

interface RegistryEntry {
  address: string;
  name: string;
  protocol?: string;
  category?: string;
  family?: string;
  version?: string;
  positions?: string | string[];
  active?: boolean;
}

const registry = registryData as { contracts: RegistryEntry[]; protocolSlugs: Record<string, string> };
const ADDRESS = /^0x[0-9a-f]{40}$/;
const isFamily = (f: string | undefined): f is DexFamily => DEX_FAMILY_ORDER.includes(f as DexFamily);

/** a factory listed twice would join each of its logs twice, so the first entry wins */
const listed = new Set<string>();

/** every active DEX entry with a family and a protocol the dApp pages name, in the registry's order */
export const DEX_FACTORIES: readonly DexFactory[] = registry.contracts.flatMap((e) => {
  const slug = e.protocol ? registry.protocolSlugs[e.protocol] : undefined;
  const factory = e.address.toLowerCase();
  if (e.category !== "dex" || !isFamily(e.family) || e.active === false || !slug || !ADDRESS.test(factory) || listed.has(factory)) return [];
  listed.add(factory);
  const positions = [e.positions ?? []].flat().flatMap((a) => (typeof a === "string" && ADDRESS.test(a.toLowerCase()) ? [a.toLowerCase()] : []));
  return [{ protocol: slug, version: e.version ?? "", family: e.family, factory, positions }];
});

/** slug -> the name a reader sees, for each protocol with a DEX factory */
export const DEX_PROTOCOLS: Record<string, string> = Object.fromEntries(
  Object.entries(registry.protocolSlugs)
    .filter(([, slug]) => DEX_FACTORIES.some((f) => f.protocol === slug))
    .map(([name, slug]) => [slug, name]),
);

/** the tokens with the most DEX volume, and native AVAX (a univ4 pool's zero address); decimals as the token list gives them, checked 2026-09-27 */
export const DEX_TOKENS: readonly DexToken[] = [
  { token: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", symbol: "USDC", decimals: 6, quote: "usd" },
  { token: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", symbol: "USDt", decimals: 6, quote: "usd" },
  { token: "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", symbol: "USDC.e", decimals: 6, quote: "usd" },
  { token: "0xc7198437980c041c805a1edcba50c1ce5db95118", symbol: "USDT.e", decimals: 6, quote: "usd" },
  { token: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", symbol: "WAVAX", decimals: 18, quote: "avax" },
  { token: "0x0000000000000000000000000000000000000000", symbol: "AVAX", decimals: 18, quote: "avax" },
  { token: "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", symbol: "WETH.e", decimals: 18, quote: "" },
  { token: "0x152b9d0fdc40c096757f570a51e494bd4b943e50", symbol: "BTC.b", decimals: 8, quote: "" },
  { token: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be", symbol: "sAVAX", decimals: 18, quote: "" },
  { token: "0x8729438eb15e2c8b576fcc6aecda6a148776c0f5", symbol: "QI", decimals: 18, quote: "" },
  { token: "0x60781c2586d68229fde47564546784ab3faca982", symbol: "PNG", decimals: 18, quote: "" },
  { token: "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", symbol: "JOE", decimals: 18, quote: "" },
  { token: "0x13a466998ce03db73abc2d4df3bbd845ed1f28e7", symbol: "PHAR", decimals: 18, quote: "" },
  { token: "0x09fa58228bb791ea355c90da1e4783452b9bd8c3", symbol: "SUPER", decimals: 18, quote: "" },
  { token: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", symbol: "DAI.e", decimals: 18, quote: "" },
  { token: "0x130966628846bfd36ff31a822705796e8cb8c18d", symbol: "MIM", decimals: 18, quote: "" },
];

/** the pool a WAVAX leg is priced in: Uniswap v3 WAVAX/USDC 0.05%, token0 WAVAX (18), token1 USDC (6) */
export const DEX_PRICE_POOL = "0xfae3f424a0a47706811521e3ee268f00cfb5c45e";

/** each event by topic0, keccak of its signature (checked with viem, and against qaudit's and dexreg's lists) */
export const DEX_TOPICS = {
  transfer: "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  v2Created: "0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9",
  v2Swap: "d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
  v2Mint: "4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  v2Burn: "dccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496",
  v2Sync: "1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1",
  solidlyCreated: "c4805696c66d7cf352fc1d6bb633ad5ee82f6cb577c453024b6e0eb8306c6fc9",
  solidlySync: "cf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a",
  v3Created: "783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118",
  v3Swap: "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  v3Mint: "7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde",
  ramsesMint: "d78218c0d304e8893cb3200abe394bbc8d5b7804d9c51f236df9fdcf481d02d3",
  v3Burn: "0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c",
  increase: "3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f",
  decrease: "26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4",
  algebraCustom: "8a5f030f5fc13b04a1e4ef7c47177e3d76b0e80e1d9be9843db37caa5b7b9b8f",
  algebraPool: "91ccaa7a278130b65168c3a0c8d3bcae84cf5e43704342bd3ec0b59e59c036db",
  algebraIncrease: "8a82de7fe9b33e0e6bca0e26f5bd14a74f1164ffe236d50e0a36c3ea70f2b814",
  lbCreated: "2c8d104b27c6b7f4492017a6f5cf3803043688934ebcaa6a03540beeaf976aff",
  lbSwap: "ad7d6f97abf51ce18e17a38f4d70e975be9c0708474987bb3e26ad21bd93ca70",
  lbDeposit: "87f1f9dcf5e8089a3e00811b6a008d8f30293a3da878cb1fe8c90ca376402f8a",
  lbWithdraw: "a32e146844d6144a22e94c586715a1317d58a8aa3581ec33d040113ddcb24350",
  v4Initialize: "dd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438",
  v4Swap: "40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f",
  wooSwap: "0e8e403c2d36126272b08c75823e988381d9dc47f2f0a9a080d95f891d95c469",
  // a pool's new fee: cl-ramses pools and Pharaoh's old univ3 pools write FeeAdjustment(uint24,uint24), algebra pools Fee(uint16)
  feeAdjustment: "0cba87189055d3b5ab05c96fbd641bc766576c9e7cf0d195bdfb58a0c6a6df24",
  algebraFee: "598b9f043c813aa6be3426ca60d1c65d17256312890be5118dab55b0775ebe2a",
} as const;

/** the univ2 protocols whose pairs all charge 0.3% of the amount in, as each pair's swap checks it; Pharaoh's and Arena's pairs set their own */
export const V2_FEE_PROTOCOLS: readonly string[] = ["trader-joe", "pangolin", "sushi", "uniswap"];

/** the families some of the factories use, in the prompt's order */
export function dexFamilies(factories: readonly DexFactory[] = DEX_FACTORIES): DexFamily[] {
  const used = new Set(factories.map((f) => f.family));
  return DEX_FAMILY_ORDER.filter((f) => used.has(f));
}

/** when the token list was last checked, for the answer's source line */
export const DEX_LISTED_AT = Date.UTC(2026, 8, 27);

const QUOTES: readonly Quote[] = ["", "usd", "avax"];
export const bare = (address: string) => address.slice(2).toLowerCase();
/** an address in 28 characters, not 40: the query service takes 8 KiB of SQL */
export const packed = (address: string) => Buffer.from(bare(address), "hex").toString("base64");
export const strings = (xs: readonly string[]) => `[${xs.map((x) => `'${x}'`).join(",")}]`;
const bytes = (s: string) => Buffer.byteLength(s);

/** a query that reads the positions contracts: by the column's name, or all of a table's columns */
export const readsPositions = (query: string) => /\bpositions\b|(\bSELECT|,)\s*(\w+\.)?\*/i.test(query);

/** dex_factories as one SELECT: names once in arrays, a row of their indexes and the packed addresses. Without
    `positions` the column is empty, which gives a query that never reads it back about 360 bytes */
export function factoriesSql(chainId: number, factories: readonly DexFactory[] = DEX_FACTORIES, positions = true): string {
  const protocols = [...new Set(factories.map((f) => f.protocol))];
  const versions = [...new Set(factories.map((f) => f.version))];
  const families = [...new Set(factories.map((f) => f.family))];
  const rows = factories.map(
    (f) => `(${protocols.indexOf(f.protocol) + 1},${versions.indexOf(f.version) + 1},${families.indexOf(f.family) + 1},'${packed(f.factory)}'${positions ? `,${strings(f.positions.map(packed))}` : ""})`,
  );
  return (
    `SELECT toUInt64(${chainId}) AS chain_id, p[tupleElement(r, 1)] AS protocol, v[tupleElement(r, 2)] AS version, f[tupleElement(r, 3)] AS family, ` +
    `base64Decode(tupleElement(r, 4)) AS factory, ${positions ? "CAST(arrayMap(x -> base64Decode(x), tupleElement(r, 5)) AS Array(String))" : "emptyArrayString()"} AS positions ` +
    `FROM (SELECT ${strings(protocols)} AS p, ${strings(versions)} AS v, ${strings(families)} AS f, arrayJoin([${rows.join(",")}]) AS r)`
  );
}

/** dex_tokens as one SELECT: each token's packed address, decimals and quote */
export function tokensSql(chainId: number, tokens: readonly DexToken[] = DEX_TOKENS): string {
  const rows = tokens.map((t) => `('${packed(t.token)}',${t.decimals},${QUOTES.indexOf(t.quote)})`);
  return (
    `SELECT toUInt64(${chainId}) AS chain_id, base64Decode(tupleElement(r, 1)) AS token, toUInt8(tupleElement(r, 2)) AS decimals, ` +
    `arrayElement(${strings(QUOTES)}, tupleElement(r, 3) + 1) AS quote FROM (SELECT arrayJoin([${rows.join(",")}]) AS r)`
  );
}

/** the most of a list whose table fits in `room` bytes: the entries the query names first, then the list's order.
    Nothing fitting keeps the whole list, so the send fails with the query's own size in its error */
export function fitting<T>(all: readonly T[], named: (x: T) => boolean, build: (xs: readonly T[]) => string, room: number): { sql: string; kept: readonly T[] } {
  const order = [...all.filter(named), ...all.filter((x) => !named(x))];
  for (let n = order.length; n > 0; n--) {
    const keep = new Set(order.slice(0, n));
    const kept = all.filter((x) => keep.has(x));
    const sql = build(kept);
    if (bytes(sql) <= room) return { sql, kept };
  }
  return { sql: build(all), kept: all };
}

/** the factories for one query in `room` bytes: those it names by protocol or address, then the registry's order with
    woofi's last, since they create no pools for the DEX WITH to read; their positions only for a query that reads them */
export function factoriesFor(query: string, room: number, all: readonly DexFactory[] = DEX_FACTORIES) {
  const q = query.toLowerCase();
  const order = [...all.filter((f) => f.family !== "woofi"), ...all.filter((f) => f.family === "woofi")];
  return fitting(order, (f) => q.includes(`'${f.protocol}'`) || q.includes(bare(f.factory)), (xs) => factoriesSql(DEX_CHAIN_ID, xs, readsPositions(query)), room);
}

/** the tokens for one query in `room` bytes: the quote tokens and those it names, then the list's order */
export function tokensFor(query: string, room: number, all: readonly DexToken[] = DEX_TOKENS) {
  const q = query.toLowerCase();
  return fitting(all, (t) => t.quote !== "" || q.includes(bare(t.token)), (xs) => tokensSql(DEX_CHAIN_ID, xs), room);
}

/** a reader's name for a registry DEX contract: "Trader Joe LB v2.2 factory" */
export function dexContractName(address: string): string | null {
  const a = address.toLowerCase();
  const f = DEX_FACTORIES.find((x) => x.factory === a || x.positions.includes(a));
  if (!f) return null;
  const name = DEX_PROTOCOLS[f.protocol] ?? f.protocol;
  const what = f.positions.includes(a) ? "positions" : f.family === "univ4" ? "pool manager" : f.family === "woofi" ? "pool" : "factory";
  return `${name}${f.version ? ` ${f.version}` : ""} ${what}`;
}
