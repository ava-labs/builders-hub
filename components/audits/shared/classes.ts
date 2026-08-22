/**
 * Shared audits class recipes. Single source for the mono micro-label (five
 * drifted variants existed before this) and the Foundations card surface so
 * light/dark always pair correctly (semantic bg-card does not map to the
 * brand #1F1F1F in dark).
 */
export const MONO_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400";

export const MONO_LABEL_SM =
  "font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400";

/** Meta strips (inbox cards, composer header): between the two above. */
export const MONO_LABEL_META =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400";

export const CARD =
  "rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#1F1F1F]";

/** Dialog/sheet surface: the CARD pairing for radix content, which otherwise
    renders semantic bg-background (near-black, off the brand #1F1F1F). */
export const AUDITS_DIALOG =
  "border-zinc-200 bg-white dark:border-white/10 dark:bg-[#1F1F1F]";
