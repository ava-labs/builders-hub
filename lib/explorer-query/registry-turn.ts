/* A question that names a protocol of our contract registry that no chapter of the prompt reads (GMX, Yield Yak,
   Stargate) is told that protocol's contracts in its turn: the writer has no table from a name to its addresses, and
   answered "GMX activity" with the GMX token's transfers. The chapters read the registry's entries that carry a
   family (a DEX's pools, Aave and Benqi, the vaults, OpenTrade, sAVAX and CCTP) and tell the writer those protocols
   themselves. Mainnet C-Chain only. */

import registryData from "@/data/contract-registry.json";
import { mentioned, wordsOf } from "./names";
import { DEX_CHAIN_ID } from "./protocols";

type Entry = { address: string; category: string; name: string; protocol?: string; family?: string };
const registry = registryData as unknown as { contracts: Entry[] };

/** English words that are protocol names as well: named only with their capital */
const CAPITAL: ReadonlySet<string> = new Set(["Agora", "Beefy", "Circle", "Curve", "Gamma", "Relay", "Salvor", "Socket", "Spectra", "Steer", "Tundra"]);
/** the most contracts one protocol's line lists */
const LISTED = 24;

/** the protocols a chapter reads, by their words: each with an entry that carries a family, a DEX's name without
    "DEX", and LFJ, which the registry also lists as Trader Joe */
const CHAPTERS: readonly string[] = [
  ...new Set(registry.contracts.flatMap((e) => (e.family && e.protocol ? [wordsOf(e.protocol).join(" "), wordsOf(e.protocol.replace(/\s+DEX$/i, "")).join(" ")] : []))),
  "lfj",
];
/** a name that holds a chapter's protocol is that protocol's ("Pharaoh Exchange", "Market Making Bot (LFJ)") */
const inChapter = (name: string) => {
  const words = ` ${wordsOf(name.replace(/[()]/g, " ")).join(" ")} `;
  return CHAPTERS.some((c) => words.includes(` ${c} `));
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

/** the turn's lines for them: each protocol's contracts, and what its activity counts */
export function registryTurn(chainId: number, prompt: string): string {
  return registryNames(chainId, prompt)
    .map((p) => {
      const list = (PROTOCOLS.get(p) ?? []).slice(0, LISTED).map((e) => `${e.address.toLowerCase()} (${e.name})`).join(", ");
      return ` ${p} is these contracts in our registry: ${list}. Its activity is the transactions sent to them and the logs they emit.`;
    })
    .join("");
}
