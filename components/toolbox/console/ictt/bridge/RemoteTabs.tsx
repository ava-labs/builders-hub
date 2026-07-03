'use client';

import { Plus, X } from 'lucide-react';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import type { Remote } from './types';
import { chainAccent } from './utils/chain-color';

interface RemoteTabsProps {
  remotes: Remote[];
  selectedRemoteId: Remote['id'] | null;
  onSelect: (id: Remote['id']) => void;
  onAddRemote?: () => void;
  onRemoveFromView?: (id: Remote['id']) => void;
  className?: string;
}

export function RemoteTabs({
  remotes,
  selectedRemoteId,
  onSelect,
  onAddRemote,
  onRemoveFromView,
  className,
}: RemoteTabsProps) {
  if (remotes.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl border border-dashed border-emerald-300/60 bg-emerald-50/40 px-3 py-2 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/20',
          className,
        )}
      >
        <span className="text-emerald-800 dark:text-emerald-300">No remotes deployed yet.</span>
        {onAddRemote && (
          <button
            type="button"
            onClick={onAddRemote}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Deploy first remote
          </button>
        )}
      </div>
    );
  }

  if (remotes.length === 1 && !onAddRemote) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Remote chains"
      className={cn('inline-flex items-center gap-1 rounded-lg bg-zinc-100/80 p-1 dark:bg-zinc-800/60', className)}
    >
      {remotes.map((remote) => (
        <RemoteTab
          key={remote.id}
          remote={remote}
          isActive={remote.id === selectedRemoteId}
          onSelect={onSelect}
          onRemoveFromView={onRemoveFromView}
        />
      ))}
      {onAddRemote && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            onClick={onAddRemote}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add remote
          </button>
        </>
      )}
    </div>
  );
}

interface RemoteTabProps {
  remote: Remote;
  isActive: boolean;
  onSelect: (id: Remote['id']) => void;
  onRemoveFromView?: (id: Remote['id']) => void;
}

function RemoteTab({ remote, isActive, onSelect, onRemoveFromView }: RemoteTabProps) {
  const l1 = useL1ByChainId(remote.l1Id) ?? null;
  const accent = chainAccent(remote.l1Id);
  const isReady = Boolean(remote.registeredAt && remote.collateralizedAt);
  const isRegistered = Boolean(remote.registeredAt);

  const dotClass = isReady ? 'bg-emerald-500' : isRegistered ? 'bg-amber-400' : accent.dot;
  const tooltip = isReady
    ? 'Live — registered and collateralized'
    : isRegistered
      ? 'Registered — needs collateral'
      : 'Not registered';

  return (
    <span
      className={cn(
        'group/tab inline-flex items-center gap-0.5 rounded-md text-xs font-medium transition-colors',
        isActive
          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => onSelect(remote.id)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1"
        title={tooltip}
      >
        <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
        <span className="max-w-[120px] truncate">{l1?.name ?? 'Unknown chain'}</span>
      </button>
      {onRemoveFromView && (
        <button
          type="button"
          aria-label={`Remove ${l1?.name ?? 'remote'} from view`}
          onClick={(event) => {
            event.stopPropagation();
            const ok =
              typeof window === 'undefined'
                ? true
                : window.confirm(
                    `Remove ${l1?.name ?? 'this remote'} from the bridge console? This won't change anything on-chain.`,
                  );
            if (ok) onRemoveFromView(remote.id);
          }}
          className="mr-1 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
