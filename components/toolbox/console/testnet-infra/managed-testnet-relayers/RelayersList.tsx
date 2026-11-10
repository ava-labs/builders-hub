'use client';

import { Loader2, Plus, Radio } from 'lucide-react';
import { Board, BoardHeader, Rise, RowSkeleton } from '@/components/explorer-v2/ui';
import { Relayer } from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/types';
import RelayerCard from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/RelayerCard';
import { BTN_PRIMARY, HoverArrow, Notice } from './ui';

interface RelayersListProps {
  relayers: Relayer[];
  isLoadingRelayers: boolean;
  relayersError: string | null;
  onRefresh: () => void;
  onShowCreateForm: () => void;
  onDeleteRelayer: (relayer: Relayer) => void;
  onRestartRelayer: (relayer: Relayer) => void;
  deletingRelayers: Set<string>;
  restartingRelayers: Set<string>;
}

export default function RelayersList({
  relayers,
  isLoadingRelayers,
  relayersError,
  onRefresh,
  onShowCreateForm,
  onDeleteRelayer,
  onRestartRelayer,
  deletingRelayers,
  restartingRelayers,
}: RelayersListProps) {
  if (isLoadingRelayers) {
    return (
      <div role="status" aria-label="Loading relayers">
        <Board className="border-x border-t">
          <BoardHeader
            label="Fetching your relayers"
            action={<Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" aria-hidden />}
          />
          <RowSkeleton n={3} />
        </Board>
      </div>
    );
  }

  if (relayers.length === 0) {
    return (
      <Board divide={false} className="flex flex-col items-start gap-3 border-x border-t px-5 py-8 md:px-6">
        <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          <Radio className="h-3.5 w-3.5" />
          No relayers
        </p>
        <p className="max-w-xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          A relayer carries ICM messages between your chains. It&apos;s free on Fuji and runs for 3 days.
        </p>
        <button type="button" onClick={onShowCreateForm} className={`${BTN_PRIMARY} mt-2`}>
          <Plus className="h-3.5 w-3.5" />
          Set up your first relayer
          <HoverArrow />
        </button>
      </Board>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {relayersError && (
        <Notice tone="error">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">Couldn&apos;t load relayers</p>
          <p className="mt-1">{relayersError}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] underline underline-offset-4 hover:no-underline"
          >
            Try again
          </button>
        </Notice>
      )}

      {relayers.map((relayer, i) => (
        <Rise key={relayer.relayerId} delay={Math.min(i * 0.04, 0.2)}>
          <RelayerCard
            relayer={relayer}
            onDeleteRelayer={onDeleteRelayer}
            onRestartRelayer={onRestartRelayer}
            isDeletingRelayer={deletingRelayers.has(relayer.relayerId)}
            isRestartingRelayer={restartingRelayers.has(relayer.relayerId)}
          />
        </Rise>
      ))}
    </div>
  );
}
