/** The console top bar's controls: square, hairline-bordered, one height, so they read as one strip. */
export const HEADER_CHIP =
  'inline-flex h-8 shrink-0 items-center gap-2 border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-900 transition-colors hover:border-zinc-400 data-[state=open]:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-600 dark:data-[state=open]:border-zinc-100';

/** A balance or other figure inside a chip. Phones show only the chain logo, so the whole bar fits. */
export const HEADER_FIGURE = 'font-mono text-[11.5px] tabular-nums text-zinc-500 max-sm:hidden dark:text-zinc-400';

/** The one filled control: connect a wallet. */
export const HEADER_PRIMARY =
  'inline-flex h-8 shrink-0 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300';
