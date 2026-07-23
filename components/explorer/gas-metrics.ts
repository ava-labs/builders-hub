/* The gas metric registry — one entry per figure on the Gas Market sheet
   that opens into its own detail page at /explorer/[network]/[chain]/gas/[metric].
   Data-only (no "use client"), so the server route reads titles for
   metadata and the client template reads everything else. Adding a metric
   here plus a section composition in GasMetricPage is the whole cost of a
   new detail sheet. */

export type GasMetricKey = "base-fee" | "utilization" | "fee-seasonality" | "demand";

export interface GasMetricDef {
  /** page + tab title, e.g. "Base Fee" */
  title: string;
  /** one-line intro under the title — what this number is */
  blurb: string;
  /** the methodology colophon: how the figure is measured, one string per paragraph */
  methodology: string[];
}

export const GAS_METRICS: Record<GasMetricKey, GasMetricDef> = {
  "base-fee": {
    title: "Base Fee",
    blurb:
      "The protocol-set price of a unit of gas: what every transaction pays before any priority tip.",
    methodology: [
      "The base fee adjusts block by block with demand under the chain's fee mechanism: sustained demand pushes it up, idle blocks let it decay back toward the floor. It is burned, not paid to validators; the priority tip is the part that buys inclusion order.",
      "History is computed from every block in ClickHouse: each bucket's percentiles (p25, median, p75, p95) summarize the distribution of per-block base fees inside it, so the band shows what the fee actually was across the period, not a single sampled value. The live figure reads eth_feeHistory straight off the chain's public RPC.",
    ],
  },
  utilization: {
    title: "Utilization",
    blurb:
      "How full blocks are: gas used against the gas limit, the demand signal the base fee responds to.",
    methodology: [
      "Per-block utilization is gas_used / gas_limit. The daily trend averages it across every block of the day; the distribution counts blocks by fullness bucket, which shows the shape of demand a single average hides: a chain idling at 10% with hourly spikes to 80% prices very differently from one flat at 25%.",
      "Sustained utilization above the fee mechanism's target is what drives the base fee up; the two detail sheets are two views of the same market.",
    ],
  },
  demand: {
    title: "Blockspace Demand",
    blurb:
      "Who and what is buying the gas: protocols by share, methods by weight, and the transactions that paid for nothing.",
    methodology: [
      "Every transaction in the window is attributed twice: to the contract it called, aggregated to protocol level through the contract registry (unregistered contracts stay as single addresses), and to its 4-byte method selector, decoded through Sourcify's signature database where possible.",
      "Tile area and bar length are shares of the window's total gas, not transaction counts: one protocol can dominate blockspace with few transactions, and reverted transactions still appear because reverts pay for the gas they consume.",
    ],
  },
  "fee-seasonality": {
    title: "Fee Seasonality",
    blurb:
      "When blockspace is cheap: the median base fee for every hour of the week, over the selected window.",
    methodology: [
      "Every block in the window lands in one of 168 hour-of-week cells (7 days × 24 UTC hours); each cell shows the median base fee of its blocks. The window follows the page's time range, clamped to a week at minimum (every cell needs at least one sample) and a quarter at most. Medians resist one-off spikes, so the pattern that remains is genuine weekly rhythm: market hours, bot schedules, bridge batch windows.",
      "For non-urgent work (batch settlement, contract deploys, treasury moves), submitting inside the quiet cells pays materially less for identical execution.",
    ],
  },
};

export function isGasMetricKey(key: string): key is GasMetricKey {
  return key in GAS_METRICS;
}
