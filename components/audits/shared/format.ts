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
