/* The suggested questions on the Query page. The warm job answers
   these ahead of time, so a first click only runs the SQL. */

import { isCChain } from "./target";

/** the shape of chart a suggestion's answer draws, previewed on its card */
export type Glyph = "stack" | "hbar" | "area" | "limit" | "donut" | "line" | "scatter" | "bars";

export const EXAMPLES: { group: string; hue: string; items: { q: string; hint: string; glyph?: Glyph }[] }[] = [
  {
    group: "Activity",
    hue: "#E6212F",
    items: [
      { q: "Transactions per 5 minutes, with reverts", hint: "Throughput and failure, bucketed", glyph: "stack" },
      { q: "Busiest senders in the last hour", hint: "Who is sending the most", glyph: "hbar" },
    ],
  },
  {
    group: "Gas and fees",
    hue: "#d97706",
    items: [
      { q: "Fees burned per 5 minutes", hint: "AVAX removed from supply", glyph: "area" },
      { q: "Gas reserved per block against the limit", hint: "How full blocks run", glyph: "limit" },
    ],
  },
  {
    group: "Contracts",
    hue: "#0061E2",
    items: [
      { q: "Most called methods", hint: "Decoded, with reverts and callers", glyph: "hbar" },
      { q: "Top contracts by gas charged", hint: "Who the chain works for", glyph: "donut" },
    ],
  },
  {
    group: "Tokens",
    hue: "#0d9488",
    items: [
      { q: "USDC transfers per 5 minutes, count and volume", hint: "Stablecoin flow", glyph: "line" },
      { q: "Largest USDT transfers in the last hour", hint: "Size, sender, receiver", glyph: "scatter" },
    ],
  },
];

/** the P-Chain's suggested questions */
export const PCHAIN_EXAMPLES: typeof EXAMPLES = [
  {
    group: "Staking",
    hue: "#E6212F",
    items: [
      { q: "AVAX staked on the Primary Network per day this month", hint: "Stake plus delegations", glyph: "area" },
      { q: "Delegations per day, with AVAX delegated", hint: "Who is joining", glyph: "bars" },
    ],
  },
  {
    group: "Validators",
    hue: "#0061E2",
    items: [
      { q: "Largest validators right now, with delegators and uptime", hint: "The top of the set", glyph: "hbar" },
      { q: "Validators whose staking period ends in the next 7 days", hint: "Stake about to unlock", glyph: "scatter" },
    ],
  },
  {
    group: "L1s",
    hue: "#0d9488",
    items: [
      { q: "L1s by active validators, with the balance left for fees", hint: "Who runs what", glyph: "donut" },
      { q: "L1 validator registrations per week", hint: "Growth of the L1 set", glyph: "bars" },
    ],
  },
  {
    group: "Supply and transactions",
    hue: "#d97706",
    items: [
      { q: "AVAX supply per day over the last 90 days", hint: "What staking mints", glyph: "line" },
      { q: "P-Chain transactions by type this week", hint: "What the chain does", glyph: "stack" },
    ],
  },
];

/** an L1's suggested questions: nothing that names a C-Chain token, so they work on any EVM chain */
export const L1_EXAMPLES: typeof EXAMPLES = [
  {
    group: "Activity",
    hue: "#E6212F",
    items: [
      { q: "Daily transactions over the last 30 days, with reverts", hint: "Throughput and failure, per day", glyph: "stack" },
      { q: "Daily active addresses over the last 30 days", hint: "Distinct senders per day", glyph: "line" },
    ],
  },
  {
    group: "Contracts",
    hue: "#0061E2",
    items: [
      { q: "Top contracts by calls this week", hint: "Who the chain works for", glyph: "hbar" },
      { q: "New contracts deployed per day this month", hint: "What is being built", glyph: "bars" },
    ],
  },
  {
    group: "Gas and time",
    hue: "#d97706",
    items: [
      { q: "Gas used per day over the last 30 days", hint: "How much work the chain does", glyph: "area" },
      { q: "Busiest hours of the day this week", hint: "Transactions by hour, UTC", glyph: "bars" },
    ],
  },
  {
    group: "Tokens and senders",
    hue: "#0d9488",
    items: [
      { q: "Token contracts by transfers this week", hint: "Which tokens move", glyph: "donut" },
      { q: "Busiest senders this week", hint: "Who is sending the most", glyph: "hbar" },
    ],
  },
];

/** every suggested question, in order */
export const EXAMPLE_PROMPTS = EXAMPLES.flatMap((g) => g.items.map((i) => i.q));

/** an EVM chain's suggestions: the C-Chain's own, or the generic set */
export function examplesFor(chainId: number | string): typeof EXAMPLES {
  return isCChain(chainId) ? EXAMPLES : L1_EXAMPLES;
}
