import { GROUPS, type GroupKey } from "@/lib/defi/taxonomy";

/* The DeFi page's colors as CSS variables, scoped to .defi-map so the
   light and dark steps swap in one place (the stablecoins page's
   pattern). A group wears its categorical slot everywhere; a change
   wears the diverging pair, blue up and red down, with gray at zero. */

export const DEFI_SCOPE = "defi-map";

const INK_ON: Record<GroupKey, { light: string; dark: string }> = {
  lending: { light: "#ffffff", dark: "#ffffff" },
  vaults: { light: "#ffffff", dark: "#ffffff" },
  lst: { light: "#ffffff", dark: "#ffffff" },
  rwa: { light: "#18181b", dark: "#09090b" },
  dex: { light: "#18181b", dark: "#ffffff" },
  yield: { light: "#ffffff", dark: "#ffffff" },
  bridge: { light: "#ffffff", dark: "#09090b" },
  perps: { light: "#ffffff", dark: "#09090b" },
  other: { light: "#18181b", dark: "#fafafa" },
  cex: { light: "#ffffff", dark: "#09090b" },
};

const light = GROUPS.map((g) => `--g-${g.key}: ${g.color.light}; --g-ink-${g.key}: ${INK_ON[g.key].light};`).join(" ");
const dark = GROUPS.map((g) => `--g-${g.key}: ${g.color.dark}; --g-ink-${g.key}: ${INK_ON[g.key].dark};`).join(" ");

export const DEFI_STYLE = `
.${DEFI_SCOPE} { ${light}
  --d-up: #2a78d6; --d-down: #e34948; --d-flat: #d4d4d8; --d-counted: #3f3f46; --d-gap: #ffffff; --d-current: #ffffff; }
.dark .${DEFI_SCOPE} { ${dark}
  --d-up: #3987e5; --d-down: #e66767; --d-flat: #3f3f46; --d-counted: #d4d4d8; --d-gap: #09090b; --d-current: #e4e4e7; }`;

export const groupTone = (g: GroupKey) => `var(--g-${g})`;
export const groupInk = (g: GroupKey) => `var(--g-ink-${g})`;

/** the counted layer: ink, since it spans every group */
export const COUNTED_TONE = "var(--d-counted)";

/** a change as a diverging fill; full strength at `cap` percent */
export function changeTone(pct: number | null, cap = 25): string {
  if (pct === null || Math.abs(pct) < 0.5) return "var(--d-flat)";
  const k = Math.min(1, Math.abs(pct) / cap);
  // mix toward the pole: a small move stays near gray, a big one takes the pole's color
  const pole = pct > 0 ? "var(--d-up)" : "var(--d-down)";
  return `color-mix(in oklab, ${pole} ${Math.round(35 + k * 65)}%, var(--d-flat))`;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compactB = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

/** $622.2M, $1.69B, $48K */
export function usd(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1e9 ? compactB.format(a) : compact.format(a);
  return `${v < 0 ? "−" : ""}$${s}`;
}

/** +$23.1M, −$4.2M */
export function signedUsd(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}$${(Math.abs(v) >= 1e9 ? compactB : compact).format(Math.abs(v))}`;
}

/** +12.4%, −3.1% */
export function signedPct(v: number, digits = 1): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
}
