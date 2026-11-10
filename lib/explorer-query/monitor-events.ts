/* The DeFi events a Query monitor watches on the C-Chain, read from the
   RPC block by block: the contracts that emit each one, its topic0, and
   where each field of its log sits. Contracts come from the contract
   registry the dApp pages read (data/contract-registry.json). A factory's
   pools are not listed: the route keeps a pool once its poolCheck names one
   of the def's factories. Every def was decoded on a real log of the
   public RPC and matched viem's decodeEventLog
   (tests/unit/explorer/monitor-events.test.ts). Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";

export type MonitorFamily = "token" | "dex" | "lending" | "staking" | "bridge" | "vault";

/** a field of a log: topic `index` (1 to 3) or data word `index` (0-based, 32 bytes each), read as `type`. A smaller
    uint or int (uint8 to uint128, int128) reads as uint256 or int256, exact since the ABI pads and sign-extends it;
    uint128lo and uint128hi are the low and high halves of a packed bytes32 */
export interface FieldDef {
  name: string;
  from: "topic" | "data";
  index: number;
  type: "address" | "uint256" | "int256" | "bytes32" | "bool" | "uint128hi" | "uint128lo" | "int24" | "uint24" | "uint160";
}

/** how the route tells a pool of the def's factories, once per pool: call `getter` on the pool, which returns its
    factory, or call isPair(pool) on each factory, which returns true for its own pairs (a Solidly pair has no factory
    getter, and an LB pair's is getFactory(); both revert on factory()) */
export type PoolCheck = { getter: "factory()" | "getFactory()" } | { onFactory: "isPair(address)" };

export interface MonitorEventDef {
  /** a stable id: "aave-v3/liquidation" */
  key: string;
  /** the protocol as the registry names it: "Aave v3" */
  protocol: string;
  /** what the page calls the stream: "Aave v3 liquidations" */
  label: string;
  family: MonitorFamily;
  /** the ABI name: "LiquidationCall" */
  event: string;
  /** the ABI signature: "LiquidationCall(address,address,address,uint256,uint256,address,bool)" */
  signature: string;
  /** keccak256 of the signature, 0x-prefixed lowercase */
  topic0: string;
  /** the lowercase contracts that emit it; none for a factory's pools, and none for an ERC-20 Transfer, which any token emits */
  addresses?: string[];
  /** the lowercase factories whose pools emit it */
  factories?: string[];
  poolCheck?: PoolCheck;
  /** the log's fields in ABI order; a dynamic field (CCTP V2's hookData) is left out */
  fields: FieldDef[];
  /** the figure to chart: an amount field and its token, as a field that holds the token, a fixed token, or the token
      of each emitting contract (a Benqi market's underlying); with none of the three the emitting contract is the
      token (an ERC-20 Transfer). The zero address is native AVAX. A swap has none: its tokens are the pool's */
  amount?: { field: string; tokenField?: string; token?: string; tokens?: Record<string, string> };
  /** what a reader types for it: "liquidations", "liquidated" */
  words: string[];
}

/** the C-Chain the catalog describes */
export const MONITOR_CHAIN_ID = 43114;

interface RegistryEntry {
  address: string;
  name: string;
  protocol?: string;
  category?: string;
  family?: string;
  role?: string;
  version?: string;
  underlying?: string;
  active?: boolean;
}

