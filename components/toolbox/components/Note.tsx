import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface NoteProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'destructive' | 'warning';
  className?: string;
}

type VariantStyle = {
  container: string;
  accent: string;
  Icon: LucideIcon;
};

/**
 * Neutral container with a colored accent icon. Previously this was a
 * left-border + solid colored background (docs-site style) which read
 * as loud next to the quieter console UI; the icon-only accent carries
 * the semantic signal without the heavy fill.
 */
const VARIANTS: Record<NonNullable<NoteProps['variant']>, VariantStyle> = {
  default: {
    container: 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50',
    accent: 'text-zinc-500 dark:text-zinc-400',
    Icon: Info,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  destructive: {
    container: 'border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20',
    accent: 'text-red-600 dark:text-red-400',
    Icon: AlertCircle,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20',
    accent: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
};

export const Note = ({ children, variant = 'default', className }: NoteProps) => {
  const { container, accent, Icon } = VARIANTS[variant];

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 my-4', container, className)}>
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', accent)} />
      <div className="flex-1 min-w-0 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
};
