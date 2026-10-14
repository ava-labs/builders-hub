'use client';

import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '../lib/utils';

interface LockedContentProps {
  isUnlocked: boolean;
  lockedMessage?: string;
  children: ReactNode;
  className?: string;
}

export function LockedContent({
  isUnlocked,
  lockedMessage = 'Complete the prerequisites above to unlock this section',
  children,
  className,
}: LockedContentProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Content (dimmed when locked) */}
      <div
        className={cn('transition-opacity duration-300', !isUnlocked && 'pointer-events-none select-none opacity-30')}
      >
        {children}
      </div>

      {/* Lock overlay */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 p-4 dark:bg-zinc-950/50">
          <div className="flex max-w-sm items-start gap-3 border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Locked
              </p>
              <p className="text-[13px] leading-relaxed text-zinc-900 dark:text-zinc-50">{lockedMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
