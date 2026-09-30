/* What a value in a query's rows is (an address, a hash, a selector, a UTC time, as the rows write them), an
   address by its ends, the units the explorer counts time in, and the months' names. The rows, the charts, the
   cards and the readings all ask here. */

/** a 20-byte address: 0x and 40 hex digits, in either case */
export const isAddress = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
/** a 32-byte value (a transaction hash, a topic, a pool id): 0x and 64 hex digits */
export const isHash = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
/** a 4-byte function selector: 0x and 8 hex digits */
export const isSelector = (v: unknown): v is string => typeof v === "string" && /^0x[0-9a-fA-F]{8}$/.test(v);
/** a UTC time as the rows write it: a day (2026-09-27), or a day and a time to the minute or the second */
export const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(v);
/** "0x1234…abcd": an address or a hash by its first 6 and last 4 characters, cut at any length (truncate in
    format.ts keeps a short one whole) */
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** the units of time, in ms */
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
/** a day in seconds, for a unix time */
export const SECONDS_PER_DAY = 86_400;

/** the months as a sentence writes them: September 21 */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** and as a card or an axis writes them: Sep 21 */
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
