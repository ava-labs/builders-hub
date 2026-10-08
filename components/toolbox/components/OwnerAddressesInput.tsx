'use client';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';

export type PChainOwner = {
  addresses: string[];
  threshold: number;
};

interface OwnerAddressesInputProps {
  label: string;
  owner: PChainOwner;
  onChange: (owner: PChainOwner) => void;
}

/**
 * The owner after its address list changes. The threshold stays from 1 to the
 * number of addresses, and at 1 with no address: threshold 0 would need no
 * signature, and the signing checks refuse an owner with no address.
 */
export function ownerWithAddresses(owner: PChainOwner, addresses: string[]): PChainOwner {
  const threshold = addresses.length <= 1 ? 1 : owner.threshold;
  return { addresses, threshold: Math.max(1, Math.min(threshold, addresses.length)) };
}

export function OwnerAddressesInput({ label, owner, onChange }: OwnerAddressesInputProps) {
  const updateAddresses = (addresses: string[]) => onChange(ownerWithAddresses(owner, addresses));

  const updateThreshold = (threshold: number) => {
    onChange({
      ...owner,
      threshold: Math.max(1, Math.min(threshold, owner.addresses.length)),
    });
  };

  return (
    <div className="space-y-2">
      <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <div className="space-y-2">
        {owner.addresses.map((address, addrIndex) => (
          <div key={addrIndex} className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                const newAddresses = [...owner.addresses];
                newAddresses[addrIndex] = e.target.value;
                updateAddresses(newAddresses);
              }}
              className={cn(
                'h-10 flex-1 rounded-none px-3',
                'bg-white dark:bg-zinc-950',
                'border border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
                'text-zinc-900 dark:text-zinc-100',
                'transition-colors focus:outline-none',
                'font-mono text-[12px]',
              )}
            />
            <button
              onClick={() => {
                const newAddresses = [...owner.addresses];
                newAddresses.splice(addrIndex, 1);
                updateAddresses(newAddresses);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-zinc-200 text-zinc-400 transition-colors hover:border-red-300 hover:text-red-600 dark:border-zinc-800 dark:hover:border-red-900 dark:hover:text-red-400"
              title="Remove address"
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {owner.addresses.length > 1 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Threshold:
              </span>
              <input
                type="number"
                min="1"
                max={owner.addresses.length}
                value={owner.threshold}
                onChange={(e) => updateThreshold(Number.parseInt(e.target.value) || 1)}
                className={cn(
                  'h-10 w-20 rounded-none px-3 text-[13px]',
                  'bg-white dark:bg-zinc-950',
                  'border border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
                  'text-zinc-900 dark:text-zinc-100',
                  'transition-colors focus:outline-none',
                )}
              />
              <span className="whitespace-nowrap text-[13px] text-zinc-500 dark:text-zinc-400">
                of {owner.addresses.length} addresses
              </span>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
              The threshold determines how many addresses must sign to authorize actions.
            </p>
          </div>
        )}

        <Button
          onClick={() => {
            const newAddresses = [...owner.addresses, ''];
            updateAddresses(newAddresses);
          }}
          variant="secondary"
          className="w-full"
          icon={<Plus className="h-3.5 w-3.5" />}
        >
          Add Address
        </Button>
      </div>
    </div>
  );
}
