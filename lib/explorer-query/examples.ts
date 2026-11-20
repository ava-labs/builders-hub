/* The suggested questions on the Query page. The warm job answers
   these ahead of time, so a first click only runs the SQL. */

import { NETWORK_ID, NETWORK_SLUG, isCChain } from "./target";

/** the shape of chart a suggestion's answer draws, previewed on its card */
export type Glyph = "stack" | "hbar" | "area" | "limit" | "donut" | "line" | "scatter" | "bars";

export const EXAMPLES: { group: string; hue: string; items: { q: string; hint: string; glyph?: Glyph }[] }[] = [
  {
    group: "Activity",
    hue: "#E6212F",
    items: [
      { q: "Transactions per 5 minutes, with reverts", hint: "Throughput and failure, bucketed", glyph: "stack" },
      { q: "Busiest senders in the last hour", hint: "Who is sending the most", glyph: "hbar" },
      { q: "Active addresses per day over the last 30 days", hint: "Senders and recipients, per day", glyph: "line" },
    ],
  },
  {
    group: "Gas and fees",
    hue: "#d97706",
    items: [
      { q: "Fees burned per 5 minutes", hint: "AVAX removed from supply", glyph: "area" },
      { q: "Gas reserved per block against the limit", hint: "How full blocks run", glyph: "limit" },
      { q: "Gas price percentiles per hour over the last 7 days", hint: "Median, 10th, 90th, 99th", glyph: "line" },
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
      { q: "Stablecoin transfer volume per day, by token", hint: "Four dollar tokens, per day", glyph: "stack" },
      { q: "Top tokens by transfers in the last 24 hours", hint: "Which tokens move the most", glyph: "hbar" },
    ],
  },
  {
    group: "DEXs",
    hue: "#7c3aed",
    items: [
      { q: "DEX volume by protocol this week", hint: "Each protocol's share of the volume", glyph: "donut" },
      { q: "DEX volume by protocol, last 7 days against the 7 days before", hint: "Which protocols gained or lost", glyph: "hbar" },
    ],
  },
  {
    group: "Lending",
    hue: "#65a30d",
    items: [
      { q: "Lending deposits, withdrawals, borrows and repayments per day", hint: "Aave v3 and Benqi, in and out", glyph: "stack" },
      { q: "Liquidations per day over the last 30 days", hint: "Debt repaid, collateral seized", glyph: "bars" },
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
      { q: "Stake started and ended per week over the last 12 weeks", hint: "Stake in against stake out", glyph: "stack" },
      { q: "Staking rewards paid per week over the last 12 weeks", hint: "AVAX minted to stakers", glyph: "bars" },
    ],
  },
  {
    group: "Validators",
    hue: "#0061E2",
    items: [
      { q: "Largest validators right now, with delegators and uptime", hint: "The top of the set", glyph: "hbar" },
      { q: "Validators whose staking period ends in the next 7 days", hint: "Stake about to unlock", glyph: "scatter" },
      { q: "Validators on the Primary Network per day over the last 90 days", hint: "Validators and stake, per day", glyph: "line" },
      { q: "AvalancheGo versions by validators and stake", hint: "Who has upgraded", glyph: "hbar" },
      { q: "Delegation fee of every validator", hint: "What validators charge delegators", glyph: "bars" },
      { q: "Uptime of every validator", hint: "Who nears the 80% line", glyph: "bars" },
    ],
  },
  {
    group: "L1s",
    hue: "#0d9488",
    items: [
      { q: "L1s by active validators, with the balance left for fees", hint: "Who runs what", glyph: "donut" },
      { q: "L1 validator registrations per week", hint: "Growth of the L1 set", glyph: "bars" },
      { q: "New L1s per month over the last 12 months", hint: "Conversions, month by month", glyph: "bars" },
      { q: "L1 validators by days of fee balance left", hint: "How long fee balances last", glyph: "bars" },
    ],
  },
  {
    group: "Supply and transactions",
    hue: "#d97706",
    items: [
      { q: "AVAX supply per day over the last 90 days", hint: "P-Chain supply, before burns", glyph: "line" },
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
      { q: "Daily active addresses over the last 30 days", hint: "Senders and recipients, per day", glyph: "line" },
    ],
  },
  {
    group: "Contracts",
    hue: "#0061E2",
    items: [
      { q: "Top contracts by calls this week", hint: "Who the chain works for", glyph: "hbar" },
      { q: "New contracts deployed per day this month", hint: "What is being built", glyph: "bars" },
      { q: "Top contracts, last 7 days against the 7 days before", hint: "Which contracts gained or lost", glyph: "hbar" },
      { q: "Most called methods in the last 7 days", hint: "Decoded, with reverts and callers", glyph: "hbar" },
    ],
  },
  {
    group: "Gas and time",
    hue: "#d97706",
    items: [
      { q: "Gas used per day over the last 30 days", hint: "How much work the chain does", glyph: "area" },
      { q: "Busiest hours of the day this week", hint: "Transactions by hour, UTC", glyph: "bars" },
      { q: "Transactions by hour and weekday", hint: "When the chain is busy", glyph: "bars" },
      { q: "Block fullness and block time per day", hint: "How full blocks run", glyph: "line" },
    ],
  },
  {
    group: "Tokens and senders",
    hue: "#0d9488",
    items: [
      { q: "Token contracts by transfers this week", hint: "Which tokens move", glyph: "donut" },
      { q: "Busiest senders this week", hint: "Who is sending the most", glyph: "hbar" },
      { q: "New senders per day over the last 30 days", hint: "New against returning senders", glyph: "stack" },
      { q: "Largest native token transfers in the last 7 days", hint: "Size, sender, receiver", glyph: "scatter" },
    ],
  },
  {
    group: "Fees",
    hue: "#7c3aed",
    items: [
      { q: "Gas price per day over the last 30 days", hint: "Median, 10th and 90th percentile", glyph: "line" },
      { q: "Fees paid per day over the last 30 days", hint: "What users paid, per day", glyph: "area" },
    ],
  },
];

