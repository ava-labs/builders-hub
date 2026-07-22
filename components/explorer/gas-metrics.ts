/* The gas metric registry — one entry per figure on the Gas Market sheet
   that opens into its own detail page at /explorer/[network]/[chain]/gas/[metric].
   Data-only (no "use client"), so the server route reads titles for
   metadata and the client template reads everything else. Adding a metric
   here plus a section composition in GasMetricPage is the whole cost of a
   new detail sheet. */

export type GasMetricKey = "base-fee" | "utilization" | "fee-seasonality";

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
  "fee-seasonality": {
    title: "Fee Seasonality",
    blurb:
      "When blockspace is cheap: the median base fee for every hour of the week, over the last 30 days.",
    methodology: [
      "Every block from the last 30 days lands in one of 168 hour-of-week cells (7 days × 24 UTC hours); each cell shows the median base fee of its blocks. Medians resist one-off spikes, so the pattern that remains is genuine weekly rhythm: market hours, bot schedules, bridge batch windows.",
      "For non-urgent work (batch settlement, contract deploys, treasury moves), submitting inside the quiet cells pays materially less for identical execution.",
    ],
  },
};

export function isGasMetricKey(key: string): key is GasMetricKey {
  return key in GAS_METRICS;
}
