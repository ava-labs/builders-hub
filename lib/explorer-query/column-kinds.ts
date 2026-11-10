/* What a column is, by its type and its name: a number, a count of distinct things, an average, an extreme, a rate.
   The rules say which figures add up over the rows, and both the server's checks and the page's findings read them
   here. Light on purpose: the page loads this module. */

import type { ColumnMeta } from "./clickhouse";
import { uniqAliases } from "./aliases";

export const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;

/* a column that counts distinct things in each row (active addresses, senders, holders) has no total over the rows:
   a sum counts one address once for each row it is in (the L1 audit's L14 summed a week's daily active addresses,
   149 against 85 distinct). A count of new ones, first seen in their row, adds up */
const DISTINCT_NAME = /(?:^|_)(?:addresses|addrs|senders|recipients|receivers|callers|holders|wallets|users|accounts|traders|swappers|depositors|borrowers|signers|participants|(?:uniq|distinct|unique)\w*)(?:_|$)/i;
const NEW_NAME = /(?:^|_)(?:new|first)(?:_|$)/i;
/** the columns that count distinct things in each row, by their name or by the uniq call that makes them */
export function distinctColumns(columns: readonly ColumnMeta[], sql?: string): Set<string> {
  const made = sql ? uniqAliases(sql) : new Set<string>();
  return new Set(columns.filter((c) => NUMERIC.test(c.type) && !NEW_NAME.test(c.name) && (made.has(c.name) || DISTINCT_NAME.test(c.name))).map((c) => c.name));
}

/* an average in each row (avg_gwei, median_fee) has no total, and the mean of the rows' averages is not the average
   over what they count: the follow-up audit's T10 read the mean of 8 hourly means as today's average gas price. A
   count beside it (txs) weighs each row's average, which gives that average. A maximum in each row (max_fee) ranks
   rows, not the items in them: T02 read the second-highest hourly maximum as the second-highest block */
export const MEAN_NAME = /(?:^|_)(?:avg|average|mean|median|p\d{2})(?:_|$)/i;
export const EXTREME_NAME = /(?:^|_)(?:max|maximum|peak|highest|min|minimum|lowest)(?:_|$)/i;

/** a figure whose sum means nothing: a rate, a price, an average, a share already */
export const RATE = /(?:^|_)(?:pct|percent|rate|ratio|share|price|avg|average|median|mean|apr|apy|bps|index|decimals|of_total)(?:_|$)/i;
