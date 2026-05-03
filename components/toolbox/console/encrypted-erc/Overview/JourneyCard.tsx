'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronRight, Key, Send, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { boardItem } from '@/components/console/motion';
import { TileShell } from './TileShell';

/**
 * Five-step progress tracker. Each step's "done" status is derived from
 * real on-chain reads (registration query + decrypted balance) by the
 * parent Overview, then handed in here as a `Set<string>`. The card
 * stays presentational — adding a new step is a single line in the
 * `steps` array, no hook plumbing.
 *
 * The list pulls double duty: the next-up step is a quick link to the
 * tool that completes it, and finished steps are struck-through so the
 * whole card reads at-a-glance from anywhere on the page.
 */
interface JourneyCardProps {
  stepsDone: Set<string>;
  className?: string;
}

const STEPS = [
  { key: 'connect', label: 'Connect wallet', href: null, icon: null },
  { key: 'register', label: 'Register BJJ identity', href: '/console/encrypted-erc/register', icon: Key },
  { key: 'deposit', label: 'Deposit & encrypt', href: '/console/encrypted-erc/deposit', icon: ArrowDownToLine },
  { key: 'transfer', label: 'Private transfer', href: '/console/encrypted-erc/transfer', icon: Send },
  { key: 'withdraw', label: 'Withdraw & decrypt', href: '/console/encrypted-erc/withdraw', icon: ArrowUpFromLine },
] as const;

export function JourneyCard({ stepsDone, className }: JourneyCardProps) {
  const doneCount = STEPS.filter((s) => stepsDone.has(s.key)).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  return (
    <motion.div className={className} variants={boardItem}>
      <TileShell>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500 twinkle-a" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your journey on Fuji</h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            {doneCount}/{STEPS.length} · {pct}%
          </span>
        </div>

        <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="space-y-1.5">
          {STEPS.map((s, i) => {
            const done = stepsDone.has(s.key);
            const nextUp = !done && i === doneCount;
            const Icon = s.icon;
            const content = (
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors',
                  s.href ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer' : '',
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0',
                    done
                      ? 'bg-emerald-500 text-white'
                      : nextUp
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500',
                  )}
                >
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-sm flex-1',
                    done
                      ? 'text-zinc-500 dark:text-zinc-500 line-through'
                      : nextUp
                        ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {s.label}
                </span>
                {Icon && !done && (
                  <Icon
                    className={cn(
                      'w-3.5 h-3.5 shrink-0',
                      nextUp ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-700',
                    )}
                  />
                )}
                {s.href && !done && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-zinc-300 dark:text-zinc-700" />}
              </div>
            );
            return <li key={s.key}>{s.href ? <Link href={s.href}>{content}</Link> : content}</li>;
          })}
        </ol>
      </TileShell>
    </motion.div>
  );
}
