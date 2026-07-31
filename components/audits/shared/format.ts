const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUsd(amount: number): string {
  return usd.format(amount);
}

/** Dates render as yyyy-mm-dd everywhere (mono meta strips in the designs). */
export function formatIsoDate(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
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
