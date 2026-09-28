/* The C-Chain's lending protocols as Query reads them: Aave v3, whose one
   Pool serves every reserve, and Benqi, a Compound v2 fork with one market
   per asset, from the contract registry the dApp pages read
   (data/contract-registry.json), and the tokens whose amounts a query
   scales and prices. Aave's aTokens and debt tokens are not listed: a query
   finds them in the PoolConfigurator's ReserveInitialized logs, so the
   tables stay small enough to send with the query (sources.ts). Mainnet
   C-Chain only. */

import registryData from "@/data/contract-registry.json";
import { bare, fitting, packed, strings } from "./protocols";

/** a Benqi market: its qiToken and the asset it lends */
export interface LendingMarket {
  /** the protocol's slug, as the dApp pages name it */
  protocol: string;
  /** core, or ecosystem for Benqi's second comptroller */
  version: string;
  market: string;
  /** the underlying; the zero address for qiAVAX, which holds native AVAX */
  asset: string;
}

/** what an amount of a token is priced in: US dollars, or a price the lending WITH reads from swaps; "" for none */
export type PriceKind = "usd" | "avax" | "btc" | "eth" | "savax" | "link" | "eurc" | "qi" | "";

export interface LendingToken {
  token: string;
  /** for the prompt and the tests; the table does not send it, the token list names tokens */
  symbol: string;
  decimals: number;
  price: PriceKind;
}

/** the C-Chain the tables describe */
export const LENDING_CHAIN_ID = 43114;

interface RegistryEntry {
  address: string;
  name: string;
  protocol?: string;
  category?: string;
  family?: string;
  version?: string;
  role?: string;
  underlying?: string;
  active?: boolean;
}

const registry = registryData as { contracts: RegistryEntry[]; protocolSlugs: Record<string, string> };
const ADDRESS = /^0x[0-9a-f]{40}$/;
const lower = (a: string | undefined) => (a ?? "").toLowerCase();

/** the registry's active lending contracts of the two families the prompt has rules for */
const LISTED = registry.contracts.filter(
  (e) => e.category === "lending" && (e.family === "aave-v3" || e.family === "compound") && e.active !== false && ADDRESS.test(lower(e.address)),
);
const roleOf = (family: string, role: string) => LISTED.filter((e) => e.family === family && e.role === role).map((e) => lower(e.address));

/** Aave v3's Pool: every supply, withdrawal, borrow, repayment, liquidation and flash loan */
export const AAVE_POOL = roleOf("aave-v3", "pool")[0] ?? "";
/** Aave v3's PoolConfigurator: one ReserveInitialized per reserve, with its aToken and debt tokens */
export const AAVE_CONFIGURATOR = roleOf("aave-v3", "configurator")[0] ?? "";

/** a market listed twice would count each of its logs twice, so the first entry wins */
const listed = new Set<string>();

/** every active Benqi market with an underlying and a protocol the dApp pages name, in the registry's order */
export const LENDING_MARKETS: readonly LendingMarket[] = LISTED.flatMap((e) => {
  const slug = e.protocol ? registry.protocolSlugs[e.protocol] : undefined;
  const market = lower(e.address);
  const asset = lower(e.underlying);
  if (e.family !== "compound" || e.role !== "market" || !slug || !ADDRESS.test(asset) || listed.has(market)) return [];
  listed.add(market);
  return [{ protocol: slug, version: e.version ?? "", market, asset }];
});

/** slug -> the name a reader sees, for Aave and each protocol with a market */
export const LENDING_PROTOCOLS: Record<string, string> = Object.fromEntries(
  Object.entries(registry.protocolSlugs).filter(([name]) => LISTED.some((e) => e.protocol === name && (e.role === "pool" || e.role === "market"))).map(([name, slug]) => [slug, name]),
);

/** Aave's slug, as its rows carry it */
export const AAVE_SLUG = Object.entries(LENDING_PROTOCOLS).find(([, name]) => LISTED.some((e) => e.protocol === name && e.family === "aave-v3"))?.[0] ?? "";

