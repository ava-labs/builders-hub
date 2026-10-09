import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'warning' | 'info' | 'success';
  className?: string;
  icon?: boolean;
}

const VARIANTS = {
  error: {
    container: 'border-red-200 bg-red-50/60 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',
    Icon: AlertCircle,
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    container:
      'border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200',
    Icon: AlertTriangle,
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    container:
      'border-zinc-200 bg-zinc-50/60 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300',
    Icon: Info,
    icon: 'text-zinc-500 dark:text-zinc-400',
  },
  success: {
    container:
      'border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200',
    Icon: CheckCircle2,
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
} as const;

export const Alert = ({ children, variant = 'info', className, icon = true }: AlertProps) => {
  const { container, Icon, icon: iconClass } = VARIANTS[variant];

  return (
    <div className={cn('max-h-48 overflow-y-auto border px-4 py-3 text-[13px] leading-relaxed', container, className)}>
      <div className="flex items-start gap-3">
        {icon && <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} />}
        <div className="min-w-0 flex-1 break-words">{children}</div>
      </div>
    </div>
  );
};
