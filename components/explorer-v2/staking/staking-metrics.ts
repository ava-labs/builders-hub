/* The staking metric registry — one entry per figure on the Primary
   Network Staking page that opens into its own detail sheet at
   /explorer/[network]/[chain]/staking/[metric]. Data-only (no "use
   client"), so the server routes read titles for metadata and the client
   template reads everything else. Adding a metric here plus a section
   composition in StakingMetricPage is the whole cost of a new sheet —
   the same contract as the gas family. */

export type StakingMetricKey = "total-stake" | "apy" | "rewards" | "expiry" | "distribution";

export interface StakingMetricDef {
  /** page + tab title, e.g. "Total Stake" */
  title: string;
  /** one-line intro under the title — what this number is */
  blurb: string;
  /** the methodology colophon: how the figure is measured, one string per paragraph */
  methodology: string[];
}

export const STAKING_METRICS: Record<StakingMetricKey, StakingMetricDef> = {
  "total-stake": {
    title: "Total Stake",
    blurb:
      "The capital securing the Primary Network: validators' own stake and everything delegated on top of it.",
    methodology: [
      "Own stake and delegated stake are daily aggregates over the current validator and delegator sets, from the chain-metrics indexer. The stacked view keeps the two apart because they behave differently: own stake moves when operators join, leave, or restake; delegated stake follows retail sentiment and unlock schedules.",
      "The staking ratio divides that total by the circulating supply the emission feed reports for the same day — the share of all AVAX in existence that is working as security. Days the two feeds don't share are dropped rather than interpolated.",
      "The delegator count rides the same indexer. A rising count against flat delegated stake means smaller average positions — worth reading together, not separately.",
    ],
  },
  apy: {
    title: "Reward Rate",
    blurb:
      "The protocol's estimated annual reward rate: a full-year term sets the upper curve, the two-week minimum term the lower one.",
    methodology: [
      "The rate follows the network's public emission formula: rewards are newly minted AVAX, scaled by how much of the remaining supply is left to mint and by the staking ratio — the more of the supply is staked, the lower the rate for everyone. The two curves differ only by term length: the consumption rate interpolates from 10% at the two-week minimum to 12% at the one-year maximum.",
      "These are estimates computed from current conditions, not a promise of any return. The realized rate for any position also depends on the validator's delegation fee (for delegators) and on the validator maintaining the uptime requirement through the whole term — miss it and the reward is zero.",
    ],
  },
  rewards: {
    title: "Rewards",
    blurb:
      "What securing the network mints: rewards accrued per day, the all-time total, and what actually landed in wallets.",
    methodology: [
      "Minted rewards are the indexer's daily accrual series — what the emission schedule credits to active stake each day. Paid rewards are parsed from the reward-UTXO archive in ClickHouse: the amounts that actually became spendable when staking periods ended. Accrual is smooth; payouts are lumpy, because they arrive in bursts as terms expire.",
      "Every reward is newly minted AVAX — staking rewards are inflation, offset by the fees the network burns.",
    ],
  },
  expiry: {
    title: "Stake Expiry",
    blurb:
      "Stake coming unlocked: how much AVAX ends its staking term on each day ahead, and how it accumulates.",
    methodology: [
      "Every active validator and delegator position carries an immutable end time, set when the stake was locked. This schedule sums them by day from the latest set snapshot — it is the maximum that CAN unlock, not a prediction of selling: most stake re-enters within days.",
      "Large single-day spikes are usually a few whale positions or a cohort staked together (an exchange batch, a launch-day rush) reaching term in step. The cumulative line answers the practical question: how much of today's security budget rolls over within the window.",
    ],
  },
  distribution: {
    title: "Stake Distribution",
    blurb:
      "How evenly the network's security spreads across the validator set — and what delegating to each slice costs.",
    methodology: [
      "Concentration ranks the current set by weight and climbs the cumulative share: the rank where the red line crosses 50% is the smallest club of validators that together control half the network. The flatter the climb, the more evenly security is spread. The lens toggle re-ranks by total weight, own stake, or delegated stake — the three tell different stories about where power actually sits.",
      "Delegation fees are bucketed by percentage, weighted by the stake that actually lives at each fee. A tall bar at a low fee means the market has already found the cheap validators; a fat tail at high fees is capital that isn't shopping.",
    ],
  },
};

export function isStakingMetricKey(key: string): key is StakingMetricKey {
  return key in STAKING_METRICS;
}