/** every asset Aave or Benqi lends: decimals as the token list gives them (native AVAX and rsETH read on-chain by qaudit), checked 2026-09-27 */
export const LENDING_TOKENS: readonly LendingToken[] = [
  { token: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", symbol: "USDC", decimals: 6, price: "usd" },
  { token: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", symbol: "USDt", decimals: 6, price: "usd" },
  { token: "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", symbol: "USDC.e", decimals: 6, price: "usd" },
  { token: "0xc7198437980c041c805a1edcba50c1ce5db95118", symbol: "USDT.e", decimals: 6, price: "usd" },
  { token: "0x00000000efe302beaa2b3e6e1b18d08d69a9012a", symbol: "AUSD", decimals: 6, price: "usd" },
  { token: "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", symbol: "DAI.e", decimals: 18, price: "usd" },
  { token: "0xd24c2ad096400b6fbcd2ad8b24e7acbc21a1da64", symbol: "FRAX", decimals: 18, price: "usd" },
  { token: "0x5c49b268c9841aff1cc3b0a418ff5c3442ee3f3b", symbol: "MAI", decimals: 18, price: "usd" },
  { token: "0xfc421ad3c883bf9e7c4f42de845c4e4405799e73", symbol: "GHO", decimals: 18, price: "usd" },
  { token: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", symbol: "USDe", decimals: 18, price: "usd" },
  { token: "0x9c9e5fd8bbc25984b178fdce6117defa39d2db39", symbol: "BUSD", decimals: 18, price: "usd" },
  { token: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", symbol: "WAVAX", decimals: 18, price: "avax" },
  { token: "0x0000000000000000000000000000000000000000", symbol: "AVAX", decimals: 18, price: "avax" },
  { token: "0x152b9d0fdc40c096757f570a51e494bd4b943e50", symbol: "BTC.b", decimals: 8, price: "btc" },
  { token: "0x50b7545627a5162f82a992c33b87adc75187b218", symbol: "WBTC.e", decimals: 8, price: "btc" },
  { token: "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", symbol: "WETH.e", decimals: 18, price: "eth" },
  { token: "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be", symbol: "sAVAX", decimals: 18, price: "savax" },
  { token: "0x5947bb275c521040051d82396192181b413227a3", symbol: "LINK.e", decimals: 18, price: "link" },
  { token: "0xc891eb4cbdeff6e073e859e987815ed1505c2acd", symbol: "EURC", decimals: 6, price: "eurc" },
  { token: "0x8729438eb15e2c8b576fcc6aecda6a148776c0f5", symbol: "QI", decimals: 18, price: "qi" },
  { token: "0x63a72806098bd3d9520cc43356dd78afe5d386d9", symbol: "AAVE.e", decimals: 18, price: "" },
  { token: "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2", symbol: "sUSDe", decimals: 18, price: "" },
  { token: "0x7bfd4ca2a6cf3a3fddd645d10b323031afe47ff0", symbol: "rsETH", decimals: 18, price: "" },
  { token: "0xbc78d84ba0c46dfe32cf2895a19939c86b81a777", symbol: "SolvBTC", decimals: 18, price: "btc" },
  { token: "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd", symbol: "JOE", decimals: 18, price: "" },
  { token: "0x420fca0121dc28039145009570975747295f2329", symbol: "COQ", decimals: 18, price: "" },
  { token: "0x5e0e90e268bc247cc850c789a0db0d5c7621fb59", symbol: "NXPC", decimals: 18, price: "" },
];

/** the swaps a price is read from: the pool, what its token0 and token1 are, and the event; checked on the box 2026-09-27 */
export const LENDING_PRICE_POOLS = {
  /** Uniswap v3 WAVAX/USDC: USDC per WAVAX */
  avax: "0xfae3f424a0a47706811521e3ee268f00cfb5c45e",
  /** Uniswap v3 BTC.b/USDC: USDC per BTC.b */
  btc: "0x2e587b9e7aa638d7eb7db5fe7447513bc4d0d28b",
  /** Uniswap v3 WETH.e/WAVAX: WAVAX per WETH.e */
  eth: "0x7b602f98d71715916e7c963f51bfebc754ade2d0",
  /** Uniswap v3 LINK.e/WAVAX: WAVAX per LINK.e */
  link: "0xeb7e0191f4054868d97f33ca7a4176b226ccbd2f",
  /** Uniswap v3 USDC/EURC: EURC per USDC */
  eurc: "0x975d4286bdb7b2989c8129f0b7c1299b166a11b3",
  /** Trader Joe v1 QI/WAVAX (a v2 Swap): WAVAX per QI */
  qi: "0x2774516897ac629ad3ed9dcac7e375dda78412b9",
} as const;

/** sAVAX: its Submitted logs give the AVAX a share is worth */
export const SAVAX = "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be";

/** each event by topic0, keccak of its signature (checked with viem, and against dexreg's and qaudit's lists) */
export const LENDING_TOPICS = {
  supply: "2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61",
  withdraw: "3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7",
  borrow: "b3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0",
  repay: "a534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051",
  liquidation: "e413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
  flashLoan: "efefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0",
  reserveData: "804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a",
  reserveInitialized: "3a0ca721fc364424566385a1aa271ed508cc2c0949c2272575fb3013a163a45f",
  scaledMint: "458f5fa412d0f69b08dd84872b0215675cc67bc1d5b6fd93300a1c3878b86196",
  scaledBurn: "4cf25bc1d991c17529c25213d3cc0cda295eeaad5f13f361969b12ea48015f90",
  qiMint: "4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  qiRedeem: "e5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929",
  qiBorrow: "13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a2dacc1c4ca8984ab80",
  qiRepay: "1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1",
  qiLiquidate: "298637f684da70674f26509b10f07ec2fbc77a335ab1e7d6215a4b2484d8bb52",
  accrueInterest: "4dec04e750ca11537cabcd8a9eab06494de08da3735bc8871cd41250e190bc04",
  reservesAdded: "a91e67c5ea634cd43a12c5a482724b03de01e85ca68702a53d0c2f45cb7c1dc5",
  reservesReduced: "3bad0c59cf2f06e7314077049f48a93578cd16f5ef92329f1dab1420a99c177e",
  newReserveFactor: "aaa68312e2ea9d50e16af5068410ab56e1a1fd06037b1a35664812c30f821460",
  submitted: "bb0070894135d02edfa550b04d7e5e141aa8090b46e57597ad45bfedd6554498",
  v3Swap: "c42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  v2Swap: "d78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
} as const;

/** the assets Aave lends, from the registry's aTokens: lending_tokens holds these, since Benqi's markets carry their own
    decimals and price kind */
export const AAVE_ASSETS: readonly LendingToken[] = (() => {
  const assets = new Set(LISTED.filter((e) => e.family === "aave-v3" && e.role === "atoken").map((e) => lower(e.underlying)));
  return LENDING_TOKENS.filter((t) => assets.has(t.token));
})();

/** when the token list was last checked, for the answer's source line */
export const LENDING_LISTED_AT = Date.UTC(2026, 8, 27);

const hexOf = (h: string) => `unhex('${h.replace(/^0x/, "")}')`;

/** the names a lending query uses for the protocols' topics and contracts; the server defines each name a query reads
    (sources.ts), so a query spends its bytes on logic, not on hex. price_pools is in LENDING_PRICE_POOLS's order, then sAVAX */
export const LENDING_NAMES: Record<string, string> = {
  aave_pool: hexOf(AAVE_POOL),
  aave_configurator: hexOf(AAVE_CONFIGURATOR),
  supply_t: hexOf(LENDING_TOPICS.supply),
  withdraw_t: hexOf(LENDING_TOPICS.withdraw),
  borrow_t: hexOf(LENDING_TOPICS.borrow),
  repay_t: hexOf(LENDING_TOPICS.repay),
  liquidation_t: hexOf(LENDING_TOPICS.liquidation),
  flash_loan_t: hexOf(LENDING_TOPICS.flashLoan),
  reserve_data_t: hexOf(LENDING_TOPICS.reserveData),
  reserve_init_t: hexOf(LENDING_TOPICS.reserveInitialized),
  scaled_mint_t: hexOf(LENDING_TOPICS.scaledMint),
  scaled_burn_t: hexOf(LENDING_TOPICS.scaledBurn),
  qi_mint_t: hexOf(LENDING_TOPICS.qiMint),
  qi_redeem_t: hexOf(LENDING_TOPICS.qiRedeem),
  qi_borrow_t: hexOf(LENDING_TOPICS.qiBorrow),
  qi_repay_t: hexOf(LENDING_TOPICS.qiRepay),
  qi_liquidate_t: hexOf(LENDING_TOPICS.qiLiquidate),
  accrue_t: hexOf(LENDING_TOPICS.accrueInterest),
  reserves_added_t: hexOf(LENDING_TOPICS.reservesAdded),
  reserves_reduced_t: hexOf(LENDING_TOPICS.reservesReduced),
  reserve_factor_t: hexOf(LENDING_TOPICS.newReserveFactor),
  submitted_t: hexOf(LENDING_TOPICS.submitted),
  v3_swap: hexOf(LENDING_TOPICS.v3Swap),
  v2_swap: hexOf(LENDING_TOPICS.v2Swap),
  price_pools: `[${[...Object.values(LENDING_PRICE_POOLS), SAVAX].map(hexOf).join(", ")}]`,
};

/** the lending names a query reads and does not define itself (the DEX WITH names v2_swap), as WITH items: `unhex('…') AS supply_t` */
export function namesIn(query: string): string[] {
  return Object.entries(LENDING_NAMES)
    .filter(([name]) => new RegExp(`\\b${name}\\b`).test(query) && !new RegExp(`\\bAS\\s+${name}\\b`, "i").test(query))
    .map(([name, value]) => `${value} AS ${name}`);
}

/* A query on the lending contracts writes our server's names for them
   (aave_pool, flash_loan_t). A topic written out from memory is often
   wrong, and a wrong one reads no rows: L09 wrote a FlashLoan topic no
   log has and answered that Aave had no flash loans this week. */

/** the lending contracts' other events, so a query that writes one out right passes: Aave's Pool (collateral on and off,
    UserEModeSet, IsolationModeTotalDebtUpdated, MintedToTreasury, MintUnbacked, BackUnbacked, SwapBorrowRateMode,
    RebalanceStableBorrowRate, DeficitCreated, DeficitCovered, PositionManagerApproved and Revoked), its tokens'
    BalanceTransfer and BorrowAllowanceDelegated, an ERC-20's Transfer and Approval, and Benqi's Failure, NewComptroller,
    NewMarketInterestRateModel, NewProtocolSeizeShare, NewAdmin and NewPendingAdmin. Keccak of each signature (viem);
    Aave's Pool emitted none but these and the named ones on 2026-09-26 and 27 */
const OTHER_TOPICS = [
  "00058a56ea94653cdf4f152d227ace22d4c00ad99e2a43f58cb7d9e3feb295f2",
  "44c58d81365b66dd4b1a7f36c25aa97b8c71c361ee4937adc1a00000227db5dd",
  "d728da875fc88944cbf17638bcbe4af0eedaef63becd1d1c57cc097eb4608d84",
  "aef84d3b40895fd58c561f3998000f0583abb992a52fbdc99ace8e8de4d676a5",
  "bfa21aa5d5f9a1f0120a95e7c0749f389863cbdbfff531aa7339077a5bc919de",
  "f25af37b3d3ec226063dc9bdc103ece7eb110a50f340fe854bb7bc1b0676d7d0",
  "281596e92b2d974beb7d4f124df30a0b39067b096893e95011ce4bdad798b759",
  "7962b394d85a534033ba2efcf43cd36de57b7ebeb3de0ca4428965d9b3ddc481",
  "9f439ae0c81e41a04d3fdfe07aed54e6a179fb0db15be7702eb66fa8ef6f5300",
  "2bccfb3fad376d59d7accf970515eb77b2f27b082c90ed0fb15583dd5a942699",
  "84b203e49f1a4b553088061534231969a68ad1c81be192205e96d23a206cb26a",
  "540e692f36c2fa13e7583c4deeffd91ce6bc04f91e7d84f295d9d858372875fc",
  "08c92c3870d10c79e9673fecea8f4ff261f8e6b661067d9ca63fd777882bff15",
  "4beccb90f994c31aced7a23b5611020728a23d8ec5cddd1a3e9d97b96fda8666",
  "da919360433220e13b51e8c211e490d148e61a3bd53de8c097194e458b97f3e1",
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  "8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  "45b96fe442630264581b197e84bbada861235052c5a1aadfff9ea4e40a969aa0",
  "7ac369dbd14fa5ea3f473ed67cc9d598964a77501540ba6751eb0b3decf5870d",
  "edffc32e068c7c95dfd4bdfd5c4d939a084d6b11c4199eac8436ed234d72f926",
  "f5815f353a60e815cce7553e4f60c533a59d26b1b5504ea4b6db8d60da3e4da2",
  "f9ffabca9c8276e99321725bcb43fb076a6c66a54b7f21c4e8146d8519b417dc",
  "ca4f2f25d0898edd99413412fb94012f9e54ec8142f9b093e7720646a95b16a9",
];
const LENDING_EVENTS = new Set<string>([...Object.values(LENDING_TOPICS), ...OTHER_TOPICS]);
/** a query that reads Aave's or Benqi's contracts: by a lending shorthand, our names for them, their events or their
    tables, or by their addresses */
const READS_LENDING = new RegExp(
  `\\$(LEND|LIQUIDATIONS|DEBTS|MARKETS|PRICES)\\b|\\b(aave_pool|aave_configurator|lending_markets|lending_tokens|(supply|withdraw|borrow|repay|liquidation|flash_loan|reserve_data|reserve_init|scaled_mint|scaled_burn|qi_[a-z]+|accrue|reserves_added|reserves_reduced|reserve_factor)_t)\\b|${[AAVE_POOL, AAVE_CONFIGURATOR, ...LENDING_MARKETS.map((m) => m.market)].map(bare).join("|")}`,
  "i",
);
/* A priced asset's USD figure NULL in a row where the amount beside it is 0 (net_borrow_usd beside a net_borrow of 0)
   is a sum of usd over no rows, and it reads as an asset with no price: a replay of L05n showed WETH.e so, and its note said "Some
   assets lack USD prices", though WETH.e is priced. A note that says an asset has no price is held against the rows too:
   an asset has none only where its usd is NULL and its amount is not 0, or where the rows count unpriced events. */

/** the words of a note for an asset with no price: lack USD prices, has no price, is unpriced */
const NO_PRICE = /\b(?:lacks?|lacking|without|missing|no)\s+(?:a\s+)?(?:usd\s+|dollar\s+)?(?:prices?|usd\s+values?)\b|\bunpriced\b|\bnot\s+priced\b/i;
/** a row's asset as the reader knows it: the symbol of the first lending token among its values, else its first text */
function assetOf(row: Record<string, unknown>): { label: string; priced: boolean | null } {
  const values = Object.values(row).filter((v): v is string => typeof v === "string");
  for (const v of values) {
    const t = LENDING_TOKENS.find((x) => x.token === v.toLowerCase() || x.symbol === v);
    if (t) return { label: t.symbol, priced: t.price !== "" };
  }
  return { label: values[0] ?? "its first row", priced: null };
}

/** why a lending answer's USD figures misread as unpriced, or null: a priced asset's USD column NULL where its amount
    is 0, or a note that says an asset has no price over rows of priced assets, each with its USD figures and no unpriced
    event. Mainnet C-Chain only */
export function zeroUsd(sql: string, note: string, result: { columns: readonly { name: string }[]; rows: readonly Record<string, unknown>[] }, chainId: number): string | null {
  if (chainId !== LENDING_CHAIN_ID || !READS_LENDING.test(sql)) return null;
  const names = new Set(result.columns.map((c) => c.name));
  const usd = result.columns.map((c) => c.name).filter((n) => /(^|_)usd$/i.test(n));
  const says = NO_PRICE.test(note);
  for (const name of usd) {
    const amount = name.replace(/_usd$/i, "");
    if (amount === name || !names.has(amount)) continue;
    const empty = result.rows.filter((r) => r[name] === null && Number(r[amount]) === 0 && assetOf(r).priced === true);
    if (!empty.length) continue;
    const { label } = assetOf(empty[0]);
    const held = says ? ` The note says an asset has no USD price, but ${label} is priced: say it only of an asset whose usd is NULL where its amount is not 0.` : "";
    return `${name} is NULL in ${empty.length} ${empty.length === 1 ? "row" : "rows"} where ${amount} is 0, such as ${label}: a sum of usd over no rows, not a missing price. Write it so it is 0 where no event counts, as in if(countIf(action IN ('borrow', 'repay')) = 0, 0, sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay'))).${held} Then call render_chart again.`;
  }
  const unpriced = result.columns.some((c) => /unpriced/i.test(c.name) && result.rows.some((r) => Number(r[c.name]) > 0));
  if (says && usd.length && !unpriced && result.rows.every((r) => assetOf(r).priced === true && usd.every((n) => r[n] !== null)))
    return "The note says an asset has no USD price, but every row has its USD figures and no event is unpriced: leave that out, and call render_chart again with the same SQL.";
  return null;
}

/** the events only Aave's Pool writes here, and those only Benqi's markets write, by our names and by topic */
const POOL_EVENTS = ["supply", "withdraw", "borrow", "repay", "liquidation", "flashLoan", "reserveData"] as const;
const MARKET_EVENTS = ["qiMint", "qiRedeem", "qiBorrow", "qiRepay", "qiLiquidate", "accrueInterest", "reservesAdded", "reservesReduced", "newReserveFactor"] as const;
const nameOf = (event: string) => Object.entries(LENDING_NAMES).find(([, v]) => v === hexOf(LENDING_TOPICS[event as keyof typeof LENDING_TOPICS]))?.[0] ?? event;
const writes = (sql: string, events: readonly string[]) =>
  new RegExp(`\\b(${events.map(nameOf).join("|")})\\b`).test(sql) || literalsOf(sql, "topic0", 64).some((t) => events.some((e) => LENDING_TOPICS[e as keyof typeof LENDING_TOPICS] === t));
/** the lending names the DEX WITH defines as well */
const SHARED_NAMES = new Set(["v2_swap", "v3_swap", "submitted_t", "price_pools"]);
/** the contracts our server names, for an address written with its first digits right and the others wrong (a replay of
    L09 wrote 0x794a61eb… for Aave's Pool, 0x794a6135…) */
const NAMED_CONTRACTS = [
  ["aave_pool", "Aave's Pool", AAVE_POOL],
  ["aave_configurator", "Aave's PoolConfigurator", AAVE_CONFIGURATOR],
] as const;
const shown = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

/** the literals of `digits` hex digits a query compares `column` with: column = unhex('…'), and each one in column IN (…) */
function literalsOf(sql: string, column: string, digits: number): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(new RegExp(`\\b${column}\\s*(=|IN\\s*\\()`, "gi"))) {
    const from = (m.index ?? 0) + m[0].length;
    let to = from;
    if (m[1] !== "=") for (let depth = 1; to < sql.length && depth > 0; to++) depth += sql[to] === "(" ? 1 : sql[to] === ")" ? -1 : 0;
    const text = m[1] === "=" ? /^\s*unhex\s*\(\s*'[^']*'\s*\)/.exec(sql.slice(from))?.[0] ?? "" : sql.slice(from, to);
    for (const lit of text.matchAll(new RegExp(`unhex\\s*\\(\\s*'([0-9a-f]{${digits}})'\\s*\\)`, "gi"))) out.push(lit[1].toLowerCase());
  }
  return out;
}

/** why a query on the lending contracts reads no rows by a literal of its own, or null: an address that starts as one
    our server names and is not it, the Pool's or a market's events read at another address (a replay of L09 read
    Ethereum's Aave Pool), or a topic that is none of their events. Mainnet C-Chain only, as the names are */
export function strayHex(sql: string, chainId: number): string | null {
  if (chainId !== LENDING_CHAIN_ID) return null;
  // a name of ours that the query defines itself takes the query's value, and namesIn leaves it out; the swap and stake
  // topics and the price pools are the DEX WITH's names too, which a DEX query may write out
  const ours = Object.keys(LENDING_NAMES).filter((n) => !SHARED_NAMES.has(n)).join("|");
  const own = new RegExp(`\\bAS\\s+(${ours})\\b|\\b(${ours})\\s+AS\\s*\\(`, "i").exec(sql)?.slice(1).find(Boolean);
  if (own) return `${own} is a name our server defines in front of the query; a WITH of your own may not define it. Write ${own} as it is, and leave its value to the server`;
  for (const m of sql.matchAll(/unhex\s*\(\s*'([0-9a-f]{40})'\s*\)/gi)) {
    const h = m[1].toLowerCase();
    const near = NAMED_CONTRACTS.find(([, , a]) => bare(a) !== h && bare(a).slice(0, 6) === h.slice(0, 6));
    if (near) return `unhex('${shown(h)}') is not ${near[1]}, whose address our server names ${near[0]}: write ${near[0]}, as it is`;
  }
  if (!READS_LENDING.test(sql)) return null;
  // the Pool's events come from the Pool alone, and a market's from the markets
  const addresses = literalsOf(sql, "address", 40);
  const notPool = writes(sql, POOL_EVENTS) ? addresses.find((a) => a !== bare(AAVE_POOL)) : undefined;
  if (notPool)
    return `unhex('${shown(notPool)}') is not Aave's Pool on this chain, which writes these events: an address from memory is often another chain's, and reads no rows. Write aave_pool, as it is`;
  const notMarket = writes(sql, MARKET_EVENTS) ? addresses.find((a) => !LENDING_MARKETS.some((m) => bare(m.market) === a)) : undefined;
  if (notMarket)
    return `unhex('${shown(notMarket)}') is no Benqi market on this chain, where the markets write these events: read them from lending_markets, address IN (SELECT market FROM lending_markets WHERE chain_id = ${LENDING_CHAIN_ID})`;
  const topic = literalsOf(sql, "topic0", 64).find((t) => !LENDING_EVENTS.has(t));
  return topic
    ? `unhex('${shown(topic)}') is no event of Aave's or Benqi's contracts: a topic written from memory is often wrong, and this one reads no rows. Write the name our server defines for the event, as it is: supply_t, withdraw_t, borrow_t, repay_t, liquidation_t, flash_loan_t or reserve_data_t on aave_pool; qi_mint_t, qi_redeem_t, qi_borrow_t, qi_repay_t, qi_liquidate_t or accrue_t on a Benqi market`
    : null;
}

const KINDS: readonly PriceKind[] = ["", "usd", "avax", "btc", "eth", "savax", "link", "eurc", "qi"];

/** an asset's decimals and price kind; an asset the list lacks has neither, so a query counts it and never adds it up */
const tokenOf = (asset: string) => LENDING_TOKENS.find((t) => t.token === asset);

/** lending_markets as one SELECT: names once in arrays, a row of their indexes, the packed addresses, and the asset's
    decimals and price kind, so a Benqi query needs no second table */
export function marketsSql(chainId: number, markets: readonly LendingMarket[] = LENDING_MARKETS): string {
  const protocols = [...new Set(markets.map((m) => m.protocol))];
  const versions = [...new Set(markets.map((m) => m.version))];
  const rows = markets.map((m) => {
    const t = tokenOf(m.asset);
    return `(${protocols.indexOf(m.protocol) + 1},${versions.indexOf(m.version) + 1},'${packed(m.market)}','${packed(m.asset)}',${t?.decimals ?? 0},${KINDS.indexOf(t?.price ?? "")})`;
  });
  return (
    `SELECT toUInt64(${chainId}) AS chain_id, p[tupleElement(r, 1)] AS protocol, v[tupleElement(r, 2)] AS version, ` +
    `base64Decode(tupleElement(r, 3)) AS market, base64Decode(tupleElement(r, 4)) AS asset, toUInt8(tupleElement(r, 5)) AS decimals, ` +
    `arrayElement(${strings(KINDS)}, tupleElement(r, 6) + 1) AS price ` +
    `FROM (SELECT ${strings(protocols)} AS p, ${strings(versions)} AS v, arrayJoin([${rows.join(",")}]) AS r)`
  );
}

/** lending_tokens as one SELECT: each token's packed address, decimals and price kind */
export function lendingTokensSql(chainId: number, tokens: readonly LendingToken[] = AAVE_ASSETS): string {
  const rows = tokens.map((t) => `('${packed(t.token)}',${t.decimals},${KINDS.indexOf(t.price)})`);
  return (
    `SELECT toUInt64(${chainId}) AS chain_id, base64Decode(tupleElement(r, 1)) AS token, toUInt8(tupleElement(r, 2)) AS decimals, ` +
    `arrayElement(${strings(KINDS)}, tupleElement(r, 3) + 1) AS price FROM (SELECT arrayJoin([${rows.join(",")}]) AS r)`
  );
}

/** the markets for one query in `room` bytes: a query that keeps one version (version = 'core') gets only that
    version's markets; then those it names by address, then the registry's order */
export function marketsFor(query: string, room: number, all: readonly LendingMarket[] = LENDING_MARKETS) {
  const q = query.toLowerCase();
  const only = /\bversion\s*=\s*'([a-z]+)'/.exec(q)?.[1];
  const kept = only && all.some((m) => m.version === only) ? all.filter((m) => m.version === only) : all;
  return fitting(kept, (m) => q.includes(bare(m.market)) || q.includes(bare(m.asset)), (xs) => marketsSql(LENDING_CHAIN_ID, xs), room);
}

/** the tokens for one query in `room` bytes: those it names, then the list's order */
export function lendingTokensFor(query: string, room: number, all: readonly LendingToken[] = AAVE_ASSETS) {
  const q = query.toLowerCase();
  return fitting(all, (t) => q.includes(bare(t.token)), (xs) => lendingTokensSql(LENDING_CHAIN_ID, xs), room);
}

/** the lending protocols' names and slugs, and the words of a lending question */
const LENDING_NAMES_WORDS = [...new Set(Object.entries(LENDING_PROTOCOLS).flatMap(([slug, name]) => [slug, slug.replace(/-/g, " "), name]))];
const LENDING_WORDS = new RegExp(
  `\\b(${[...LENDING_NAMES_WORDS.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "qi[A-Z]\\w*", "lend(s|ing|ers?)?", "borrow(s|ed|ers?|ing)?", "loans?", "deposit(s|ed|ors?)?", "withdraw(s|als?|n)?", "repa(y|ys|id|yments?)", "liquidat\\w*", "collateral", "assets?", "utili[sz]\\w*", "apy|apr", "interest", "debts?", "flash[ -]?loans?"].join("|")})\\b`,
  "i",
);

/** a question about lending, whose prompt carries the lending chapter: it names Aave, Benqi, a qiToken or a lending word,
    or an earlier turn read the lending tables. Every other question's prompt is the one it was */
export function lendingQuestion(chainId: number, prompt: string, history: { prompt?: string; sql?: string }[] = []): boolean {
  if (chainId !== LENDING_CHAIN_ID || LENDING_MARKETS.length === 0) return false;
  const about = (q: string) => LENDING_WORDS.test(q);
  return about(prompt) || history.some((t) => about(t.prompt ?? "") || /\b(lending_(markets|tokens)|aave_pool|accrue_t)\b/.test(t.sql ?? ""));
}

/* ------------------------------------------------------------------ */
/* The WITHs the lending shorthand stands for (macros.ts). Each one is a
   read of the protocols' own events, checked against qaudit's truth on
   the box on 2026-09-27. The names in them (supply_t, aave_pool, …)
   are the server's, defined in front of the query (sources.ts). */

const C = LENDING_CHAIN_ID;
/** word k of a log's data from byte `at`, as a number; toFloat64 first, so no sum wraps */
const W = (at: number | string, src = "data") => `toFloat64(reinterpretAsUInt256(reverse(substring(${src}, ${at}, 32))))`;
/** a log's first n data words, as X */
const WORDS = (n: number) => `arrayMap(k -> toFloat64(reinterpretAsUInt256(reverse(substring(data, k, 32)))), [${[1, 33, 65, 97, 129].slice(0, n).join(", ")}]) AS X`;
const TOK = `(SELECT token, decimals, price FROM lending_tokens WHERE chain_id = ${C})`;
/** Benqi's core markets, read once in each WITH that reads them: each market a FixedString(20) like raw_logs.address, so
    a join or an IN on the address keeps a market that ends in 00 (see fixed below); asset stays a String, like an address
    read from a log */
const CORE = "qi_core";
const CORE_CTE = `${CORE} AS (SELECT * REPLACE (toFixedString(market, 20) AS market) FROM lending_markets WHERE chain_id = ${C} AND version = 'core')`;
/** the core markets' WITH, for a side that reads Benqi */
const core = (side: Side) => (side === "aave" ? "" : `${CORE_CTE}, `);
const med = (n: number) => `ifNotFinite(quantileExactIf(0.5)(q, p = ${n}), NULL)`;
const SWAPPED = (at: number) => `abs(toFloat64(reinterpretAsInt256(reverse(substring(data, ${at}, 32)))))`;
/** the prices of now: one row of medians over the last 24 hours, so a kind with no swap yet today still has one */
const NOW_PRICES = "now() - INTERVAL 1 DAY";
const NOW = "CROSS JOIN (SELECT px FROM lpx ORDER BY d DESC LIMIT 1) AS x";
/** a USD value, or NULL for an asset with no price */
const usd = (amount: string, kind: string, x = "x") => `${amount} * nullIf(${x}.px[${kind}], 0)`;

/** USD prices by kind for each d (a day, an hour, or one row for now) from `from`: medians of the price pools' swaps, and sAVAX's AVAX rate */
function pricesCte(from: string, d = "toDate(block_time)", end = ""): string {
  const q = `multiIf(topic0 = submitted_t, X[1] / X[2], topic0 = v2_swap, (X[2] + X[4]) / (X[1] + X[3]), ${SWAPPED(33)} / ${SWAPPED(1)})`;
  return (
    `lpx AS (SELECT ${d} AS d, ${med(1)} * 1e12 AS avax, map('usd', 1., 'avax', avax, 'btc', ${med(2)} * 100, 'eth', ${med(3)} * avax, 'link', ${med(4)} * avax, 'eurc', 1 / ${med(5)}, 'qi', ${med(6)} * avax, 'savax', ${med(7)} * avax) AS px ` +
    `FROM (SELECT block_time, indexOf(price_pools, address) AS p, ${WORDS(4)}, ${q} AS q FROM raw_logs WHERE chain_id = ${C} AND block_time >= ${from}${end} AND has(price_pools, address) AND topic0 IN (v3_swap, v2_swap, submitted_t)) WHERE q > 0 AND isFinite(q) GROUP BY d)`
  );
}

/** the kinds whose price pool quotes them in AVAX: their USD price is the ratio times the hour's AVAX price */
const IN_AVAX = "('avax', 'eth', 'link', 'qi', 'savax')";

/** each price kind's ratio per hour from `from` (USD for a stablecoin, BTC and EURC, AVAX for the others), as rows lp(d, k, v),
    and lpx(d, avax), the hour's AVAX price. sAVAX stakes and the small pools skip hours, so a query takes a kind's last ratio */
function hourPricesCte(from: string, end: string): string {
  const q = `multiIf(topic0 = submitted_t, X[1] / X[2], topic0 = v2_swap, (X[2] + X[4]) / (X[1] + X[3]), ${SWAPPED(33)} / ${SWAPPED(1)})`;
  return (
    `lpx AS (SELECT toStartOfHour(block_time) AS d, ${med(1)} * 1e12 AS avax, map('usd', 1., 'avax', 1., 'btc', ${med(2)} * 100, 'eth', ${med(3)}, 'link', ${med(4)}, 'eurc', 1 / ${med(5)}, 'qi', ${med(6)}, 'savax', ${med(7)}) AS px ` +
    `FROM (SELECT block_time, indexOf(price_pools, address) AS p, ${WORDS(4)}, ${q} AS q FROM raw_logs WHERE chain_id = ${C} AND block_time >= ${from}${end} AND has(price_pools, address) AND topic0 IN (v3_swap, v2_swap, submitted_t)) WHERE q > 0 AND isFinite(q) GROUP BY d), ` +
    `lp AS (SELECT d, k, v FROM lpx ARRAY JOIN mapKeys(px) AS k, mapValues(px) AS v WHERE v > 0)`
  );
}

type Side = "aave" | "benqi" | "both";
const sideOf = (slug: string | undefined): Side => (slug === AAVE_SLUG ? "aave" : slug ? "benqi" : "both");
const join = (side: Side, aave: string, benqi: string) => (side === "aave" ? aave : side === "benqi" ? benqi : `${aave} UNION ALL ${benqi}`);

/** the end of a window, as a filter on `col`, or nothing for a window that runs to now */
const until = (col: string, end?: string) => (end ? ` AND ${col} < ${end}` : "");

/** the asset of an Aave action: a flash loan names it in topic2, every other action in topic1 */
const FLASH_ASSET = "substring(if(a.topic0 = flash_loan_t, a.topic2, a.topic1), 13, 20)";
/** every supply, withdrawal, borrow, repayment and Aave flash loan from `start` (to `end`): who, the asset, the amount in
    its units and in USD at the hour's price, and a flash loan's premium in both */
export function lendWith(start: string, end?: string, slug?: string): string {
  const aave =
    `SELECT a.block_time AS t, '${AAVE_SLUG}' AS protocol, multiIf(a.topic0 = supply_t, 'supply', a.topic0 = withdraw_t, 'withdraw', a.topic0 = borrow_t, 'borrow', a.topic0 = flash_loan_t, 'flash_loan', 'repay') AS action, ${FLASH_ASSET} AS asset, ` +
    `if(a.topic0 = flash_loan_t, substring(a.data, 13, 20), substring(a.topic2, 13, 20)) AS who, ${W("if(a.topic0 IN (supply_t, borrow_t, flash_loan_t), 33, 1)", "a.data")} / pow(10, k.decimals) AS amount, ` +
    `if(a.topic0 = flash_loan_t, ${W(97, "a.data")} / pow(10, k.decimals), 0) AS premium, k.price AS kind, a.transaction_hash AS tx ` +
    `FROM raw_logs AS a LEFT JOIN ${TOK} AS k ON ${FLASH_ASSET} = k.token WHERE a.chain_id = ${C} AND a.block_time >= ${start}${until("a.block_time", end)} AND a.address = aave_pool AND a.topic0 IN (supply_t, withdraw_t, borrow_t, repay_t, flash_loan_t)`;
  const benqi =
    `SELECT l.block_time AS t, m.protocol AS protocol, multiIf(l.topic0 = qi_mint_t, 'supply', l.topic0 = qi_redeem_t, 'withdraw', l.topic0 = qi_borrow_t, 'borrow', 'repay') AS action, m.asset AS asset, ` +
    `substring(l.data, if(l.topic0 = qi_repay_t, 45, 13), 20) AS who, ${W("if(l.topic0 = qi_repay_t, 65, 33)", "l.data")} / pow(10, m.decimals) AS amount, 0 AS premium, m.price AS kind, l.transaction_hash AS tx ` +
    `FROM raw_logs AS l INNER JOIN ${CORE} AS m ON l.address = m.market WHERE l.chain_id = ${C} AND l.block_time >= ${start}${until("l.block_time", end)} AND l.topic0 IN (qi_mint_t, qi_redeem_t, qi_borrow_t, qi_repay_t)`;
  // the kind's last ratio at or before the event (ASOF), times the AVAX price of the event's hour for a kind quoted in AVAX;
  // the prices start a day before the window (a start such as toMonday(now()) is a Date, which toStartOfHour does not take)
  return (
    `WITH ${hourPricesCte(`toStartOfHour(toDateTime(${start})) - INTERVAL 1 DAY`, until("block_time", end))}, ${core(sideOf(slug))}ev AS (${join(sideOf(slug), aave, benqi)}), ` +
    `actions AS (SELECT e.*, e.amount * (nullIf(r.v, 0) * if(e.kind IN ${IN_AVAX}, nullIf(x.avax, 0), 1) AS hour_price) AS usd, e.premium * hour_price AS premium_usd FROM ev AS e ASOF LEFT JOIN lp AS r ON e.kind = r.k AND e.t >= r.d LEFT JOIN lpx AS x ON toStartOfHour(e.t) = x.d)`
  );
}

/** Benqi's liquidator gets 97% of the seized qiTokens; the market keeps 3% as reserves (protocolSeizeShareMantissa, 0.03 on all 15 Core markets by RPC, 2026-09-27) */
const BENQI_LIQUIDATOR_SHARE = 0.97;

/** every liquidation from `start` (to `end`): the borrower, the liquidator, the debt repaid and the collateral seized, in units and in USD at the hour's price */
export function liquidationsWith(start: string, end?: string, slug?: string): string {
  const side = sideOf(slug);
  // a Benqi collateral is qiTokens: seizeTokens times the market's exchange rate, a mint's or redemption's amount per qiToken
  const xr = `xr AS (SELECT address AS mk, quantileExact(0.5)(${W(33)} / ${W(65)}) AS rate FROM raw_logs WHERE chain_id = ${C} AND block_time >= now() - INTERVAL 30 DAY AND address IN (SELECT market FROM ${CORE}) AND topic0 IN (qi_mint_t, qi_redeem_t) AND ${W(65)} > 0 GROUP BY mk)`;
  const aave =
    `SELECT a.block_time AS t, '${AAVE_SLUG}' AS protocol, substring(a.topic3, 13, 20) AS borrower, substring(a.data, 77, 20) AS liquidator, substring(a.topic2, 13, 20) AS debt_asset, ${W(1, "a.data")} / pow(10, dk.decimals) AS debt_amount, dk.price AS dkind, ` +
    `substring(a.topic1, 13, 20) AS collateral_asset, ${W(33, "a.data")} / pow(10, ck.decimals) AS collateral_amount, ck.price AS ckind, 1. AS share, a.transaction_hash AS tx ` +
    `FROM raw_logs AS a LEFT JOIN ${TOK} AS dk ON substring(a.topic2, 13, 20) = dk.token LEFT JOIN ${TOK} AS ck ON substring(a.topic1, 13, 20) = ck.token WHERE a.chain_id = ${C} AND a.block_time >= ${start}${until("a.block_time", end)} AND a.address = aave_pool AND a.topic0 = liquidation_t`;
  const benqi =
    `SELECT l.block_time AS t, m.protocol AS protocol, substring(l.data, 45, 20) AS borrower, substring(l.data, 13, 20) AS liquidator, m.asset AS debt_asset, ${W(65, "l.data")} / pow(10, m.decimals) AS debt_amount, m.price AS dkind, ` +
    `c.asset AS collateral_asset, ${W(129, "l.data")} * xr.rate / pow(10, c.decimals) AS collateral_amount, c.price AS ckind, ${BENQI_LIQUIDATOR_SHARE} AS share, l.transaction_hash AS tx ` +
    `FROM raw_logs AS l INNER JOIN ${CORE} AS m ON l.address = m.market INNER JOIN ${CORE} AS c ON toFixedString(substring(l.data, 109, 20), 20) = c.market LEFT JOIN xr ON c.market = xr.mk WHERE l.chain_id = ${C} AND l.block_time >= ${start}${until("l.block_time", end)} AND l.topic0 = qi_liquidate_t`;
  const parts = [pricesCte(`toStartOfDay(${start})`, "toStartOfHour(block_time)"), ...(side === "aave" ? [] : [CORE_CTE, xr]), `lq AS (${join(side, aave, benqi)})`];
  return `WITH ${parts.join(", ")}, liquidations AS (SELECT lq.*, ${usd("debt_amount", "dkind")} AS debt_usd, ${usd("collateral_amount", "ckind")} AS collateral_usd, collateral_usd * share AS received_usd FROM lq LEFT JOIN lpx AS x ON toStartOfHour(lq.t) = x.d)`;
}

/** an address read from a topic or a data word, as a FixedString(20) like raw_logs.address. A join or an IN of the
    address against a String casts the address to a String, which drops its trailing zero bytes, so an address that
    ends in 00 matches nothing: aAvaUSDe (0x6533…fb00) lost every Mint and Burn, and $MARKETS showed USDe at 0 supplied */
const fixed = (bytes: string) => `toFixedString(${bytes}, 20)`;

/** Aave's reserves: each asset's aToken and variable debt token, from the PoolConfigurator */
const RESERVES = `res AS (SELECT substring(topic1, 13, 20) AS asset, ${fixed("substring(topic2, 13, 20)")} AS atoken, ${fixed("substring(data, 45, 20)")} AS vdebt FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2022-03-01' AND address = aave_configurator AND topic0 = reserve_init_t)`;
/** a scaled balance's change in one aToken or debt token Mint or Burn: (value - balanceIncrease) / index, or -(value + balanceIncrease) / index */
const SCALED = "if(topic0 = scaled_mint_t, X[1] - X[2], -(X[1] + X[2])) / X[3]";

/** each borrower's debt now, per asset, on one protocol: a scaled balance times the newest index (Aave), or the newest accountBorrows grown by the borrow index since (Benqi) */
export function debtsWith(slug: string): string {
  if (sideOf(slug) === "aave") {
    const sd = `sd AS (SELECT tok, user, sum(ds) AS s FROM (SELECT address AS tok, if(topic0 = scaled_mint_t, substring(topic2, 13, 20), substring(topic1, 13, 20)) AS user, ${WORDS(3)}, ${SCALED} AS ds FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2022-03-01' AND address IN (SELECT vdebt FROM res) AND topic0 IN (scaled_mint_t, scaled_burn_t)) GROUP BY tok, user HAVING s > 0)`;
    const ix = `ix AS (SELECT substring(topic1, 13, 20) AS asset, argMax(${W(129)}, (block_number, log_index)) AS vi FROM raw_logs WHERE chain_id = ${C} AND block_time >= now() - INTERVAL 180 DAY AND address = aave_pool AND topic0 = reserve_data_t GROUP BY asset)`;
    return (
      `WITH ${pricesCte(NOW_PRICES, "toDate(now())")}, ${RESERVES}, ${sd}, ${ix}, debts AS (SELECT '${AAVE_SLUG}' AS protocol, sd.user AS borrower, res.asset AS asset, sd.s * ix.vi / pow(10, k.decimals) AS amount, ${usd("amount", "k.price")} AS usd ` +
      `FROM sd INNER JOIN res ON sd.tok = res.vdebt INNER JOIN ix ON res.asset = ix.asset LEFT JOIN ${TOK} AS k ON res.asset = k.token ${NOW})`
    );
  }
  const acts = `acts AS (SELECT address AS mk, if(topic0 = qi_borrow_t, substring(data, 13, 20), substring(data, 45, 20)) AS who, argMax(if(topic0 = qi_borrow_t, ${W(65)}, ${W(97)}), (block_number, log_index)) AS ab, max(block_number) AS bn FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2021-08-01' AND address IN (SELECT market FROM ${CORE}) AND topic0 IN (qi_borrow_t, qi_repay_t) GROUP BY mk, who HAVING ab > 0)`;
  const acc = `acc AS (SELECT address AS mk, block_number AS bn, ${W(65)} AS bi FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2021-08-01' AND address IN (SELECT market FROM ${CORE}) AND topic0 = accrue_t)`;
  return (
    `WITH ${pricesCte(NOW_PRICES, "toDate(now())")}, ${CORE_CTE}, ${acts}, ${acc}, debts AS (SELECT m.protocol AS protocol, a.who AS borrower, m.asset AS asset, a.ab * cur.bnow / nullIf(z.bi, 0) / pow(10, m.decimals) AS amount, ${usd("amount", "m.price")} AS usd ` +
    `FROM acts AS a ASOF LEFT JOIN acc AS z ON a.mk = z.mk AND a.bn >= z.bn INNER JOIN (SELECT mk, argMax(bi, bn) AS bnow FROM acc GROUP BY mk) AS cur ON a.mk = cur.mk INNER JOIN ${CORE} AS m ON a.mk = m.market ${NOW})`
  );
}

/** each market now: supplied and borrowed in units and USD, utilization, TVL, and Aave's rates. Benqi supplied is
    cash + borrows - reserves, with the reserves rebuilt from the events (within 0.001% of totalReserves() by RPC).
    TVL is what is left to lend, never below zero: an Aave market lent out in full owes its treasury interest that is
    not minted yet, so its supplied less borrowed dips just below zero */
export function marketsWith(slug?: string): string {
  const side = sideOf(slug);
  const cols = "protocol, asset, supplied, borrowed, reserves, supply_apy_pct, borrow_apy_pct, dec, kind";
  const apy = (rate: string) => `round(100 * (pow(1 + ${rate} / 1e27 / 31536000, 31536000) - 1), 3)`;
  const aave = [
    `ares AS (SELECT substring(topic1, 13, 20) AS asset, arrayJoin([(${fixed("substring(topic2, 13, 20)")}, 1), (${fixed("substring(data, 45, 20)")}, 0)]) AS ts FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2022-03-01' AND address = aave_configurator AND topic0 = reserve_init_t)`,
    `tot AS (SELECT r.asset AS asset, sumIf(l.s, r.ts.2 = 1) AS sa, sumIf(l.s, r.ts.2 = 0) AS sd FROM (SELECT address, ${WORDS(3)}, ${SCALED} AS s FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2022-03-01' AND topic0 IN (scaled_mint_t, scaled_burn_t)) AS l INNER JOIN ares AS r ON l.address = r.ts.1 GROUP BY asset)`,
    `idx AS (SELECT asset, argMax((X[1], X[3], X[4], X[5]), at) AS ix FROM (SELECT substring(topic1, 13, 20) AS asset, (block_number, log_index) AS at, ${WORDS(5)} FROM raw_logs WHERE chain_id = ${C} AND block_time >= now() - INTERVAL 180 DAY AND address = aave_pool AND topic0 = reserve_data_t) GROUP BY asset)`,
    `aave AS (SELECT '${AAVE_SLUG}' AS protocol, tot.asset AS asset, sa * ix.3 / pow(10, k.decimals) AS supplied, sd * ix.4 / pow(10, k.decimals) AS borrowed, nullIf(0., 0) AS reserves, ${apy("ix.1")} AS supply_apy_pct, ${apy("ix.2")} AS borrow_apy_pct, k.decimals AS dec, k.price AS kind FROM tot LEFT JOIN idx ON tot.asset = idx.asset LEFT JOIN ${TOK} AS k ON tot.asset = k.token)`,
  ];
  // one read of the accruals over all time; the other events only in each market's last block, where the moves after its last accrual are
  const benqi = [
    `brare AS (SELECT address AS mk, argMaxIf(X[3], at, topic0 != reserve_factor_t) AS r_base, maxIf(at, topic0 != reserve_factor_t) AS r_at, argMaxIf(X[2], at, topic0 = reserve_factor_t) / 1e18 AS r_factor FROM (SELECT address, topic0, (block_number, log_index) AS at, ${WORDS(3)} FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2021-08-01' AND address IN (SELECT market FROM ${CORE}) AND topic0 IN (reserves_added_t, reserves_reduced_t, reserve_factor_t)) GROUP BY mk)`,
    `la AS (SELECT a.mk AS mk, argMax(a.X, a.at) AS last, max(a.at) AS a_at, sumIf(a.X[2], a.at > r.r_at) AS int_after, any(r.r_base) AS base, any(r.r_factor) AS rf FROM (SELECT address AS mk, (block_number, log_index) AS at, ${WORDS(4)} FROM raw_logs WHERE chain_id = ${C} AND block_time >= '2021-08-01' AND address IN (SELECT market FROM ${CORE}) AND topic0 = accrue_t) AS a LEFT JOIN brare AS r ON a.mk = r.mk GROUP BY a.mk)`,
    `tail AS (SELECT address AS mk, (block_number, log_index) AS at, topic0 AS e, substring(data, 13, 20) = address AS own, ${WORDS(5)} FROM raw_logs WHERE chain_id = ${C} AND block_number IN (SELECT a_at.1 FROM la) AND address IN (SELECT market FROM ${CORE}) AND topic0 IN (qi_mint_t, qi_redeem_t, qi_borrow_t, qi_repay_t, reserves_added_t, reserves_reduced_t))`,
    // cash: the last cashPrior and the moves after it; a ReservesAdded from the market itself is the 3% of a seizure and moves no cash
    `benqi AS (SELECT m.protocol AS protocol, m.asset AS asset, any(la.last)[1] + sumIf(multiIf(t.e = qi_mint_t OR (t.e = reserves_added_t AND NOT t.own), t.X[2], t.e IN (qi_redeem_t, qi_borrow_t, reserves_reduced_t), -t.X[2], t.e = qi_repay_t, t.X[3], 0), t.at > la.a_at) AS cash_raw, ` +
      `maxIf(t.at, t.e IN (qi_borrow_t, qi_repay_t) AND t.at > la.a_at) AS b_at, if(b_at > any(la.a_at), argMaxIf(if(t.e = qi_repay_t, t.X[5], t.X[4]), t.at, t.e IN (qi_borrow_t, qi_repay_t) AND t.at > la.a_at), any(la.last)[4]) AS borrowed_raw, ` +
      `any(la.base) + any(la.int_after) * any(la.rf) AS reserves_raw, any(m.decimals) AS dec, any(m.price) AS kind, (cash_raw + borrowed_raw - reserves_raw) / pow(10, dec) AS supplied, borrowed_raw / pow(10, dec) AS borrowed, toNullable(reserves_raw / pow(10, dec)) AS reserves, ` +
      `nullIf(0., 0) AS supply_apy_pct, nullIf(0., 0) AS borrow_apy_pct FROM la LEFT JOIN tail AS t ON la.mk = t.mk INNER JOIN ${CORE} AS m ON la.mk = m.market GROUP BY m.protocol, m.asset)`,
  ];
  const parts = [pricesCte(NOW_PRICES, "toDate(now())"), ...(side === "benqi" ? [] : aave), ...(side === "aave" ? [] : [CORE_CTE, ...benqi])];
  const union = join(side, `SELECT ${cols} FROM aave`, `SELECT ${cols} FROM benqi`);
  return (
    `WITH ${parts.join(", ")}, markets AS (SELECT u.protocol AS protocol, u.asset AS asset, u.supplied AS supplied, u.borrowed AS borrowed, u.reserves AS reserves, ${usd("u.supplied", "u.kind")} AS supplied_usd, ${usd("u.borrowed", "u.kind")} AS borrowed_usd, ` +
    `round(100 * u.borrowed / nullIf(u.supplied, 0), 2) AS utilization_pct, greatest(supplied_usd - borrowed_usd, 0) AS tvl_usd, u.supply_apy_pct AS supply_apy_pct, u.borrow_apy_pct AS borrow_apy_pct FROM (${union}) AS u ${NOW})`
  );
}

/** the day's prices alone, for a query that values amounts of its own */
export function pricesWith(start: string, end?: string): string {
  return `WITH ${pricesCte(`toDate(${start})`, undefined, until("block_time", end))}`;
}
