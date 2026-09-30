/* Four more of the C-Chain's contract families as Query reads them, from
   the contract registry the dApp pages read (data/contract-registry.json):
   ERC-4626 vaults (Avant, Spark, Hypha), OpenTrade's pools, Benqi's sAVAX
   liquid staking, and Circle's CCTP bridge. Each has its own events; the
   names of their contracts and topics are the server's, defined in front
   of a query that reads them (sources.ts), as the lending names are.
   Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";
import { mentioned } from "./names";
import { packed, strings } from "./protocols";

interface RegistryEntry {
  address: string;
  name: string;
  protocol?: string;
  family?: string;
  role?: string;
  version?: string;
  underlying?: string;
  active?: boolean;
}

const registry = registryData as { contracts: RegistryEntry[]; protocolSlugs: Record<string, string> };
const ADDRESS = /^0x[0-9a-f]{40}$/;
const lower = (a: string | undefined) => (a ?? "").toLowerCase();
const listed = (family: string, role?: string) =>
  registry.contracts.filter((e) => e.family === family && (!role || e.role === role) && e.active !== false && ADDRESS.test(lower(e.address)));

/** the C-Chain the families describe */
export const FAMILY_CHAIN_ID = 43114;

/** what an asset is priced in, as $PRICES names it: US dollars, or a price read from swaps */
type Price = "usd" | "avax" | "btc" | "eurc";

/** each vault's asset: its decimals and price, read by RPC on 2026-09-28 (avUSD and avBTC have 18; EUROP has 6) */
const ASSETS: Record<string, { symbol: string; decimals: number; price: Price }> = {
  "0x24de8771bc5ddb3362db529fc3358f2df3a0e346": { symbol: "avUSD", decimals: 18, price: "usd" },
  "0xfd2c2a98009d0cbed715882036e43d26c4289053": { symbol: "avBTC", decimals: 18, price: "btc" },
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": { symbol: "USDC", decimals: 6, price: "usd" },
  "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": { symbol: "USDt", decimals: 6, price: "usd" },
  "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": { symbol: "WAVAX", decimals: 18, price: "avax" },
  "0xc891eb4cbdeff6e073e859e987815ed1505c2acd": { symbol: "EURC", decimals: 6, price: "eurc" },
  "0x8835a2f66a7aaccb297cb985831a616b75e2e16c": { symbol: "EUROP", decimals: 6, price: "eurc" },
};

/** an ERC-4626 vault: its share token, the asset it holds, and the decimals of each */
export interface Vault {
  protocol: string;
  name: string;
  vault: string;
  asset: string;
  symbol: string;
  decimals: number;
  price: Price;
  /** the shares' decimals: the asset's for Spark, 18 for the others (families.md) */
  shareDecimals: number;
}

/** the registry's ERC-4626 vaults whose asset has known decimals, in the registry's order */
export const VAULTS: readonly Vault[] = listed("erc4626", "vault").flatMap((e) => {
  const asset = ASSETS[lower(e.underlying)];
  if (!asset || !e.protocol) return [];
  return [{ protocol: e.protocol, name: e.name, vault: lower(e.address), asset: lower(e.underlying), symbol: asset.symbol, decimals: asset.decimals, price: asset.price, shareDecimals: e.protocol === "Spark" ? asset.decimals : 18 }];
});

/** Avant's cooldown silos: a withdrawal pays its assets here first, and the user a day later */
export const SILOS: readonly RegistryEntry[] = listed("erc4626", "silo");

/** OpenTrade's factory, and its pools with their assets; the test pools are not in the registry */
export const OPENTRADE_FACTORY = lower(listed("opentrade", "factory")[0]?.address);
export const OPENTRADE_POOLS: readonly { pool: string; name: string; asset: string }[] = listed("opentrade", "vault").flatMap((e) =>
  ASSETS[lower(e.underlying)] ? [{ pool: lower(e.address), name: e.name, asset: lower(e.underlying) }] : [],
);

/** Benqi's sAVAX: it takes and pays native AVAX */
export const SAVAX = lower(listed("savax", "lst")[0]?.address);

/** Circle CCTP on this chain (domain 1): the token messenger and the message transmitter of V1 and V2 */
const cctp = (role: string, version: string) => lower(listed("cctp", role).find((e) => e.version === version)?.address);
export const CCTP = {
  messengerV1: cctp("token-messenger", "v1"),
  messengerV2: cctp("token-messenger", "v2"),
  transmitterV1: cctp("message-transmitter", "v1"),
  transmitterV2: cctp("message-transmitter", "v2"),
};

