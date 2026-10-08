'use client';

import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { Board, BoardHeader } from '@/components/explorer-v2/ui';
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { BTN_PRIMARY, ChainPicker, EYEBROW, HoverArrow, Notice, SelectionSummary } from './ui';
import { RelayerConfig } from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/types';

interface CreateRelayerFormProps {
  onClose: () => void;
  onSubmit: (configs: RelayerConfig[]) => void;
  l1List: L1ListItem[];
  isCreating: boolean;
}

export default function CreateRelayerForm({ onClose, onSubmit, l1List, isCreating }: CreateRelayerFormProps) {
  // Initialize with first chain as both source and destination if available
  const [selectedSources, setSelectedSources] = useState<string[]>(() => {
    return l1List.length > 0 ? [l1List[0].id] : [];
  });
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(() => {
    return l1List.length > 0 ? [l1List[0].id] : [];
  });
  const [error, setError] = useState<string | null>(null);

  // Validate selections whenever they change
  useEffect(() => {
    if (selectedSources.length === 0 || selectedDestinations.length === 0) {
      setError('You must select at least one source and one destination network');
      return;
    }

    if (
      selectedSources.length === 1 &&
      selectedDestinations.length === 1 &&
      selectedSources[0] === selectedDestinations[0]
    ) {
      setError('Source and destination cannot be the same network when selecting one each');
      return;
    }

    setError(null);
  }, [selectedSources, selectedDestinations]);

  const handleToggleSource = (l1Id: string) => {
    setSelectedSources((prev) => (prev.includes(l1Id) ? prev.filter((id) => id !== l1Id) : [...prev, l1Id]));
  };

  const handleToggleDestination = (l1Id: string) => {
    setSelectedDestinations((prev) => (prev.includes(l1Id) ? prev.filter((id) => id !== l1Id) : [...prev, l1Id]));
  };

  const handleCreateRelayer = () => {
    if (error) {
      return;
    }

    // Get unique chains from both sources and destinations
    const allChainIds = [...new Set([...selectedSources, ...selectedDestinations])];

    const configs: RelayerConfig[] = l1List
      .filter((l1: L1ListItem) => allChainIds.includes(l1.id))
      .map((l1: L1ListItem) => ({
        subnetId: l1.subnetId,
        blockchainId: l1.id,
        rpcUrl: l1.rpcUrl,
        wsUrl: l1.rpcUrl.replace('http', 'ws').replace('/rpc', '/ws'),
      }));

    onSubmit(configs);
  };

  return (
    <Board className="border-x border-t">
      <BoardHeader
        label="New relayer"
        display
        action={
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="-m-1.5 inline-flex items-center gap-1.5 p-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-5">
        <p className="text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Pick the chains to watch and the chains to deliver to. The relayer gets one address, funded on each chain.
        </p>
        {error && l1List.length > 0 && <Notice tone="error">{error}</Notice>}
        <ChainPicker
          l1List={l1List}
          sources={selectedSources}
          destinations={selectedDestinations}
          onToggleSource={handleToggleSource}
          onToggleDestination={handleToggleDestination}
        />
      </div>

      {l1List.length > 0 && (
        <div>
          <div className="px-5 pt-4">
            <p className={EYEBROW}>Summary</p>
          </div>
          <SelectionSummary l1List={l1List} sources={selectedSources} destinations={selectedDestinations} />
        </div>
      )}

      <div className="flex justify-end px-5 py-4">
        <button
          type="button"
          onClick={handleCreateRelayer}
          disabled={!!error || l1List.length === 0 || isCreating}
          className={BTN_PRIMARY}
        >
          {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isCreating ? 'Creating' : 'Create relayer'}
          <HoverArrow />
        </button>
      </div>
    </Board>
  );
}
