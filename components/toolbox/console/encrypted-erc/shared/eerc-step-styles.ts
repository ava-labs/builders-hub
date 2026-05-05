// Shared accent / status maps for the Encrypted ERC step UI.
//
// Both `Overview` (the hub page) and `EERCStepNav` (the strip on every leaf
// tool page) render the same family of step cards. They used to ship two
// near-identical copies of these maps, which drifted whenever one surface
// gained a tweak the other didn't (e.g. a new accent colour). Hoisting to a
// single source keeps the visual language synced and shaves ~50 lines off
// each file.
//
// `Accent` is the per-step icon-tint colour. `StepStatus` is the badge
// that lives in the corner of the step card showing the user's progress
// for the cross-tool journey.
export type Accent = 'emerald' | 'blue' | 'violet' | 'rose' | 'amber';
export type StepStatus = 'done' | 'next' | 'available';

export const ACCENT_BG: Record<Accent, string> = {
  emerald: 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20',
  blue: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20',
  violet: 'group-hover:bg-violet-50 dark:group-hover:bg-violet-900/20',
  rose: 'group-hover:bg-rose-50 dark:group-hover:bg-rose-900/20',
  amber: 'group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20',
};

export const ACCENT_ICON: Record<Accent, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

export const STATUS_STYLES: Record<StepStatus, { label: string; className: string }> = {
  done: {
    label: 'Done',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
  },
  next: {
    label: 'Next',
    className: 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  },
  available: {
    label: 'Ready',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
  },
};