/** CCTP's domain ids and chains (Circle docs, checked by dexreg on 2026-09-27) */
export const CCTP_DOMAINS: Record<number, string> = {
  0: "Ethereum", 1: "Avalanche", 2: "OP Mainnet", 3: "Arbitrum", 4: "Noble", 5: "Solana", 6: "Base", 7: "Polygon PoS", 8: "Sui", 9: "Aptos", 10: "Unichain",
  11: "Linea", 12: "Codex", 13: "Sonic", 14: "World Chain", 15: "Monad", 16: "Sei", 17: "BNB Smart Chain", 18: "XDC", 19: "HyperEVM", 21: "Ink", 22: "Plume",
  25: "Starknet", 26: "Arc", 27: "Stellar", 28: "EDGE", 29: "Injective", 30: "Morph", 31: "Pharos", 32: "Cronos", 33: "Plasma", 37: "X Layer",
};

/** each event by topic0 (families.md, each decoded against a sample transaction) */
export const FAMILY_TOPICS = {
  vaultDeposit: "dcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7",
  vaultWithdraw: "fbde797d201c681b91056529119e0b02407c7bb96a4a2c75c01fc9667232c8db",
  otDeposit: "43391017a4338e81200734cf186544860d19e6b7e502efff86b0368c93917515",
  otRequest: "01b01505fd6d330975ae77d043a3f87e4ab66a8996b76bc35258d63f4fd32650",
  otAccept: "825faf89e4521218529bee6bcdcf00e7e7f396154aa1c29df699a2979c80b657",
  otRepay: "5d88c6df9b9c24282c6d80c289e42a2754047e53bf5faacd7533ae0ca90240dd",
  otRate: "d1eb4ce4429fc349958a48fa6347b2c14e0ef701a9d2f133cc761d6dab329613",
  /** the older pools' ExchangeRateSet(uint256,uint256,uint256,uint256): 5 pools last set their rate with it (qaudit, F10) */
  otRateOld: "3cfe264171cdebb92f50463c857d1e3d6a9e85127983d91fe80a5df41c326407",
  submitted: "bb0070894135d02edfa550b04d7e5e141aa8090b46e57597ad45bfedd6554498",
  savaxUnlock: "d843ce9ef55b27026be6c5e44e9f58097e0ebfa0d9d2d5823cb8ffa779585170",
  savaxRedeem: "bd5034ffbd47e4e72a94baa2cdb74c6fad73cb3bcdc13036b72ec8306f5a7646",
  savaxRewards: "915149a1670a81177a53d6f73ee6f911abec9e8d13d0ca02a93a28fcc0d54458",
  /** UnlockCancelled(address,uint256,uint256) and RedeemOverdueShares(address,uint256), each checked against its signature */
  savaxCancel: "7e4a9502fd577f76f1dc8c9c8f63196816f7c1bd73c6db99f888e8d7bb2f8998",
  savaxOverdue: "eaca243f6502ade1b9ea0909306c290366d6ea6778ca407ca4415c4a0f45e353",
  transfer: "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  cctpBurnV1: "2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0",
  cctpBurnV2: "0c8c1cbdc5190613ebd485511d4e2812cfa45eecb79d845893331fedad5130a5",
  cctpMintV1: "1b2a7ff080b8cb6ff436ce0372e399692bbfb6d4ae5766fd8d58a7b8cc6142e6",
  cctpMintV2: "50c55e915134d457debfa58eb6f4342956f8b0616d51a89a3659360178e1ab63",
  cctpReceivedV1: "58200b4c34ae05ee816d710053fff3fb75af4395915d3d2a771b24aa10e3cc5d",
  cctpReceivedV2: "ff48c13eda96b1cceacc6b9edeedc9e9db9d6226afbc30146b720c19d3addb1c",
} as const;

const hexOf = (h: string) => `unhex('${h.replace(/^0x/, "")}')`;
/** addresses packed as base64, 28 characters each, for a list too long for hex (the query service takes 16 KiB) */
const packedList = (xs: readonly string[]) => `arrayMap(x -> base64Decode(x), ${strings(xs.map(packed))})`;
const EUR = OPENTRADE_POOLS.filter((p) => ASSETS[p.asset].price === "eurc").map((p) => p.pool);

