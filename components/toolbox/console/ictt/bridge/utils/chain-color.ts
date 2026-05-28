/**
 * Deterministic accent color per L1, used to tint Remote tabs / chips.
 * The palette uses Tailwind tone tokens we already import in the bridge UI
 * so that dark-mode equivalents are picked up via the parent container.
 */
const PALETTE = [
  {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-900/60',
  },
  { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-200 dark:ring-sky-900/60' },
  {
    dot: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-200 dark:ring-violet-900/60',
  },
  { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-900/60' },
  {
    dot: 'bg-fuchsia-500',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    ring: 'ring-fuchsia-200 dark:ring-fuchsia-900/60',
  },
  { dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-200 dark:ring-cyan-900/60' },
] as const;

export type ChainAccent = (typeof PALETTE)[number];

function djb2(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function chainAccent(seed: string | number | undefined): ChainAccent {
  const key = typeof seed === 'undefined' ? '' : String(seed);
  if (!key) return PALETTE[0];
  return PALETTE[djb2(key) % PALETTE.length];
}
