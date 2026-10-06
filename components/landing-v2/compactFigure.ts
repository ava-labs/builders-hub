// Compact figures for the home stats board. A reader takes in "$2.12B" at a
// glance; "$2,118,145,663.76" has to be read digit by digit. The rule: three
// significant digits with a K, M, B or T suffix, trailing zeros kept ("$2.10B",
// not "$2.1B"), so a figure never drops to two digits or changes width when a
// price moves. Counts under 10,000 stay exact, because "1,177" is already
// short and "1.18K" would hide a real count.

type FigureUnit = "count" | "usd";

const EXACT_BELOW = 10_000;

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumSignificantDigits: 3,
  maximumSignificantDigits: 3,
});
const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUFFIX_SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const withUnit = (body: string, unit: FigureUnit) => (unit === "usd" ? `$${body}` : body);

/** The figure as the board shows it: "$2.12B", "43.6M", "1,177". */
export function formatCompact(n: number, unit: FigureUnit = "count"): string {
  return withUnit(Math.abs(n) < EXACT_BELOW ? GROUPED.format(n) : COMPACT.format(n), unit);
}

/** The full figure, for the hover title and for screen readers. */
export function formatExact(n: number, unit: FigureUnit = "count"): string {
  return unit === "usd" ? `$${CENTS.format(n)}` : GROUPED.format(n);
}

/**
 * A count-up frame: shows `value` in the unit and decimals of `target`, so an
 * entrance never steps through K and M on its way to B ("0.00B" to "2.12B").
 * At `value === target` the result is exactly `formatCompact(target)`.
 */
export function formatCompactIn(value: number, target: number, unit: FigureUnit = "count"): string {
  if (value === target) return formatCompact(target, unit);
  if (Math.abs(target) < EXACT_BELOW) return withUnit(GROUPED.format(Math.round(value)), unit);
  const parts = COMPACT.formatToParts(target);
  const suffix = parts.find((p) => p.type === "compact")?.value ?? "";
  const decimals = parts.find((p) => p.type === "fraction")?.value.length ?? 0;
  const scale = SUFFIX_SCALE[suffix] ?? 1;
  return withUnit(`${(value / scale).toFixed(decimals)}${suffix}`, unit);
}