/** the addresses in each list the server names (bare hex), so a check can tell which protocols a query reads */
export const FAMILY_LISTS: Record<string, readonly string[]> = {
  vaults: VAULTS.map((v) => v.vault.slice(2)),
  ot_pools: OPENTRADE_POOLS.map((p) => p.pool.slice(2)),
  ot_eur_pools: EUR.map((p) => p.slice(2)),
};

/** the names a family query uses for the families' contracts, topics and lists; the server defines each name a query
    reads and does not define itself (sources.ts). vaults and its three lists run in VAULTS' order */
export const FAMILY_NAMES: Record<string, string> = {
  vaults: `[${VAULTS.map((v) => hexOf(v.vault)).join(", ")}]`,
  vault_decimals: `[${VAULTS.map((v) => v.decimals).join(", ")}]`,
  vault_share_decimals: `[${VAULTS.map((v) => v.shareDecimals).join(", ")}]`,
  vault_prices: strings(VAULTS.map((v) => v.price)),
  ot_factory: hexOf(OPENTRADE_FACTORY),
  ot_pools: packedList(OPENTRADE_POOLS.map((p) => p.pool)),
  ot_eur_pools: `[${EUR.map(hexOf).join(", ")}]`,
  savax_token: hexOf(SAVAX),
  cctp_messenger_v1: hexOf(CCTP.messengerV1),
  cctp_messenger_v2: hexOf(CCTP.messengerV2),
  cctp_transmitter_v1: hexOf(CCTP.transmitterV1),
  cctp_transmitter_v2: hexOf(CCTP.transmitterV2),
  cctp_domains: `map(${Object.entries(CCTP_DOMAINS)
    .map(([id, name], i) => `${i === 0 ? `toUInt32(${id})` : id}, '${name}'`)
    .join(", ")})`,
  vault_deposit_t: hexOf(FAMILY_TOPICS.vaultDeposit),
  vault_withdraw_t: hexOf(FAMILY_TOPICS.vaultWithdraw),
  ot_deposit_t: hexOf(FAMILY_TOPICS.otDeposit),
  ot_request_t: hexOf(FAMILY_TOPICS.otRequest),
  ot_accept_t: hexOf(FAMILY_TOPICS.otAccept),
  ot_repay_t: hexOf(FAMILY_TOPICS.otRepay),
  ot_rate_t: hexOf(FAMILY_TOPICS.otRate),
  ot_rate_old_t: hexOf(FAMILY_TOPICS.otRateOld),
  submitted_t: hexOf(FAMILY_TOPICS.submitted),
  savax_unlock_t: hexOf(FAMILY_TOPICS.savaxUnlock),
  savax_redeem_t: hexOf(FAMILY_TOPICS.savaxRedeem),
  savax_rewards_t: hexOf(FAMILY_TOPICS.savaxRewards),
  savax_cancel_t: hexOf(FAMILY_TOPICS.savaxCancel),
  savax_overdue_t: hexOf(FAMILY_TOPICS.savaxOverdue),
  transfer_t: hexOf(FAMILY_TOPICS.transfer),
  cctp_burn_v1_t: hexOf(FAMILY_TOPICS.cctpBurnV1),
  cctp_burn_v2_t: hexOf(FAMILY_TOPICS.cctpBurnV2),
  cctp_mint_v1_t: hexOf(FAMILY_TOPICS.cctpMintV1),
  cctp_mint_v2_t: hexOf(FAMILY_TOPICS.cctpMintV2),
  cctp_received_v1_t: hexOf(FAMILY_TOPICS.cctpReceivedV1),
  cctp_received_v2_t: hexOf(FAMILY_TOPICS.cctpReceivedV2),
};

/** the words of a question about these families: a protocol, a token or a bridge they name */
const FAMILY_WORDS =
  /\b(avant|sav(usd|btc)|av(usd|btc)|spark|spusdc|hypha|st-?avax|gg-?avax|gogopool|opentrade|open trade|savax|liquid[- ]staking|stak(e|ed|ing) avax|unstak\w*|cctp|circle (bridge|cctp)|bridged usdc|usdc (bridge|bridged)|cross[- ]chain usdc|erc[- ]?4626|vaults?)\b/i;

