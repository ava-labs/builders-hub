'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES = [
  { id: 'token', label: 'Token', description: 'Source token on Home chain' },
  { id: 'home', label: 'Home', description: 'TokenHome contract' },
  { id: 'remote', label: 'Remote', description: 'TokenRemote on destination' },
  { id: 'register', label: 'Register', description: 'Pair Remote ↔ Home' },
  { id: 'collateral', label: 'Collateral', description: 'Fund the bridge' },
  { id: 'live', label: 'Live', description: 'Send tokens cross-chain' },
] as const;

interface BridgeShellProps {
  initialPhase?: string;
  initialRemote?: string;
}

export function BridgeShell({ initialPhase }: BridgeShellProps) {
  const activePhaseId = PHASES.find((p) => p.id === initialPhase)?.id ?? 'token';

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-400">
          <Sparkles className="h-3.5 w-3.5" />
          ICTT Bridge Console
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Bridge tokens across Avalanche L1s</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          A unified six-phase flow to deploy a TokenHome on the origin chain, mirror it as a TokenRemote on a
          destination L1, register the pair over Interchain Messaging, fund collateral, and start sending tokens.
        </p>
      </header>

      <PhaseStripPreview activePhaseId={activePhaseId} />

      <div
        role="status"
        className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          The new bridge console is on its way.
        </h2>
        <p className="mx-auto max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;re assembling a single-page experience for the {PHASES.length} phases above — persistent chain panels,
          live ICM activity, and multi-remote support. While we ship the new flow, you can keep using the existing
          step-by-step wizard.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/console/ictt/legacy/setup"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Open legacy setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/console/ictt/legacy/token-transfer/test-send"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Open legacy test send
          </Link>
        </div>
      </div>
    </section>
  );
}

interface PhaseStripPreviewProps {
  activePhaseId: (typeof PHASES)[number]['id'];
}

function PhaseStripPreview({ activePhaseId }: PhaseStripPreviewProps) {
  const activeIndex = PHASES.findIndex((p) => p.id === activePhaseId);

  return (
    <ol
      aria-label="ICTT setup phases (preview)"
      className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1"
    >
      {PHASES.map((phase, index) => {
        const isActive = index === activeIndex;
        const isDone = index < activeIndex;
        return (
          <li key={phase.id} className="flex shrink-0 items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                isActive &&
                  'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900',
                isDone &&
                  'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
                !isActive && !isDone && 'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  isActive && 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100',
                  isDone && 'bg-emerald-500 text-white',
                  !isActive && !isDone && 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                )}
              >
                {index + 1}
              </span>
              <span className="font-medium">{phase.label}</span>
            </div>
            {index < PHASES.length - 1 && <span className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
