'use client';

import { ReactNode } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { cn } from '../lib/utils';

export type AcknowledgementCalloutType = 'info' | 'warn' | 'error';

interface AcknowledgementCalloutProps {
  title?: string;
  children: ReactNode;
  checkboxLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  type?: AcknowledgementCalloutType;
  visible?: boolean;
  className?: string;
}

const typeStyles = {
  info: {
    container:
      'border-zinc-300 bg-zinc-50/60 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300',
    Icon: Info,
    icon: 'text-zinc-500 dark:text-zinc-400',
    divider: 'border-zinc-200 dark:border-zinc-800',
    eyebrow: 'text-zinc-500 dark:text-zinc-400',
  },
  warn: {
    container:
      'border-amber-300 bg-amber-50/60 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200',
    Icon: AlertTriangle,
    icon: 'text-amber-600 dark:text-amber-400',
    divider: 'border-amber-200 dark:border-amber-900/60',
    eyebrow: 'text-amber-700 dark:text-amber-400',
  },
  error: {
    container: 'border-red-300 bg-red-50/60 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300',
    Icon: XCircle,
    icon: 'text-red-600 dark:text-red-400',
    divider: 'border-red-200 dark:border-red-900/60',
    eyebrow: 'text-red-700 dark:text-red-400',
  },
};

export function AcknowledgementCallout({
  title,
  children,
  checkboxLabel,
  checked,
  onCheckedChange,
  type = 'warn',
  visible = true,
  className,
}: AcknowledgementCalloutProps) {
  if (!visible) return null;

  const styles = typeStyles[type];
  const Icon = styles.Icon;

  return (
    <div className={cn('mb-6', className)}>
      <div className={cn('border px-4 py-3', styles.container)}>
        <div className="flex items-start gap-3">
          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} />
          <div className="min-w-0 flex-1">
            {title && (
              <p className={cn('mb-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]', styles.eyebrow)}>
                {title}
              </p>
            )}
            <div className="text-[13px] leading-relaxed">{children}</div>
          </div>
        </div>

        {/* Acknowledgement section */}
        <div className={cn('mt-3 border-t pt-3', styles.divider)}>
          <div className="border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
            <Checkbox label={checkboxLabel} checked={checked} onChange={onCheckedChange} className="mb-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
