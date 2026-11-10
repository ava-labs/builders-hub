/* No figure on the C-Chain comes near a trillion dollars, or a quadrillion units of one token. A figure that
   does is an amount read without its decimals, or a signed amount (int256) read as unsigned: one D16 run gave
   a fee of 2.0e287 dollars. The writer is told once which column and row, the way a figure below zero is. */

import type { ColumnMeta } from "./clickhouse";
import { isFuji } from "./target";

type Rows = { columns: readonly ColumnMeta[]; rows: readonly Record<string, unknown>[] };

/** the most a figure in dollars may be */
export const MAX_USD = 1e12;
/** the most a token amount may be, in whole units: an amount of 18 decimals read raw passes it at a thousandth of a token */
export const MAX_UNITS = 1e15;

const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;
/** a figure written as text, as a big integer comes back; never a hex word */
const DECIMAL = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
/** a column's words: fee_usd is fee and usd, amount0 is amount, netFlowUsd is net, flow and usd */
const wordsOf = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).map((w) => w.replace(/\d+$/, "")).filter(Boolean);
/** a figure in dollars, or in a dollar stablecoin */
const USD = new Set(["usd", "usdc", "usdt", "dai", "dollars", "tvl"]);
/** a token amount, by what it measures or by the token it is in */
const AMOUNT = new Set([
  "amount", "amounts", "units", "tokens", "qty", "quantity", "volume", "volumes", "value", "fee", "fees", "flow", "flows",
  "inflow", "inflows", "outflow", "outflows", "net", "supply", "supplied", "borrow", "borrows", "borrowed", "repay",
  "repays", "repaid", "withdraw", "withdrawn", "withdrawal", "withdrawals", "deposit", "deposits", "deposited",
  "transferred", "sent", "received", "balance", "balances", "holdings", "minted", "burned", "burnt", "staked",
  "delegated", "locked", "reward", "rewards", "debt", "collateral", "reserve", "reserves", "premium", "liquidated",
  "seized", "bought", "sold", "bridged", "avax", "wavax", "savax", "eth", "weth", "btc", "wbtc", "link", "qi", "eurc",
]);
/** a price is a ratio, which has no ceiling unless it is in dollars */
const PRICE = new Set(["price", "prices", "px"]);
/** a column in raw units by its name, or one that counts, places, times or rates the rows rather than holding an amount */
const OTHER = new Set([
  "raw", "wei", "gwei", "nano", "navax", "gas", "count", "counts", "number", "num", "block", "blocks", "height", "id",
  "ids", "nonce", "index", "time", "timestamp", "ts", "unix", "ms", "seconds", "bytes", "size", "weight", "rank",
  "pct", "percent", "share", "ratio", "rate", "apy", "apr", "bps", "liquidity", "sqrt", "tick", "decimals",
]);

/** the most a column's figures may be, by its name; null for a column the check does not read */
export function ceilingOf(name: string): number | null {
  const w = wordsOf(name);
  if (w.some((x) => OTHER.has(x))) return null;
  if (w.some((x) => USD.has(x))) return MAX_USD;
  if (w.some((x) => PRICE.has(x))) return null;
  return w.some((x) => AMOUNT.has(x)) ? MAX_UNITS : null;
}

const figure = (v: unknown): number => (typeof v === "number" ? v : typeof v === "string" && DECIMAL.test(v.trim()) ? Number(v) : NaN);

/** why the rows cannot be right when a figure in dollars passes a trillion, or a token amount a quadrillion units,
    naming each such column and its first row; or null. Fuji's answers are not checked */
export function absurdFigure(result: Rows, chainId: number): string | null {
  if (isFuji(chainId)) return null;
  const hits: string[] = [];
  for (const { name, type } of result.columns) {
    const max = NUMERIC.test(type) ? ceilingOf(name) : null;
    if (max === null) continue;
    const i = result.rows.findIndex((r) => Math.abs(figure(r[name])) > max);
    if (i >= 0) hits.push(`${name} is ${String(result.rows[i][name])} in row ${i + 1}`);
  }
  if (!hits.length) return null;
  return `${hits.slice(0, 3).join(", and ")}. No figure in dollars on the C-Chain comes near a trillion (1e12), and no token amount near a quadrillion units (1e15): a figure that size is an amount read without its decimals, or a signed amount (int256) read as unsigned. Divide each raw amount by pow(10, its token's decimals), and read a univ3 or univ4 Swap amount with reinterpretAsInt256. Call render_chart again unchanged only if the figure is right.`;
}
