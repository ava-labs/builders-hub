/* A question that names a protocol of our contract registry that no chapter of the prompt reads (GMX, Yield Yak,
   Stargate) is told that protocol's contracts in its turn: the writer has no table from a name to its addresses, and
   answered "GMX activity" with the GMX token's transfers. The chapters read the registry's entries that carry a
   family (a DEX's pools, Aave and Benqi, the vaults, OpenTrade, sAVAX and CCTP) and tell the writer those protocols
   themselves. Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";
import { mentioned, wordsOf } from "./names";
import { DEX_CHAIN_ID } from "./protocols";

type Entry = { address: string; category: string; name: string; protocol?: string; family?: string; version?: string };
const registry = registryData as unknown as { contracts: Entry[] };

/** English words that are protocol names as well: named only with their capital */
const CAPITAL: ReadonlySet<string> = new Set(["Agora", "Beefy", "Circle", "Curve", "Gamma", "Relay", "Salvor", "Socket", "Spectra", "Steer", "Tundra"]);
/** the most contracts one protocol's line lists */
const LISTED = 40;

/** a name's version words: "v2" of "Aave V2", "v2" of "LB v2.1" */
const versionsOf = (name: string) => wordsOf(name).filter((w) => /^v\d+$/.test(w));
/** the protocols a chapter reads, by their words, with the versions its entries carry: each with an entry that carries
    a family, a DEX's name without "DEX", and LFJ, which the registry also lists as Trader Joe */
const CHAPTERS: ReadonlyMap<string, ReadonlySet<string>> = registry.contracts.reduce((m, e) => {
  if (!e.family || !e.protocol) return m;
  for (const c of [wordsOf(e.protocol).join(" "), wordsOf(e.protocol.replace(/\s+DEX$/i, "")).join(" ")]) m.set(c, new Set([...(m.get(c) ?? []), ...versionsOf(e.version ?? "")]));
  return m;
}, new Map<string, Set<string>>([["lfj", new Set()]]));
/** a name that holds a chapter's protocol is that protocol's ("Pharaoh Exchange", "Market Making Bot (LFJ)"), unless
    it names a version the chapter's entries never carry: "Aave V2" is not the Aave v3 chapter's */
const inChapter = (name: string) => {
  const words = ` ${wordsOf(name.replace(/[()]/g, " ")).join(" ")} `;
  return [...CHAPTERS].some(([c, read]) => words.includes(` ${c} `) && versionsOf(name).every((v) => read.has(v)));
};

/** each protocol no chapter reads, with its contracts; bots and shared infrastructure are no protocol */
const PROTOCOLS: ReadonlyMap<string, Entry[]> = registry.contracts.reduce((m, e) => {
  const p = e.protocol;
  if (!p || e.category === "mev" || e.category === "infrastructure" || p === "Infrastructure" || p === "Avalanche" || /^unknown/i.test(p) || inChapter(p)) return m;
  return m.set(p, [...(m.get(p) ?? []), e]);
}, new Map<string, Entry[]>());
const NAMES = [...PROTOCOLS.keys()];

/** the registry protocols a question names that no chapter reads, on the mainnet C-Chain; the recipe key holds them */
export function registryNames(chainId: number, prompt: string): string[] {
  return chainId === DEX_CHAIN_ID ? mentioned(prompt, NAMES, CAPITAL) : [];
}

const t = (hash: string) => `unhex('${hash}')`;
/** YakStrategy's Reinvest(uint256,uint256): each Yield Yak strategy logs it */
const REINVEST = "c7606d21ac05cd309191543e409f0845c016120563783d70e4f41419dc0ef234";
/** the event that finds a protocol's contracts our registry does not list; a query that reads it reads the protocol */
export const FOUND_BY: Readonly<Record<string, string>> = { "Yield Yak": REINVEST };
/* The events that are what a protocol does, where the writer could not know them: it has no ABI, and counted
   transactions sent to GMX's token as GMX trades. Each topic is keccak256 of its signature (viem, 2026-09-30); two
   signatures alike share a topic (GMX v1's Swap and Balancer V3's). */
