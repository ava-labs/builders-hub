'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Layers } from 'lucide-react';
import { Board, BoardHeader, Rise, SectionHeader } from '@/components/explorer-v2/ui';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';
import { cn } from '@/lib/utils';
import { BONE, BTN_PRIMARY, BTN_SECONDARY, EYEBROW, NOTICE_WARN } from './chrome';

// The page title the empty and error states carry, since there is no hero to name the page.
function PageTitle({ sub }: { sub?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className={EYEBROW}>My L1</p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-50">
        My L1 Dashboard
      </h1>
      {sub && <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

export function EmptyState() {
  const { openModal: openAddChainModal } = useModalTrigger<{ success: boolean }>();

  return (
    <div className="flex flex-col gap-10">
      <Rise>
        <PageTitle sub="Manage and monitor your Layer 1 blockchains" />
      </Rise>
      <Rise delay={0.05} className="flex flex-col gap-4">
        <SectionHeader label="Your L1s" />
        <Board divide={false} className="flex flex-col items-start gap-4 border-x border-t px-5 py-10 md:px-6">
          <p className={cn(EYEBROW, 'flex items-center gap-2')}>
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            No L1s yet
          </p>
          <div className="flex flex-col gap-2">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Ready to launch your first L1?
            </h2>
            <p className="max-w-md text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Provision a managed L1 with the Quick wizard — it spins up a node, ICM, and a token bridge in under 3
              minutes. Or connect an existing L1 by RPC URL.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/console/create-l1" className={cn(BTN_PRIMARY, 'group/create')}>
              Create L1
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/create:translate-x-0.5" />
            </Link>
            <button type="button" onClick={() => openAddChainModal()} className={BTN_SECONDARY}>
              Connect by RPC
            </button>
            <Link
              href="/console"
              className="inline-flex h-9 items-center px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Back to Console
            </Link>
          </div>
        </Board>
      </Rise>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-10">
      <Rise>
        <PageTitle />
      </Rise>
      <Rise delay={0.05}>
        <div className={cn(NOTICE_WARN, 'flex items-start gap-4 p-5')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">
                We couldn&apos;t load your L1s
              </p>
              <p className="mt-1.5 break-words text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                {message}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onRetry} className={BTN_SECONDARY}>
                Retry
              </button>
              <Link href="/api/auth/signin" className={BTN_PRIMARY}>
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </Rise>
    </div>
  );
}

// First-load placeholder in the loaded page's own chrome: the rail's header and chips, then the lead board's
// frame with its identity row and figure strip. Only the data slots pulse.
export function HeaderSkeleton() {
  return (
    <div role="status" aria-label="Loading your L1s" className="flex flex-col gap-4">
      <SectionHeader label="Switch chain" />
      <div className="flex gap-2 px-1 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-10 w-36 items-center gap-2 border border-zinc-200 pl-1.5 dark:border-zinc-800">
            <span className={cn(BONE, 'h-7 w-7')} />
            <span className={cn(BONE, 'h-2.5 w-20')} />
          </div>
        ))}
      </div>
      <Board className="border-x border-t">
        <BoardHeader display label="Selected L1" />
        <div className="flex items-center gap-4 px-5 py-5 md:px-6">
          <span className={cn(BONE, 'h-14 w-14 shrink-0 md:h-16 md:w-16')} />
          <div className="flex flex-col gap-2">
            <span className={cn(BONE, 'h-4 w-24')} />
            <span className={cn(BONE, 'h-7 w-48')} />
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
          {['Balance', 'EVM chain ID'].map((label) => (
            <div key={label} className="flex flex-col gap-2 px-5 py-5 md:px-6">
              <span className={EYEBROW}>{label}</span>
              <span className={cn(BONE, 'h-7 w-32')} />
            </div>
          ))}
        </div>
      </Board>
    </div>
  );
}