/** the family names long enough for a slip to read as them (names.ts) */
const SLIPPED = ["OpenTrade", "GoGoPool"];

/** a question about the vaults, sAVAX or CCTP, whose prompt carries their chapter: it names one of them (OpenTrade or
    GoGoPool one slip off), or an earlier turn read their contracts. Every other question's prompt is the one it was */
export function familyQuestion(chainId: number, prompt: string, history: { prompt?: string; sql?: string }[] = []): boolean {
  if (chainId !== FAMILY_CHAIN_ID || VAULTS.length + OPENTRADE_POOLS.length === 0 || !SAVAX) return false;
  const about = (q: string) => FAMILY_WORDS.test(q) || mentioned(q, SLIPPED).length > 0;
  return about(prompt) || history.some((t) => about(t.prompt ?? "") || /\b(vaults|ot_pools|savax_token|cctp_\w+)\b/.test(t.sql ?? ""));
}

/* A query on these contracts writes our server's names for them
   (savax_token, cctp_burn_v1_t), as a lending query does (lending.ts,
   strayHex): a topic or an address from memory is often wrong, and a
   wrong one reads no rows. */

/** the topics a query on these contracts may write out: the named ones, an ERC-20's Approval, the transmitters'
    MessageSent, and WAVAX's Deposit, which sAVAX writes too (keccak of each signature, viem) */
/* the other events these contracts logged in the 90 days to 2026-09-30, read from raw_logs: the vaults' fee and admin
   events, sAVAX's Withdraw, the OpenTrade pools' own. A topic the server has
   no name for is no mistake when the contract logs it: the r6 audit's UnlockCancelled on sAVAX (208 logs) was sent
   back as "no event of these contracts" */
const SEEN_TOPICS = [
  "142999da1b7c9b15a43b8fb11fb55ab6bae6111cbd90626e5b47e49efd6a4799",
  "156e588d1067ba3c8a6a7f4376ef70794f8afed114dc9d1421e054b65743e630",
  "180eacdf7dbaeecaa983d93173b4285db2f2c0de0044697e1f932bbbb73dcaa6",
  "191e16d6a3a6d3f67535002b7d83fbc2c172ea76845d852135a96f46b821c304",
  "456468d0d5c249d1e9c2eb03d20f2a6627334ac8667838011f1df0013816f1cf",
  "4b9e0347eed22e6497acaf0cff5d4e76fbd04032e68f81edf1823ff8d3f9737c",
  "4bba2b08298cf59661b4895e384cc2ac3962ce2d71f1b7c11bca52e1169f9599",
  "73cd35236d624d907e365ebb596cec5a00d8732dd494db7fe7a51a6561a5b5d3",
  "7aa50fb4f250f9725bff6436208316b64f66ab969d3cf340fe345f2718fdee12",
  "884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364",
  "8a16e0e94d3e61227e5da91c8fef19e22a0b136b335a7b5ce57e762bf5474d5f",
  "95531cf01679ac5aa7d49c50fdb23ccff8bd527cdd85214ca1d81f6d2aee7780",
  "ab64f92ab780ecbf4f3866f57cee465ff36c89450dcce20237ca7a8d81fb7d13",
  "ad1e8a53178522eb68a9d94d862bf30c841f709d2115f743eb6b34528751c79f",
  "b0f90eb9923b5c0a32d2df54960511caffba716d1baa3d348d4af0cb2aa79f59",
  "b30a03a0e2a407f18ae0e83491331dc069d1521e292feffb071e61c8f7f40636",
  "bb28dd7cd6be6f61828ea9158a04c5182c716a946a6d2f31f4864edb87471aa6",
  "bc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b",
  "c94c46ffbbc1b036a4912660fe60c404ba4d10638d365a46d1bac54abf76a849",
  "d69eabfc802f58b2a23d16767d1fcab6551f30a60ab43a24f147d3823d7d0368",
  "dd4573165d2d2b3ad7be79cfb35bd79c5d5e90e9a51ca373b975e89591b1e513",
  "e0ba1f7b9ab1ce44306b7c0a5c04982a401d90b491eb18517662e955579746ac",
];
export const FAMILY_EVENTS: ReadonlySet<string> = new Set([
  ...Object.values(FAMILY_TOPICS),
  ...SEEN_TOPICS,
  "8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  "8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036",
  "e1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c",
]);
/** the contracts and lists our server names, each with what a reader calls it */
const NAMED_CONTRACTS: readonly (readonly [string, string, string])[] = [
  ["savax_token", "Benqi's sAVAX", SAVAX],
  ["cctp_messenger_v1", "CCTP's V1 token messenger", CCTP.messengerV1],
  ["cctp_messenger_v2", "CCTP's V2 token messenger", CCTP.messengerV2],
  ["cctp_transmitter_v1", "CCTP's V1 message transmitter", CCTP.transmitterV1],
  ["cctp_transmitter_v2", "CCTP's V2 message transmitter", CCTP.transmitterV2],
  ["ot_factory", "OpenTrade's factory", OPENTRADE_FACTORY],
  ...VAULTS.map((v) => [`vaults[${VAULTS.indexOf(v) + 1}]`, `${v.protocol}'s ${v.name.split(" ")[0]}`, v.vault] as const),
];
/** a query that reads these contracts: by our names for them, their lists or their topics, or by their addresses */
const OURS = Object.keys(FAMILY_NAMES).filter((n) => n !== "submitted_t" && n !== "transfer_t");
const READS_FAMILIES = new RegExp(`\\b(${OURS.join("|")})\\b|${NAMED_CONTRACTS.map(([, , a]) => a.slice(2)).join("|")}`, "i");
const shown = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

