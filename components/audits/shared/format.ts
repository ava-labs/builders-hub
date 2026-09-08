const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(amount: number): string {
  return usd.format(amount);
}

/** "1 week", "6 weeks". Durations are rendered in half a dozen places and
    every one of them used to hardcode the plural. */
export function weeksLabel(weeks: number): string {
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/**
 * Reads a whole number the way a human types one: "12,500", "12 500" and
 * "$12,500" all mean 12500.
 *
 * Number.parseInt does NOT do this. It stops at the first separator, so
 * parseInt("12,500") is 12, which silently turned a $12,500 quote into a $12
 * one. Anything that is not a whole number after the separators come off
 * returns null, so a typo surfaces as a validation error instead of quietly
 * becoming a different amount.
 */
export function parseWholeNumber(value: string): number | null {
  const stripped = value.replace(/[\s,_$]/g, "");
  if (!/^\d+$/.test(stripped)) return null;
  const parsed = Number.parseInt(stripped, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Dates render as yyyy-mm-dd everywhere (mono meta strips in the designs). */
export function formatIsoDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * These two keep calendar dates calendar dates.
 *
 * A date picker hands back LOCAL midnight, and everything here renders with
 * toISOString, which is UTC. East of Greenwich those disagree by a day: 18
 * August picked at GMT+2 became 2026-08-17T22:00Z and displayed as the 17th,
 * in the field, the tables and the emails alike.
 *
 * So a picked day is stored as UTC midnight of that calendar day, and a stored
 * day is handed back to the picker as local midnight of the same calendar day.
 * Server-rendered email and browser-rendered UI then agree, in every timezone.
 */
export function toUtcCalendarDate(picked: Date): Date {
  return new Date(Date.UTC(picked.getFullYear(), picked.getMonth(), picked.getDate()));
}

export function fromUtcCalendarDate(stored: Date | string): Date {
  const date = new Date(stored);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Date + time for "you just did this" moments (receipt eyebrow, board 3a). */
export function formatIsoDateTime(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 16).replace("T", " ");
}

export function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Compact thousands for meta strips and tables: 24000 -> $24k. */
export function kUsd(amount: number): string {
  return `$${Math.round(amount / 1000)}k`;
}

/** "1 quote" / "3 quotes" with the count. */
export function quoteCountLabel(count: number): string {
  return `${count} ${count === 1 ? "quote" : "quotes"}`;
}

/** "$24k–$32k", collapsing to a single figure when both ends render alike. */
export function formatQuoteRange(min: number, max: number): string {
  return kUsd(min) === kUsd(max) ? kUsd(min) : `${kUsd(min)}–${kUsd(max)}`;
}

/** Lowercases a label's first character for mid-sentence segments. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Display host for a proposal link ("docs.google.com"), so the reader knows
    where the click goes. Empty on an unparsable value: legacy data must never
    crash a view. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** "+$1,500 vs lowest" under non-lowest prices (round-5 5b). Null for the
    lowest quote itself: the "Lowest price" chip already marks it. */
export function priceDeltaLabel(priceUsd: number, lowestUsd: number): string | null {
  if (priceUsd <= lowestUsd) return null;
  return `+${formatUsd(priceUsd - lowestUsd)} vs lowest`;
}

/** True when a quoted start lands after the request's needed-by date. The
    boundary day itself is inside: starting ON the date still meets it. */
export function isOutsideWindow(
  earliestStart: Date | string,
  neededBy: Date | string | null | undefined,
): boolean {
  if (!neededBy) return false;
  return new Date(earliestStart).getTime() > new Date(neededBy).getTime();
}
