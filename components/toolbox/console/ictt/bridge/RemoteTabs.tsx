'use client';

import { Plus, X } from 'lucide-react';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import type { Remote } from './types';
import { Dot, Empty, TextAction, type Tone } from './ui';

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
      <Empty
        eyebrow="Remotes"
        className={className}
        action={
          onAddRemote && (
            <TextAction icon={Plus} onClick={onAddRemote}>
              Deploy first remote
            </TextAction>
          )
        }
      >
        No remotes deployed yet.
      </Empty>
    );
  }

  if (remotes.length === 1 && !onAddRemote) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Remote chains"
      className={cn(
        'flex items-center gap-5 overflow-x-auto border-b border-zinc-200 [scrollbar-width:none] dark:border-zinc-800',
        className,
      )}
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
        <button
          type="button"
          onClick={onAddRemote}
          className="-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add remote
        </button>
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
  const isReady = Boolean(remote.registeredAt && remote.collateralizedAt);
  const isRegistered = Boolean(remote.registeredAt);

  const tone: Tone = isReady ? 'ok' : isRegistered ? 'pending' : 'idle';
  const tooltip = isReady
    ? 'Live: registered and collateralized'
    : isRegistered
      ? 'Registered: needs collateral'
      : 'Not registered';

  return (
    <span
      className={cn(
        'group/tab -mb-px inline-flex shrink-0 items-center gap-1 border-b-2 pb-2.5 transition-colors',
        isActive ? 'border-[#E6212F]' : 'border-transparent',
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => onSelect(remote.id)}
        className={cn(
          'inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors',
          isActive
            ? 'text-zinc-900 dark:text-zinc-50'
            : 'text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100',
        )}
        title={tooltip}
      >
        <Dot tone={tone} />
        <span className="max-w-[140px] truncate">{l1?.name ?? 'Unknown chain'}</span>
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
          className="p-0.5 text-zinc-400 opacity-0 transition-opacity group-hover/tab:opacity-100 hover:text-[#E6212F] focus:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
