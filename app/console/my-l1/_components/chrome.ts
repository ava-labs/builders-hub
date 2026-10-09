// Shared class strings for the My L1 dashboard, in the explorer-v2 / console-home voice.

export const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';

export const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';

const BTN =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export const BTN_PRIMARY = `${BTN} border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`;

export const BTN_SECONDARY = `${BTN} border-zinc-300 bg-transparent text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50`;

export const BTN_DANGER = `${BTN} border-red-300 bg-red-50 text-red-700 hover:border-red-500 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 dark:hover:border-red-700`;

/** A square icon-only button at the primary button's height. */
export const ICON_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-300 text-zinc-500 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100';

/** A small square icon button for row-level actions. */
export const ROW_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100';

export const ROW_BTN_DANGER =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 transition-colors hover:border-red-500 hover:text-red-600 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-red-700 dark:hover:text-red-400';

/** A fully-outlined board surface (Board only draws a bottom rule). */
export const FRAME = 'border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80';

/** The title bar fused inside a framed board, matching BoardHeader / ChartBoard. */
export const TITLE_BAR =
  'flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-5 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900/40';

/** A Collapsible trigger set as the board's title bar; the rule under it appears only while open. */
export const DISCLOSURE =
  'group/disclosure flex min-h-10 w-full cursor-pointer items-center gap-3 bg-zinc-50/80 px-5 py-2 text-left data-[state=open]:border-b data-[state=open]:border-zinc-200 md:px-6 dark:bg-zinc-900/40 dark:data-[state=open]:border-zinc-800 [&[data-state=open]_.disclosure-chevron]:rotate-90';
export const DISCLOSURE_LABEL =
  'shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 underline-offset-4 group-hover/disclosure:underline dark:text-zinc-100';
export const DISCLOSURE_HINT =
  'hidden min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 sm:inline dark:text-zinc-500';

/** Hairline grid: the container draws the top/left rule, each CELL its bottom/right. */
export const GRID = 'grid border-l border-t border-zinc-200 dark:border-zinc-800';
export const CELL = 'border-b border-r border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80';

export const HAIRLINE = 'border border-zinc-200 dark:border-zinc-800';

export const NOTICE_WARN =
  'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200';

export const NOTICE_ERROR =
  'border border-red-300 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300';

/** shadcn TooltipContent restyled at the usage site: square ink plate, no arrow. */
export const TOOLTIP =
  'rounded-none border border-zinc-900 bg-zinc-900 px-2.5 py-1.5 font-mono text-[11px] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 [&>span>svg]:hidden';

export const FOCUS =
  'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100';

export const BONE = 'animate-pulse bg-zinc-100 dark:bg-zinc-900';