/** the network's suggestions: the C-Chain and every L1 at once */
export const NETWORK_EXAMPLES: typeof EXAMPLES = [
  {
    group: "Activity",
    hue: "#E6212F",
    items: [
      { q: "Chains ranked by transactions this week", hint: "Where the network's work happens", glyph: "hbar" },
      { q: "Network transactions per day over the last 30 days", hint: "Every chain's, per day", glyph: "stack" },
      { q: "Chains by transactions, last 7 days against the 7 days before", hint: "Which chains gained or lost", glyph: "hbar" },
      { q: "Network transactions per day, C-Chain against the L1s", hint: "The L1s' share, per day", glyph: "stack" },
      { q: "Network transactions by hour and weekday", hint: "When the network is busy", glyph: "bars" },
    ],
  },
  {
    group: "Addresses",
    hue: "#0061E2",
    items: [
      { q: "Network active addresses per day this week", hint: "Each address once, across the chains", glyph: "line" },
      { q: "Chains ranked by active addresses this week", hint: "Who has the users", glyph: "hbar" },
      { q: "Senders by number of chains used in the last 7 days", hint: "Who uses several chains", glyph: "bars" },
    ],
  },
  {
    group: "Fees and gas",
    hue: "#d97706",
    items: [
      { q: "Fees paid per chain today", hint: "Each in its own native token", glyph: "hbar" },
      { q: "Gas charged per chain today", hint: "How much work each chain does", glyph: "hbar" },
    ],
  },
  {
    group: "Contracts and messages",
    hue: "#0d9488",
    items: [
      { q: "ICM messages between chains in the last 7 days", hint: "Which chains talk to which", glyph: "hbar" },
      { q: "Contracts created per chain this week", hint: "Where builders deploy", glyph: "hbar" },
      { q: "Busiest contracts across the network in the last 7 days", hint: "The network's most used contracts", glyph: "hbar" },
    ],
  },
  {
    group: "ICM",
    hue: "#7c3aed",
    items: [
      { q: "ICM messages sent and received per day over the last 30 days", hint: "Messages sent and received", glyph: "bars" },
      { q: "ICTT token transfers between chains in the last 7 days", hint: "Token bridges, route by route", glyph: "hbar" },
      { q: "ICTT tokens by transfers in the last 30 days", hint: "Which tokens cross chains", glyph: "donut" },
    ],
  },
];

/** an EVM chain's suggestions: the network's, the C-Chain's own, or the generic set */
export function examplesFor(chainId: number | string): typeof EXAMPLES {
  if (chainId === NETWORK_ID || chainId === NETWORK_SLUG) return NETWORK_EXAMPLES;
  return isCChain(chainId) ? EXAMPLES : L1_EXAMPLES;
}