/** the 64-digit literals a query compares topic0 with: topic0 = unhex('…'), and each one in topic0 IN (…) */
function topicLiterals(sql: string): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/\btopic0\s*(=|IN\s*\()/gi)) {
    const from = (m.index ?? 0) + m[0].length;
    let to = from;
    if (m[1] !== "=") for (let depth = 1; to < sql.length && depth > 0; to++) depth += sql[to] === "(" ? 1 : sql[to] === ")" ? -1 : 0;
    const text = m[1] === "=" ? /^\s*unhex\s*\(\s*'[^']*'\s*\)/.exec(sql.slice(from))?.[0] ?? "" : sql.slice(from, to);
    for (const lit of text.matchAll(/unhex\s*\(\s*'([0-9a-f]{64})'\s*\)/gi)) out.push(lit[1].toLowerCase());
  }
  return out;
}

/** why a query on these contracts reads no rows by a literal or a name of its own, or null: a name of ours it defines
    itself, an address that starts as one of our contracts and is not it, or a topic that is none of their events
    (nor one of `also`, the lending events a query may read beside them). Mainnet C-Chain only, as the names are */
export function familyHex(sql: string, chainId: number, also: ReadonlySet<string> = new Set()): string | null {
  if (chainId !== FAMILY_CHAIN_ID) return null;
  const own = new RegExp(`\\bAS\\s+(${OURS.join("|")})\\b|\\b(${OURS.join("|")})\\s+AS\\s*\\(`, "i").exec(sql)?.slice(1).find(Boolean);
  if (own) return `${own} is a name our server defines in front of the query; a WITH of your own may not define it. Write ${own} as it is, and leave its value to the server`;
  for (const m of sql.matchAll(/unhex\s*\(\s*'([0-9a-f]{40})'\s*\)/gi)) {
    const h = m[1].toLowerCase();
    const near = NAMED_CONTRACTS.find(([, , a]) => a.slice(2) !== h && a.slice(2, 8) === h.slice(0, 6));
    if (near) return `unhex('${shown(h)}') is not ${near[1]}, whose address our server names ${near[0]}: write ${near[0]}, as it is`;
  }
  if (!READS_FAMILIES.test(sql)) return null;
  const topic = topicLiterals(sql).find((t) => !FAMILY_EVENTS.has(t) && !also.has(t));
  return topic
    ? `unhex('${shown(topic)}') is no event of these contracts: a topic written from memory is often wrong, and this one reads no rows. Write the name our server defines for the event, as it is: vault_deposit_t or vault_withdraw_t on a vault; ot_deposit_t, ot_request_t, ot_accept_t, ot_repay_t, ot_rate_t or ot_rate_old_t on an OpenTrade pool; submitted_t, savax_unlock_t, savax_cancel_t, savax_redeem_t, savax_overdue_t, savax_rewards_t or transfer_t on savax_token; cctp_burn_v1_t, cctp_burn_v2_t, cctp_mint_v1_t or cctp_mint_v2_t on a messenger; cctp_received_v1_t or cctp_received_v2_t on a transmitter`
    : null;
}
