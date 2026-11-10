/* DefiLlama files Avalanche protocols under about fifty categories. The
   DeFi page reads them as ten groups, each with a fixed categorical color
   (the validated dataviz order: blue, orange, aqua, yellow, magenta,
   green, violet, red), so a group keeps its color on every chart and
   under every filter. Exchanges are a group of their own: their reserves
   sit on Avalanche, but they are not DeFi, so the page leaves them out
   unless the reader asks for them. */

export type GroupKey = "lending" | "vaults" | "lst" | "rwa" | "dex" | "yield" | "bridge" | "perps" | "other" | "cex";

export interface Group {
  key: GroupKey;
  label: string;
  /** one line on what the group holds */
  blurb: string;
  /** the group's categorical step on the light and the dark surface */
  color: { light: string; dark: string };
}

export const GROUPS: Group[] = [
  { key: "lending", label: "Lending", blurb: "Money markets and CDPs", color: { light: "#2a78d6", dark: "#3987e5" } },
  {
    key: "vaults",
    label: "Vaults",
    blurb: "Allocators, curators and aggregators that redeposit",
    color: { light: "#eb6834", dark: "#d95926" },
  },
  { key: "lst", label: "Liquid staking", blurb: "Staked AVAX that stays liquid", color: { light: "#1baf7a", dark: "#199e70" } },
  { key: "rwa", label: "Real-world assets", blurb: "Tokenized treasuries, credit and funds", color: { light: "#eda100", dark: "#c98500" } },
  { key: "dex", label: "DEXes", blurb: "Spot exchanges and aggregators", color: { light: "#e87ba4", dark: "#d55181" } },
  { key: "yield", label: "Yield", blurb: "Farms and yield strategies", color: { light: "#008300", dark: "#008300" } },
  { key: "bridge", label: "Bridges", blurb: "Assets locked in cross-chain bridges", color: { light: "#4a3aa7", dark: "#9085e9" } },
  { key: "perps", label: "Perps & options", blurb: "Derivatives, options and prediction markets", color: { light: "#e34948", dark: "#e66767" } },
  { key: "other", label: "Other", blurb: "Launchpads, payments, indexes and the rest", color: { light: "#a1a1aa", dark: "#71717a" } },
  { key: "cex", label: "Exchanges", blurb: "Centralized exchange reserves on Avalanche. Not DeFi.", color: { light: "#52525b", dark: "#a1a1aa" } },
];

export const GROUP: Record<GroupKey, Group> = Object.fromEntries(GROUPS.map((g) => [g.key, g])) as Record<GroupKey, Group>;

const BY_CATEGORY: Record<string, GroupKey> = {
  Lending: "lending",
  CDP: "lending",
  "Uncollateralized Lending": "lending",
  "NFT Lending": "lending",
  "Secondary Debt Markets": "lending",
  "RWA Lending": "rwa",
  RWA: "rwa",
  "Onchain Capital Allocator": "vaults",
  "Risk Curators": "vaults",
  "Yield Aggregator": "vaults",
  "Leveraged Farming": "vaults",
  "Liquidity Manager": "vaults",
  "Liquidity Automation": "vaults",
  "Options Vault": "vaults",
  "Basis Trading": "vaults",
  "Liquid Staking": "lst",
  "Liquid Restaking": "lst",
  Restaking: "lst",
  "Staking Pool": "lst",
  Dexs: "dex",
  Dexes: "dex",
  DEX: "dex",
  "DEX Aggregator": "dex",
  Yield: "yield",
  Farm: "yield",
  "Yield Lottery": "yield",
  Bridge: "bridge",
  "Cross Chain Bridge": "bridge",
  "Canonical Bridge": "bridge",
  "Bridge Aggregator": "bridge",
  Derivatives: "perps",
  Options: "perps",
  Synthetics: "perps",
  "Prediction Market": "perps",
  CEX: "cex",
};

/** the group a DefiLlama category belongs to; anything unlisted is Other */
export function groupOf(category: string | null | undefined): GroupKey {
  return (category && BY_CATEGORY[category]) || "other";
}