const EVENTS: Readonly<Record<string, string>> = {
  GMX: `GMX v2 logs each action in its EventEmitter 0xdb17b211c34240b014ab6d61d4a31fa0c0e20c26 as EventLog1 ${t("137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160")} or EventLog2 ${t("468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5")}, with keccak256 of the action's name in topic1: OrderExecuted ${t("680f10f06595d3d707241f604672ec4b6ae50eb82728ec2f3c65f6789e897760")} (an executed order: a trade), OrderCreated ${t("a7427759bfd3b941f14e687e129519da3c9b0046c5b9aaa290bb1dede63753b3")}, PositionIncrease ${t("f94196ccb31f81a3e67df18f2a62cbfb50009c80a7d3c728a3f542e3abc5cb63")}, PositionDecrease ${t("07d51b51b408d7c62dcc47cc558da5ce6a6e0fd129a427ebce150f52b0e5171a")} and SwapInfo ${t("93534d650a9b8eb67820f87038b8e8b36b741c6f7eb14d1a7ac5027e80fd4a82")}. In a position's EventLog2, topic2 is its account, the trader: tx_from is GMX's keeper, which executes every order, never a trader. A PositionIncrease also adds to an open position, so it counts increases, not openings. GMX v1's Vault 0x9ab2de34a33fb459b538c43f251eb825645e8595 logs IncreasePosition ${t("2fe68525253654c21998f35787a8d0f361905ef647c854092430ab65f2f15022")}, DecreasePosition ${t("93d75d64d1f84fc6f430a64fc578bdd4c1e090e90ea2d51773e626d19de56d30")}, LiquidatePosition ${t("2e1f85a64a2f22cf2f0c42584e7c919ed4abe8d53675cff0f62bf1e95a1c676f")} and Swap ${t("0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db")}.`,
  Curve: `A Curve pool logs TokenExchange for each swap: ${t("8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140")} in a stable pool, ${t("b2e76ae99761dc136e598d4a629bb347eccb9532a5f8bbd72e18467c3c34cc98")} in a crypto pool, ${t("143f1f8e861fbdeddd5b46e844b7d3ac7b86a122f36e8c463859ee6811b1f29c")} in a twocrypto-ng pool; a metapool's swap through its base pool's coins logs TokenExchangeUnderlying ${t("d013ca23e77a65003c2c659c5442c00c805371b7fc1ebd4c206c41d1536bd90b")} instead.`,
  Balancer: `Balancer's V2 Vault 0xba12222222228d8ba445958a75a0704d566bf2c8 logs Swap ${t("2170c741c41531aec20e7c107c24eecfdd15e69c9bb0a8dd37b1840b9e0b207b")} for a swap in any of its pools, and its V3 Vault 0xba1333333333a1ba1108e8412f11850a5c319ba9 logs Swap ${t("0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db")}.`,
  "Yield Yak": `Yield Yak's strategies are one contract each, and our registry lists none of them: a strategy is a contract that logs YakStrategy's Reinvest(uint256,uint256) ${t(REINVEST)}. Count reinvests by that topic from every address. A strategy's Deposit ${t("e1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c")} and Withdraw ${t("884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364")} count only from the contracts that logged Reinvest in the window or the 30 days before it, since WAVAX writes the same Deposit.`,
  Stargate: `A Stargate send is a v2 pool's OFTSent ${t("85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a")} or a v1 pool's Swap ${t("34660fc8af304464529f48a778e03d03e4d34bcd5f9b6f0cfbf3cd238c642f7f")}; a v2 pool's OFTReceived ${t("efed6d3500546b29533b128a29e3a94d70788727f0507505ac12eaf2e578fd9c")} is an arrival.`,
};

/** the turn's lines for them: each protocol's contracts, and that its logs, not the transactions sent to it, are what it did */
export function registryTurn(chainId: number, prompt: string): string {
  return registryNames(chainId, prompt)
    .map((p) => {
      const list = (PROTOCOLS.get(p) ?? []).slice(0, LISTED).map((e) => `${e.address.toLowerCase()} (${e.name})`).join(", ");
      const events = EVENTS[p] ? ` ${EVENTS[p]}` : "";
      return ` ${p} is these contracts in our registry: ${list}.${events} Count what ${p} did from the logs ${Object.hasOwn(FOUND_BY, p) ? "these contracts and the ones the line above finds by its event" : "these contracts"} emit, by event (topic0 as 0x text; the server names it). A transaction sent to them is a call, not what it did: a call to a token contract is a transfer or an approval of the token. The note says the count covers ${Object.hasOwn(FOUND_BY, p) ? "the contracts found that way" : "these contracts"}. When they logged none of the events the question asks about, say so, and never offer a count of calls in their place.`;
    })
    .join("");
}
