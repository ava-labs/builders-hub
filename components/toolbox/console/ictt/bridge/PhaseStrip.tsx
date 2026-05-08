'use client';

import { useEffect, useRef } from 'react';
import { Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BRIDGE_PHASE_ORDER, PHASE_LABEL, PHASE_DESCRIPTION, type BridgePhase, type BridgeStatus } from './types';

interface PhaseStripProps {
  activePhase: BridgePhase;
  phaseStatus: Record<BridgePhase, BridgeStatus>;
  highestReachablePhase: BridgePhase;
  onSelect: (phase: BridgePhase) => void;
  className?: string;
}

const STATUS_TONE: Record<BridgeStatus, string> = {
  idle: 'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
  'in-progress': 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200',
  complete:
    'border-emerald-300 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  error: 'border-red-300 text-red-600 dark:border-red-900/60 dark:text-red-300',
};

export function PhaseStrip({ activePhase, phaseStatus, highestReachablePhase, onSelect, className }: PhaseStripProps) {
  const reachableIndex = BRIDGE_PHASE_ORDER.indexOf(highestReachablePhase);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activePhase]);

  return (
    <ol
      role="tablist"
      aria-label="ICTT setup phases"
      className={cn(
        'flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1',
        '-mx-2 scroll-px-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {BRIDGE_PHASE_ORDER.map((phase, index) => {
        const status = phaseStatus[phase];
        const isActive = phase === activePhase;
        const isLocked = index > reachableIndex && status !== 'complete';
        const isDone = status === 'complete';

        return (
          <li key={phase} className="flex shrink-0 items-center gap-1.5">
            <motion.button
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'step' : undefined}
              tabIndex={isActive ? 0 : -1}
              disabled={isLocked}
              onClick={() => !isLocked && onSelect(phase)}
              title={PHASE_DESCRIPTION[phase]}
              className={cn(
                'relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:focus-visible:ring-zinc-100/20',
                isActive && 'border-zinc-900 text-white dark:border-zinc-100 dark:text-zinc-900',
                !isActive && STATUS_TONE[status],
                isLocked && 'cursor-not-allowed opacity-60',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="ictt-active-pill"
                  className="absolute inset-0 -z-10 rounded-full bg-zinc-900 dark:bg-zinc-100"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  isActive && 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100',
                  !isActive && isDone && 'bg-emerald-500 text-white',
                  !isActive && !isDone && 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                )}
                aria-hidden
              >
                {isDone ? <Check className="h-3 w-3" /> : isLocked ? <Lock className="h-3 w-3" /> : index + 1}
              </span>
              <span>{PHASE_LABEL[phase]}</span>
            </motion.button>
            {index < BRIDGE_PHASE_ORDER.length - 1 && (
              <span
                aria-hidden
                className={cn('h-px w-5 transition-colors', isDone ? 'bg-emerald-300' : 'bg-zinc-200 dark:bg-zinc-800')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
