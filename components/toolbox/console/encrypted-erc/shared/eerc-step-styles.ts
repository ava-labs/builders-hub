// Shared accent / status maps for the Encrypted ERC step UI.
//
// `Accent` names a step's family; in the hairline design it no longer tints
// surfaces, only the icon ink. `StepStatus` is the user's progress mark on
// the cross-tool journey (shown next to each tab label).
export type Accent = 'emerald' | 'blue' | 'violet' | 'rose' | 'amber';
export type StepStatus = 'done' | 'next' | 'available';

export const ACCENT_BG: Record<Accent, string> = {
  emerald: '',
  blue: '',
  violet: '',
  rose: '',
  amber: '',
};

export const ACCENT_ICON: Record<Accent, string> = {
  emerald: 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50',
  blue: 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50',
  violet: 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50',
  rose: 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50',
  amber: 'text-zinc-500 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-50',
};

export const STATUS_STYLES: Record<StepStatus, { label: string; className: string }> = {
  done: {
    label: 'Done',
    className: 'font-mono uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400',
  },
  next: {
    label: 'Next',
    className: 'font-mono uppercase tracking-[0.14em] text-[#E6212F]',
  },
  available: {
    label: 'Ready',
    className: 'font-mono uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400',
  },
};
