import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plus } from 'lucide-react';
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { NetworkMenuItem } from './NetworkMenuItem';

interface NetworkListProps {
  availableNetworks: L1ListItem[];
  getNetworkBalance: (network: L1ListItem) => number | string | null;
  isNetworkActive: (network: L1ListItem) => boolean;
  onNetworkSelect: (network: L1ListItem) => void;
  onNetworkRemove?: (network: L1ListItem) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

/** The network picker: a header with the edit toggle, the networks, and Add network. */
export function NetworkList({
  availableNetworks,
  getNetworkBalance,
  isNetworkActive,
  onNetworkSelect,
  onNetworkRemove,
  isEditMode,
  onToggleEditMode,
}: NetworkListProps) {
  const { addChain } = useWallet();
  return (
    <>
      <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Networks</span>
        <button
          type="button"
          onClick={onToggleEditMode}
          className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {isEditMode ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {availableNetworks.map((network) => (
          <NetworkMenuItem
            key={network.id}
            network={network}
            isActive={isNetworkActive(network)}
            onSelect={onNetworkSelect}
            isEditMode={isEditMode}
            onRemove={onNetworkRemove}
            balance={getNetworkBalance(network)}
          />
        ))}
      </div>

      {!isEditMode && (
        <DropdownMenuItem
          onSelect={() => addChain()}
          className="cursor-pointer gap-2.5 px-2 py-1.5 text-muted-foreground"
        >
          <span className="flex h-5 w-5 items-center justify-center">
            <Plus className="h-3.5 w-3.5" />
          </span>
          Add network
        </DropdownMenuItem>
      )}
    </>
  );
}