const registry = registryData as { contracts: RegistryEntry[]; protocolSlugs: Record<string, string> };
const ADDRESS = /^0x[0-9a-f]{40}$/;
const lower = (a: string | undefined) => (a ?? "").toLowerCase();
/** the registry's active entries of a family (and role) with an address, each address once, in the registry's order */
function listed(family: string, role?: string): RegistryEntry[] {
  const seen = new Set<string>();
  return registry.contracts.filter((e) => {
    const a = lower(e.address);
    if (e.family !== family || (role && e.role !== role) || e.active === false || !ADDRESS.test(a) || seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}
const slugOf = (protocol: string) => registry.protocolSlugs[protocol] ?? protocol.toLowerCase().replace(/[^a-z0-9]+/g, "-");
/** the registry calls Aave v3 Aave; its V2 pool is not in the family */
const nameOf = (protocol: string) => (protocol === "Aave" ? "Aave v3" : protocol);

const WAVAX = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const AVAX = "0x0000000000000000000000000000000000000000";

/* ------------------------------------------------------------------ */
/* Event layouts, from the verified sources (dexreg's families.md)     */

type Layout = Pick<MonitorEventDef, "event" | "signature" | "topic0" | "fields">;
const topic = (name: string, index: number, type: FieldDef["type"] = "address"): FieldDef => ({ name, from: "topic", index, type });
const word = (name: string, index: number, type: FieldDef["type"] = "uint256"): FieldDef => ({ name, from: "data", index, type });
/** a Liquidity Book bytes32 amount: X in its low 128 bits, Y in its high */
const packed = (name: string, index: number): FieldDef[] => [word(`${name}X`, index, "uint128lo"), word(`${name}Y`, index, "uint128hi")];

const L = {
  transfer: {
    event: "Transfer",
    signature: "Transfer(address,address,uint256)",
    topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    fields: [topic("from", 1), topic("to", 2), word("value", 0)],
  },
  wrap: {
    event: "Deposit",
    signature: "Deposit(address,uint256)",
    topic0: "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c",
    fields: [topic("dst", 1), word("wad", 0)],
  },
  unwrap: {
    event: "Withdrawal",
    signature: "Withdrawal(address,uint256)",
    topic0: "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65",
    fields: [topic("src", 1), word("wad", 0)],
  },
  // univ2 and Solidly pairs: unsigned amounts from the pool's side
  v2Swap: {
    event: "Swap",
    signature: "Swap(address,uint256,uint256,uint256,uint256,address)",
    topic0: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
    fields: [topic("sender", 1), word("amount0In", 0), word("amount1In", 1), word("amount0Out", 2), word("amount1Out", 3), topic("to", 2)],
  },
  // univ3 and Ramses V3 pools: signed amounts, positive into the pool
  v3Swap: {
    event: "Swap",
    signature: "Swap(address,address,int256,int256,uint160,uint128,int24)",
    topic0: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
    fields: [topic("sender", 1), topic("recipient", 2), word("amount0", 0, "int256"), word("amount1", 1, "int256"), word("sqrtPriceX96", 2, "uint160"), word("liquidity", 3), word("tick", 4, "int24")],
  },
  // Algebra Integral 1.2 pools: univ3's topic0 and words, its price named price
  algebraSwap: {
    event: "Swap",
    signature: "Swap(address,address,int256,int256,uint160,uint128,int24)",
    topic0: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
    fields: [topic("sender", 1), topic("recipient", 2), word("amount0", 0, "int256"), word("amount1", 1, "int256"), word("price", 2, "uint160"), word("liquidity", 3), word("tick", 4, "int24")],
  },
  // LB v2.1, v2.2 and Pharaoh DLMM: one Swap per bin crossed; amountsIn excludes the protocol fee
  lbSwap: {
    event: "Swap",
    signature: "Swap(address,address,uint24,bytes32,bytes32,uint24,bytes32,bytes32)",
    topic0: "0xad7d6f97abf51ce18e17a38f4d70e975be9c0708474987bb3e26ad21bd93ca70",
    fields: [topic("sender", 1), topic("to", 2), word("id", 0, "uint24"), ...packed("amountsIn", 1), ...packed("amountsOut", 2), word("volatilityAccumulator", 3, "uint24"), ...packed("totalFees", 4), ...packed("protocolFees", 5)],
  },
  // the univ4 PoolManager: int128 amounts from the swapper's side, the opposite of univ3; the pool is its id
  v4Swap: {
    event: "Swap",
    signature: "Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)",
    topic0: "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f",
    fields: [topic("id", 1, "bytes32"), topic("sender", 2), word("amount0", 0, "int256"), word("amount1", 1, "int256"), word("sqrtPriceX96", 2, "uint160"), word("liquidity", 3), word("tick", 4, "int24"), word("fee", 5, "uint24")],
  },
  // WOOFi's WooPP: swapVol and swapFee in its quote token
  wooSwap: {
    event: "WooSwap",
    signature: "WooSwap(address,address,uint256,uint256,address,address,address,uint256,uint256)",
    topic0: "0x0e8e403c2d36126272b08c75823e988381d9dc47f2f0a9a080d95f891d95c469",
    fields: [topic("fromToken", 1), topic("toToken", 2), word("fromAmount", 0), word("toAmount", 1), word("from", 2, "address"), topic("to", 3), word("rebateTo", 3, "address"), word("swapVol", 4), word("swapFee", 5)],
  },
  // Aave v3's Pool, in the reserve's decimals
  aaveSupply: {
    event: "Supply",
    signature: "Supply(address,address,address,uint256,uint16)",
    topic0: "0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61",
    fields: [topic("reserve", 1), word("user", 0, "address"), topic("onBehalfOf", 2), word("amount", 1), topic("referralCode", 3, "uint256")],
  },
  aaveWithdraw: {
    event: "Withdraw",
    signature: "Withdraw(address,address,address,uint256)",
    topic0: "0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7",
    fields: [topic("reserve", 1), topic("user", 2), topic("to", 3), word("amount", 0)],
  },
  aaveBorrow: {
    event: "Borrow",
    signature: "Borrow(address,address,address,uint256,uint8,uint256,uint16)",
    topic0: "0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0",
    fields: [topic("reserve", 1), word("user", 0, "address"), topic("onBehalfOf", 2), word("amount", 1), word("interestRateMode", 2), word("borrowRate", 3), topic("referralCode", 3, "uint256")],
  },
  aaveRepay: {
    event: "Repay",
    signature: "Repay(address,address,address,uint256,bool)",
    topic0: "0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051",
    fields: [topic("reserve", 1), topic("user", 2), topic("repayer", 3), word("amount", 0), word("useATokens", 1, "bool")],
  },
  aaveLiquidation: {
    event: "LiquidationCall",
    signature: "LiquidationCall(address,address,address,uint256,uint256,address,bool)",
    topic0: "0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286",
    fields: [topic("collateralAsset", 1), topic("debtAsset", 2), topic("user", 3), word("debtToCover", 0), word("liquidatedCollateralAmount", 1), word("liquidator", 2, "address"), word("receiveAToken", 3, "bool")],
  },
  aaveFlashLoan: {
    event: "FlashLoan",
    signature: "FlashLoan(address,address,address,uint256,uint8,uint256,uint16)",
    topic0: "0xefefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0",
    fields: [topic("target", 1), word("initiator", 0, "address"), topic("asset", 2), word("amount", 1), word("interestRateMode", 2), word("premium", 3), topic("referralCode", 3, "uint256")],
  },
  // Benqi's qiToken markets, Compound v2 with no indexed field: underlying amounts, qiTokens in 8 decimals
  qiMint: {
    event: "Mint",
    signature: "Mint(address,uint256,uint256)",
    topic0: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
    fields: [word("minter", 0, "address"), word("mintAmount", 1), word("mintTokens", 2)],
  },
  qiRedeem: {
    event: "Redeem",
    signature: "Redeem(address,uint256,uint256)",
    topic0: "0xe5b754fb1abb7f01b499791d0b820ae3b6af3424ac1c59768edb53f4ec31a929",
    fields: [word("redeemer", 0, "address"), word("redeemAmount", 1), word("redeemTokens", 2)],
  },
  qiBorrow: {
    event: "Borrow",
    signature: "Borrow(address,uint256,uint256,uint256)",
    topic0: "0x13ed6866d4e1ee6da46f845c46d7e54120883d75c5ea9a2dacc1c4ca8984ab80",
    fields: [word("borrower", 0, "address"), word("borrowAmount", 1), word("accountBorrows", 2), word("totalBorrows", 3)],
  },
  qiRepay: {
    event: "RepayBorrow",
    signature: "RepayBorrow(address,address,uint256,uint256,uint256)",
    topic0: "0x1a2a22cb034d26d1854bdc6666a5b91fe25efbbb5dcad3b0355478d6f5c362a1",
    fields: [word("payer", 0, "address"), word("borrower", 1, "address"), word("repayAmount", 2), word("accountBorrows", 3), word("totalBorrows", 4)],
  },
  // the borrowed market emits it; qiTokenCollateral is the market seized
  qiLiquidate: {
    event: "LiquidateBorrow",
    signature: "LiquidateBorrow(address,address,uint256,address,uint256)",
    topic0: "0x298637f684da70674f26509b10f07ec2fbc77a335ab1e7d6215a4b2484d8bb52",
    fields: [word("liquidator", 0, "address"), word("borrower", 1, "address"), word("repayAmount", 2), word("qiTokenCollateral", 3, "address"), word("seizeTokens", 4)],
  },
  // sAVAX: stakes and pays native AVAX; a redemption burns its shares with no Transfer
  submitted: {
    event: "Submitted",
    signature: "Submitted(address,uint256,uint256)",
    topic0: "0xbb0070894135d02edfa550b04d7e5e141aa8090b46e57597ad45bfedd6554498",
    fields: [topic("user", 1), word("avaxAmount", 0), word("shareAmount", 1)],
  },
  unlockRequested: {
    event: "UnlockRequested",
    signature: "UnlockRequested(address,uint256)",
    topic0: "0xd843ce9ef55b27026be6c5e44e9f58097e0ebfa0d9d2d5823cb8ffa779585170",
    fields: [topic("user", 1), word("shareAmount", 0)],
  },
  savaxRedeem: {
    event: "Redeem",
    signature: "Redeem(address,uint256,uint256,uint256)",
    topic0: "0xbd5034ffbd47e4e72a94baa2cdb74c6fad73cb3bcdc13036b72ec8306f5a7646",
    fields: [topic("user", 1), word("unlockRequestedAt", 0), word("shareAmount", 1), word("avaxAmount", 2)],
  },
  accrueRewards: {
    event: "AccrueRewards",
    signature: "AccrueRewards(uint256,uint256)",
    topic0: "0x915149a1670a81177a53d6f73ee6f911abec9e8d13d0ca02a93a28fcc0d54458",
    fields: [word("userRewardAmount", 0), word("protocolRewardAmount", 1)],
  },
  // ERC-4626 vaults: assets in the underlying's decimals, shares in the vault's
  vaultDeposit: {
    event: "Deposit",
    signature: "Deposit(address,address,uint256,uint256)",
    topic0: "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7",
    fields: [topic("sender", 1), topic("owner", 2), word("assets", 0), word("shares", 1)],
  },
  vaultWithdraw: {
    event: "Withdraw",
    signature: "Withdraw(address,address,address,uint256,uint256)",
    topic0: "0xfbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db",
    fields: [topic("sender", 1), topic("receiver", 2), topic("owner", 3), word("assets", 0), word("shares", 1)],
  },
  // OpenTrade's pools emit no ERC-4626 events: a deposit, then a redemption's request, acceptance and payout
  otDeposit: {
    event: "PoolDeposit",
    signature: "PoolDeposit(address,uint256,uint256,uint8,bytes32)",
    topic0: "0x43391017a4338e81200734cf186544860d19e6b7e502efff86b0368c93917515",
    fields: [topic("lender", 1), word("assets", 0), word("shares", 1), word("depositType", 2), word("transferTxHash", 3, "bytes32")],
  },
  otRequest: {
    event: "RedeemRequested",
    signature: "RedeemRequested(address,uint256,uint256,bytes32)",
    topic0: "0x01b01505fd6d330975ae77d043a3f87e4ab66a8996b76bc35258d63f4fd32650",
    fields: [topic("lender", 1), word("assets", 0), word("shares", 1), word("uuid", 2, "bytes32")],
  },
  otAccept: {
    event: "RedeemAccepted",
    signature: "RedeemAccepted(address,uint256,uint256,bytes32)",
    topic0: "0x825faf89e4521218529bee6bcdcf00e7e7f396154aa1c29df699a2979c80b657",
    fields: [topic("lender", 1), word("assets", 0), word("shares", 1), word("uuid", 2, "bytes32")],
  },
  otRepay: {
    event: "RedeemRepay",
    signature: "RedeemRepay(address,uint256,uint256,uint256,bytes32,uint256,address)",
    topic0: "0x5d88c6df9b9c24282c6d80c289e42a2754047e53bf5faacd7533ae0ca90240dd",
    fields: [topic("lender", 1), word("shares", 0), word("assets", 1), word("fees", 2), word("uuid", 3, "bytes32"), word("expectedAssets", 4), word("fundsDestination", 5, "address")],
  },
  otRate: {
    event: "ExchangeRateSet",
    signature: "ExchangeRateSet(uint256,int256,uint256,uint256)",
    topic0: "0xd1eb4ce4429fc349958a48fa6347b2c14e0ef701a9d2f133cc761d6dab329613",
    fields: [word("_exchangeRate", 0), word("interestRate", 1, "int256"), word("typeDependantChangeParam", 2), word("exchangeRateMaturityDay", 3)],
  },
  // Circle CCTP: a burn out of Avalanche (domain 1) and a mint into it; mintRecipient is bytes32 (Solana uses all 32)
  cctpBurnV1: {
    event: "DepositForBurn",
    signature: "DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)",
    topic0: "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0",
    fields: [topic("nonce", 1, "uint256"), topic("burnToken", 2), word("amount", 0), topic("depositor", 3), word("mintRecipient", 1, "bytes32"), word("destinationDomain", 2), word("destinationTokenMessenger", 3, "bytes32"), word("destinationCaller", 4, "bytes32")],
  },
  cctpBurnV2: {
    event: "DepositForBurn",
    signature: "DepositForBurn(address,uint256,address,bytes32,uint32,bytes32,bytes32,uint256,uint32,bytes)",
    topic0: "0x0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5",
    fields: [topic("burnToken", 1), word("amount", 0), topic("depositor", 2), word("mintRecipient", 1, "bytes32"), word("destinationDomain", 2), word("destinationTokenMessenger", 3, "bytes32"), word("destinationCaller", 4, "bytes32"), word("maxFee", 5), topic("minFinalityThreshold", 3, "uint256")],
  },
  cctpMintV1: {
    event: "MintAndWithdraw",
    signature: "MintAndWithdraw(address,uint256,address)",
    topic0: "0x1b2a7ff080b8cb6ff436ce0372e399692bbfb6d4ae5766fd8d58a7b8cc6142e6",
    fields: [topic("mintRecipient", 1), word("amount", 0), topic("mintToken", 2)],
  },
  // amount is what mintRecipient gets; feeCollected is minted to the fee recipient
  cctpMintV2: {
    event: "MintAndWithdraw",
    signature: "MintAndWithdraw(address,uint256,address,uint256)",
    topic0: "0x50c55e915134d457debfa58eb6f4342956f8b0616d51a89a3659360178e1ab63",
    fields: [topic("mintRecipient", 1), word("amount", 0), topic("mintToken", 2), word("feeCollected", 1)],
  },
} satisfies Record<string, Layout>;

/* ------------------------------------------------------------------ */
/* What a reader types for each event                                   */

const SWAPS = ["swaps", "swap", "swapped", "trades", "trade", "trading", "dex", "volume"];
const SUPPLIES = ["supplies", "supply", "supplied", "deposits", "deposit", "deposited", "lends", "lend", "lending"];
const WITHDRAWALS = ["withdrawals", "withdrawal", "withdraws", "withdraw", "withdrawn"];
const BORROWS = ["borrows", "borrow", "borrowed", "borrowing", "loans", "loan", "lending"];
const REPAYS = ["repayments", "repayment", "repays", "repay", "repaid", "lending"];
const LIQUIDATIONS = ["liquidations", "liquidation", "liquidated", "liquidate", "liquidating", "lending"];
const STAKING = ["staking", "liquid staking", "lst"];
const STAKES = [...STAKING, "stakes", "stake", "staked"];
const UNSTAKES = [...STAKING, "unstakes", "unstake", "unstaking", "unstaked"];
const BRIDGE = ["bridge", "bridges", "bridging", "bridged", "cross chain"];
const VAULT = ["vault", "vaults"];

/** a def of one layout */
const def = (layout: Layout, d: Omit<MonitorEventDef, keyof Layout>): MonitorEventDef => ({ ...d, ...layout });

/* ------------------------------------------------------------------ */
/* token                                                                */

const TOKEN_EVENTS: MonitorEventDef[] = [
  def(L.transfer, { key: "erc-20/transfer", protocol: "ERC-20", label: "ERC-20 transfers", family: "token", amount: { field: "value" }, words: ["transfers", "transfer", "transferred", "sends", "token transfers"] }),
  def(L.wrap, { key: "wavax/wrap", protocol: "WAVAX", label: "WAVAX wraps", family: "token", addresses: [WAVAX], amount: { field: "wad", token: WAVAX }, words: ["wraps", "wrap", "wrapped", "wrapping"] }),
  def(L.unwrap, { key: "wavax/unwrap", protocol: "WAVAX", label: "WAVAX unwraps", family: "token", addresses: [WAVAX], amount: { field: "wad", token: WAVAX }, words: ["unwraps", "unwrap", "unwrapped", "unwrapping"] }),
];

/* ------------------------------------------------------------------ */
/* dex: one def per protocol and registry family                        */

type DexFamily = "univ2" | "solidly" | "univ3" | "cl-ramses" | "algebra" | "lb" | "univ4" | "woofi";
/** each family's Swap, how the route tells its pools, and what the label calls a group of more than one factory.
    univ4's PoolManager and WOOFi's WooPP contracts emit every pool's swaps, so they are the addresses */
const DEX_FAMILIES: Record<DexFamily, { layout: Layout; check?: PoolCheck; name: string }> = {
  univ2: { layout: L.v2Swap, check: { getter: "factory()" }, name: "v2" },
  solidly: { layout: L.v2Swap, check: { onFactory: "isPair(address)" }, name: "Solidly" },
  univ3: { layout: L.v3Swap, check: { getter: "factory()" }, name: "v3" },
  "cl-ramses": { layout: L.v3Swap, check: { getter: "factory()" }, name: "CL" },
  algebra: { layout: L.algebraSwap, check: { getter: "factory()" }, name: "CL" },
  lb: { layout: L.lbSwap, check: { getter: "getFactory()" }, name: "LB" },
  univ4: { layout: L.v4Swap, name: "v4" },
  woofi: { layout: L.wooSwap, name: "" },
};
const isDexFamily = (f: string | undefined): f is DexFamily => !!f && Object.hasOwn(DEX_FAMILIES, f);

/** WOOFi's quote token, in which swapVol counts: USDC for all three WooPP contracts (quoteToken() by RPC, 2026-09-29) */
const WOOFI_QUOTE = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";

const DEX_EVENTS: MonitorEventDef[] = (() => {
  const groups = new Map<string, { protocol: string; family: DexFamily; entries: RegistryEntry[] }>();
  const seen = new Set<string>();
  for (const e of registry.contracts) {
    const a = lower(e.address);
    if (e.category !== "dex" || !isDexFamily(e.family) || e.active === false || !e.protocol || !registry.protocolSlugs[e.protocol] || !ADDRESS.test(a) || seen.has(a)) continue;
    seen.add(a);
    const key = `${slugOf(e.protocol)}/${e.family}-swap`;
    const g = groups.get(key) ?? { protocol: e.protocol, family: e.family, entries: [] };
    g.entries.push(e);
    groups.set(key, g);
  }
  return [...groups].map(([key, { protocol, family, entries }]) => {
    const { layout, check, name } = DEX_FAMILIES[family];
    const version = entries.length === 1 && entries[0].version ? entries[0].version : name;
    const contracts = entries.map((e) => lower(e.address));
    const held = family === "univ4" || family === "woofi";
    return def(layout, {
      key,
      protocol: nameOf(protocol),
      label: `${nameOf(protocol)}${version ? ` ${version}` : ""} swaps`,
      family: "dex",
      ...(held ? { addresses: contracts } : { factories: contracts, poolCheck: check }),
      ...(family === "woofi" ? { amount: { field: "swapVol", token: WOOFI_QUOTE } } : {}),
      words: SWAPS,
    });
  });
})();

/* ------------------------------------------------------------------ */
/* lending                                                              */

const AAVE_POOL = lower(listed("aave-v3", "pool")[0]?.address);
/** every Benqi market, core and ecosystem, with its underlying (the zero address for qiAVAX) */
const BENQI_MARKETS = listed("compound", "market").filter((e) => ADDRESS.test(lower(e.underlying)));
const BENQI_ASSETS = Object.fromEntries(BENQI_MARKETS.map((e) => [lower(e.address), lower(e.underlying)]));
const BENQI = BENQI_MARKETS.map((e) => lower(e.address));

const LENDING_EVENTS: MonitorEventDef[] = [
  ...(AAVE_POOL
    ? [
        def(L.aaveSupply, { key: "aave-v3/supply", protocol: "Aave v3", label: "Aave v3 supplies", family: "lending", addresses: [AAVE_POOL], amount: { field: "amount", tokenField: "reserve" }, words: SUPPLIES }),
        def(L.aaveWithdraw, { key: "aave-v3/withdraw", protocol: "Aave v3", label: "Aave v3 withdrawals", family: "lending", addresses: [AAVE_POOL], amount: { field: "amount", tokenField: "reserve" }, words: [...WITHDRAWALS, "lending"] }),
        def(L.aaveBorrow, { key: "aave-v3/borrow", protocol: "Aave v3", label: "Aave v3 borrows", family: "lending", addresses: [AAVE_POOL], amount: { field: "amount", tokenField: "reserve" }, words: BORROWS }),
        def(L.aaveRepay, { key: "aave-v3/repay", protocol: "Aave v3", label: "Aave v3 repayments", family: "lending", addresses: [AAVE_POOL], amount: { field: "amount", tokenField: "reserve" }, words: REPAYS }),
        def(L.aaveLiquidation, { key: "aave-v3/liquidation", protocol: "Aave v3", label: "Aave v3 liquidations", family: "lending", addresses: [AAVE_POOL], amount: { field: "debtToCover", tokenField: "debtAsset" }, words: LIQUIDATIONS }),
        def(L.aaveFlashLoan, { key: "aave-v3/flash-loan", protocol: "Aave v3", label: "Aave v3 flash loans", family: "lending", addresses: [AAVE_POOL], amount: { field: "amount", tokenField: "asset" }, words: ["flash loans", "flash loan", "flashloans", "flashloan", "lending"] }),
      ]
    : []),
  ...(BENQI.length
    ? [
        def(L.qiMint, { key: "benqi/supply", protocol: "Benqi", label: "Benqi supplies", family: "lending", addresses: BENQI, amount: { field: "mintAmount", tokens: BENQI_ASSETS }, words: SUPPLIES }),
        def(L.qiRedeem, { key: "benqi/withdraw", protocol: "Benqi", label: "Benqi withdrawals", family: "lending", addresses: BENQI, amount: { field: "redeemAmount", tokens: BENQI_ASSETS }, words: [...WITHDRAWALS, "lending"] }),
        def(L.qiBorrow, { key: "benqi/borrow", protocol: "Benqi", label: "Benqi borrows", family: "lending", addresses: BENQI, amount: { field: "borrowAmount", tokens: BENQI_ASSETS }, words: BORROWS }),
        def(L.qiRepay, { key: "benqi/repay", protocol: "Benqi", label: "Benqi repayments", family: "lending", addresses: BENQI, amount: { field: "repayAmount", tokens: BENQI_ASSETS }, words: REPAYS }),
        def(L.qiLiquidate, { key: "benqi/liquidation", protocol: "Benqi", label: "Benqi liquidations", family: "lending", addresses: BENQI, amount: { field: "repayAmount", tokens: BENQI_ASSETS }, words: LIQUIDATIONS }),
      ]
    : []),
];

/* ------------------------------------------------------------------ */
/* staking and vaults                                                   */

const SAVAX = lower(listed("savax", "lst")[0]?.address);
/** the registry's ERC-4626 vaults by protocol; a vault of WAVAX is staked AVAX (Hypha's stAVAX), so it is staking */
const VAULTS = listed("erc4626", "vault").filter((e) => e.protocol && ADDRESS.test(lower(e.underlying)));
const vaultsOf = (staking: boolean) =>
  [...new Set(VAULTS.filter((e) => (lower(e.underlying) === WAVAX) === staking).map((e) => e.protocol!))].map((protocol) => {
    const vaults = VAULTS.filter((e) => e.protocol === protocol);
    return { protocol, slug: slugOf(protocol), addresses: vaults.map((e) => lower(e.address)), tokens: Object.fromEntries(vaults.map((e) => [lower(e.address), lower(e.underlying)])), symbol: vaults[0].name.split(" ")[0] };
  });

const STAKING_EVENTS: MonitorEventDef[] = [
  ...(SAVAX
    ? [
        def(L.submitted, { key: "benqi/savax-stake", protocol: "Benqi", label: "Benqi sAVAX stakes", family: "staking", addresses: [SAVAX], amount: { field: "avaxAmount", token: AVAX }, words: STAKES }),
        def(L.unlockRequested, { key: "benqi/savax-unlock", protocol: "Benqi", label: "Benqi sAVAX unlock requests", family: "staking", addresses: [SAVAX], amount: { field: "shareAmount", token: SAVAX }, words: [...UNSTAKES, "unlocks", "unlock", "unlock requests"] }),
        def(L.savaxRedeem, { key: "benqi/savax-redeem", protocol: "Benqi", label: "Benqi sAVAX redemptions", family: "staking", addresses: [SAVAX], amount: { field: "avaxAmount", token: AVAX }, words: [...UNSTAKES, "redeems", "redeemed", "redemptions", "redemption"] }),
        def(L.accrueRewards, { key: "benqi/savax-rewards", protocol: "Benqi", label: "Benqi sAVAX rewards", family: "staking", addresses: [SAVAX], amount: { field: "userRewardAmount", token: AVAX }, words: [...STAKING, "rewards", "reward", "staking rewards"] }),
      ]
    : []),
  ...vaultsOf(true).flatMap((v) => [
    def(L.vaultDeposit, { key: `${v.slug}/stake`, protocol: v.protocol, label: `${v.protocol} ${v.symbol} stakes`, family: "staking", addresses: v.addresses, amount: { field: "assets", tokens: v.tokens }, words: [...STAKES, "deposits", "deposit"] }),
    def(L.vaultWithdraw, { key: `${v.slug}/unstake`, protocol: v.protocol, label: `${v.protocol} ${v.symbol} unstakes`, family: "staking", addresses: v.addresses, amount: { field: "assets", tokens: v.tokens }, words: [...UNSTAKES, ...WITHDRAWALS] }),
  ]),
];

const OPENTRADE = listed("opentrade", "vault").filter((e) => ADDRESS.test(lower(e.underlying)));
const OPENTRADE_POOLS = OPENTRADE.map((e) => lower(e.address));
const OPENTRADE_ASSETS = Object.fromEntries(OPENTRADE.map((e) => [lower(e.address), lower(e.underlying)]));
const RWA = [...VAULT, "rwa"];

const VAULT_EVENTS: MonitorEventDef[] = [
  ...vaultsOf(false).flatMap((v) => [
    def(L.vaultDeposit, { key: `${v.slug}/deposit`, protocol: v.protocol, label: `${v.protocol} vault deposits`, family: "vault", addresses: v.addresses, amount: { field: "assets", tokens: v.tokens }, words: [...VAULT, "deposits", "deposit", "deposited"] }),
    def(L.vaultWithdraw, { key: `${v.slug}/withdraw`, protocol: v.protocol, label: `${v.protocol} vault withdrawals`, family: "vault", addresses: v.addresses, amount: { field: "assets", tokens: v.tokens }, words: [...VAULT, ...WITHDRAWALS] }),
  ]),
  ...(OPENTRADE_POOLS.length
    ? [
        def(L.otDeposit, { key: "opentrade/deposit", protocol: "OpenTrade", label: "OpenTrade deposits", family: "vault", addresses: OPENTRADE_POOLS, amount: { field: "assets", tokens: OPENTRADE_ASSETS }, words: [...RWA, "deposits", "deposit", "deposited"] }),
        def(L.otRequest, { key: "opentrade/redeem-request", protocol: "OpenTrade", label: "OpenTrade redemption requests", family: "vault", addresses: OPENTRADE_POOLS, amount: { field: "assets", tokens: OPENTRADE_ASSETS }, words: [...RWA, "redemption requests", "redeem requests", "requests"] }),
        def(L.otAccept, { key: "opentrade/redeem-accept", protocol: "OpenTrade", label: "OpenTrade accepted redemptions", family: "vault", addresses: OPENTRADE_POOLS, amount: { field: "assets", tokens: OPENTRADE_ASSETS }, words: [...RWA, "accepted redemptions", "accepts", "accepted"] }),
        def(L.otRepay, { key: "opentrade/redeem", protocol: "OpenTrade", label: "OpenTrade redemptions", family: "vault", addresses: OPENTRADE_POOLS, amount: { field: "assets", tokens: OPENTRADE_ASSETS }, words: [...RWA, "redemptions", "redemption", "redeems", "redeemed", "payouts", ...WITHDRAWALS] }),
        def(L.otRate, { key: "opentrade/rate", protocol: "OpenTrade", label: "OpenTrade exchange rates", family: "vault", addresses: OPENTRADE_POOLS, words: [...RWA, "exchange rates", "exchange rate", "rates", "rate", "share price"] }),
      ]
    : []),
];

/* ------------------------------------------------------------------ */
/* bridge                                                               */

const cctp = (version: string) => lower(listed("cctp", "token-messenger").find((e) => e.version === version)?.address);
const CCTP_V1 = cctp("v1");
const CCTP_V2 = cctp("v2");
const OUT = [...BRIDGE, "bridge out", "bridged out", "outgoing", "outflows", "burns", "burn"];
const IN = [...BRIDGE, "bridge in", "bridged in", "incoming", "inflows", "arrivals", "mints", "mint"];

const BRIDGE_EVENTS: MonitorEventDef[] = [
  ...(CCTP_V1
    ? [
        def(L.cctpBurnV1, { key: "circle-cctp/burn-v1", protocol: "Circle CCTP", label: "Circle CCTP V1 burns", family: "bridge", addresses: [CCTP_V1], amount: { field: "amount", tokenField: "burnToken" }, words: OUT }),
        def(L.cctpMintV1, { key: "circle-cctp/mint-v1", protocol: "Circle CCTP", label: "Circle CCTP V1 mints", family: "bridge", addresses: [CCTP_V1], amount: { field: "amount", tokenField: "mintToken" }, words: IN }),
      ]
    : []),
  ...(CCTP_V2
    ? [
        def(L.cctpBurnV2, { key: "circle-cctp/burn-v2", protocol: "Circle CCTP", label: "Circle CCTP V2 burns", family: "bridge", addresses: [CCTP_V2], amount: { field: "amount", tokenField: "burnToken" }, words: OUT }),
        def(L.cctpMintV2, { key: "circle-cctp/mint-v2", protocol: "Circle CCTP", label: "Circle CCTP V2 mints", family: "bridge", addresses: [CCTP_V2], amount: { field: "amount", tokenField: "mintToken" }, words: IN }),
      ]
    : []),
];

/** every event a monitor can watch, by family: token, dex, lending, staking, bridge, vault */
export const MONITOR_EVENTS: MonitorEventDef[] = [...TOKEN_EVENTS, ...DEX_EVENTS, ...LENDING_EVENTS, ...STAKING_EVENTS, ...BRIDGE_EVENTS, ...VAULT_EVENTS];

/* ------------------------------------------------------------------ */
/* Decoding                                                             */

type Log = { address?: string; topics: readonly string[]; data: string };
const U128 = (1n << 128n) - 1n;
/** data word k of a log, 0x and 64 hex digits, or undefined past its end */
const dataWord = (data: string, k: number) => {
  const hex = data.replace(/^0x/i, "");
  return hex.length >= 64 * (k + 1) ? `0x${hex.slice(64 * k, 64 * (k + 1))}` : undefined;
};
const wordOf = (log: Log, f: FieldDef) => (f.from === "topic" ? log.topics[f.index] : dataWord(log.data, f.index));

function read(word: string, type: FieldDef["type"]): string | bigint | boolean {
  const w = word.toLowerCase();
  const n = BigInt(w);
  switch (type) {
    case "address":
      return `0x${w.slice(-40)}`;
    case "bytes32":
      return w;
    case "bool":
      return n !== 0n;
    case "int256":
    case "int24":
      return BigInt.asIntN(256, n);
    case "uint128lo":
      return n & U128;
    case "uint128hi":
      return n >> 128n;
    default:
      return n;
  }
}

/** how many topics a def's log has (topic0 and its indexed fields), and how many data words at least */
const shapeOf = (d: MonitorEventDef) => ({
  topics: 1 + Math.max(0, ...d.fields.filter((f) => f.from === "topic").map((f) => f.index)),
  words: 1 + Math.max(-1, ...d.fields.filter((f) => f.from === "data").map((f) => f.index)),
});

/** whether a log is this def's event: its topic0, its number of topics (an ERC-721 Transfer has one more than an
    ERC-20's), data long enough for its fields, and one of its addresses when it lists them and the log has one */
export function fitsMonitorLog(d: MonitorEventDef, log: Log): boolean {
  const { topics, words } = shapeOf(d);
  if (log.topics[0]?.toLowerCase() !== d.topic0 || log.topics.length !== topics || (words > 0 && dataWord(log.data, words - 1) === undefined)) return false;
  return !d.addresses || !log.address || d.addresses.includes(log.address.toLowerCase());
}

/** a log's fields by name: addresses and bytes32 as lowercase hex, numbers as bigint, bools as booleans. Throws on a
    log with no topic or word where a field sits; fitsMonitorLog tells such a log apart first */
export function decodeMonitorLog(d: MonitorEventDef, log: { topics: readonly string[]; data: string }): Record<string, string | bigint | boolean> {
  const out: Record<string, string | bigint | boolean> = {};
  for (const f of d.fields) {
    const w = wordOf(log, f);
    if (w === undefined || !/^0x[0-9a-f]{64}$/i.test(w)) throw new Error(`${d.key}: the log has no ${f.from} ${f.index} for ${f.name}`);
    out[f.name] = read(w, f.type);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Reader words                                                         */

/** other names a reader uses for a protocol, beside the words of its label */
const PROTOCOL_NAMES: Record<string, string[]> = {
  "Trader Joe": ["joe", "lfj", "traderjoe"],
  SushiSwap: ["sushi"],
  Uniswap: ["uni"],
  WOOFi: ["woo"],
  Hypha: ["gogopool", "ggavax"],
  Avant: ["savusd", "savbtc", "avusd", "avbtc"],
  Spark: ["spusdc"],
  "ERC-20": ["erc20"],
};

/** a word in its singular form, so swaps and swap, supplies and supply match */
const stem = (w: string) => (w.length > 3 && !w.endsWith("ss") ? w.replace(/ies$/, "y").replace(/s$/, "") : w);
const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean)
    .map(stem);
/** an ABI name's words that say what happened: LiquidationCall is liquidation, MintAndWithdraw mint and withdraw
    (and, for, set, call and pool are words a reader types for other things) */
const nameWords = (event: string) => tokens(event.replace(/([a-z])([A-Z])/g, "$1 $2")).filter((w) => w.length > 3 && w !== "call" && w !== "pool");

interface Terms {
  /** its event phrases, as tokens */
  phrases: string[][];
  /** its event name's words, which count once the reader names its protocol */
  names: Set<string>;
  /** the words that name its protocol or kind of pool: the label's and the protocol's, less every event word */
  scope: Set<string>;
  /** the words that name it for eventsFor's protocol: the label's, the protocol's and its slug's */
  own: Set<string>;
}
let terms: Map<MonitorEventDef, Terms> | undefined;
function termsOf(): Map<MonitorEventDef, Terms> {
  if (terms) return terms;
  const vocab = new Set(MONITOR_EVENTS.flatMap((d) => d.words.flatMap(tokens)));
  terms = new Map(
    MONITOR_EVENTS.map((d) => {
      const own = new Set([...tokens(d.label), ...tokens(d.protocol), ...tokens(d.key.split("/")[0]), ...(PROTOCOL_NAMES[d.protocol] ?? []).flatMap(tokens)]);
      return [d, { phrases: d.words.map(tokens), names: new Set(nameWords(d.event)), scope: new Set([...own].filter((t) => !vocab.has(t))), own }];
    }),
  );
  return terms;
}

/** the positions where a phrase occurs in the reader's words */
function occurrences(words: string[], phrase: string[]): number[] {
  const at: number[] = [];
  for (let i = 0; i + phrase.length <= words.length; i++) if (phrase.every((p, j) => words[i + j] === p)) at.push(...phrase.map((_, j) => i + j));
  return at;
}

/** the defs a reader's words ask for: "aave liquidations", "pharaoh swaps", "sAVAX staking", "cctp bridge". The words
    that name a protocol or kind of pool (aave, pharaoh, savax, lb, v4) keep the defs they name; the event words then
    pick among those, or among all defs when none is named, and a def whose matched words are a strict part of another
    one's gives way to it (bridge out keeps the burns, flash loans the flash loans). Named alone, a protocol gives all
    its events. `protocol` (a name, slug or other name of it) keeps only its defs; words that match none give no defs */
export function eventsFor(words: string, protocol?: string): MonitorEventDef[] {
  const all = termsOf();
  const text = tokens(words);
  const asked = protocol?.trim() ? tokens(protocol) : undefined;
  const pool = asked ? MONITOR_EVENTS.filter((d) => asked.every((t) => all.get(d)!.own.has(t))) : MONITOR_EVENTS;
  const hits = new Map<MonitorEventDef, { scope: Set<number>; event: Set<number>; named: Set<number> }>();
  for (const d of pool) {
    const t = all.get(d)!;
    const scope = new Set(text.flatMap((w, i) => (t.scope.has(w) ? [i] : [])));
    hits.set(d, { scope, event: new Set(t.phrases.flatMap((p) => occurrences(text, p))), named: new Set() });
  }
  const scoped = asked ? pool : pool.filter((d) => hits.get(d)!.scope.size > 0);
  // once a protocol is named, an event's ABI name counts too: WAVAX deposits are its wraps
  for (const d of scoped) for (const [i, w] of text.entries()) if (all.get(d)!.names.has(w)) hits.get(d)!.named.add(i);
  const eventWords = MONITOR_EVENTS.some((d) => all.get(d)!.phrases.some((p) => occurrences(text, p).length > 0)) || scoped.some((d) => hits.get(d)!.named.size > 0);
  const base = scoped.length > 0 ? scoped : pool;
  const any = eventWords ? base.filter((d) => hits.get(d)!.event.size > 0 || hits.get(d)!.named.size > 0) : scoped;
  // an event its own words name beats one only its ABI name matches: benqi borrows is Borrow, not RepayBorrow
  const byPhrase = any.filter((d) => hits.get(d)!.event.size > 0);
  const found = byPhrase.length > 0 ? byPhrase : any;
  const matched = new Map(found.map((d) => [d, new Set([...hits.get(d)!.scope, ...hits.get(d)!.event, ...hits.get(d)!.named])]));
  const within = (a: Set<number>, b: Set<number>) => a.size < b.size && [...a].every((i) => b.has(i));
  return found.filter((d) => ![...matched.values()].some((other) => within(matched.get(d)!, other)));
}
