import { useState, useId } from 'react';
import { useCreateChainStore } from '../stores/createChainStore';
import { useL1ListStore } from '../stores/l1ListStore';
import { useMemo } from 'react';
import { cn } from '../lib/utils';
import { Check, ChevronDown, Globe } from 'lucide-react';

interface BlockchainOption {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
}

export default function SelectBlockchainId({
  value,
  onChange,
  error,
  label = 'Select Avalanche Blockchain ID',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  label?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const createChainStorechainID = useCreateChainStore()((state) => state.chainID);
  const { l1List } = useL1ListStore()();
  const selectId = useId();

  const options: BlockchainOption[] = useMemo(() => {
    const result: BlockchainOption[] = [];

    if (createChainStorechainID) {
      result.push({
        id: createChainStorechainID,
        name: createChainStorechainID,
        description: 'From the "Create Chain" tool',
      });
    }

    for (const l1 of l1List) {
      result.push({
        id: l1.id,
        name: `${l1.name} (${l1.id})`,
        description: 'From your chain list',
        logoUrl: l1.logoUrl,
      });
    }

    return result;
  }, [createChainStorechainID, l1List]);

  const selectedOption = options.find((option) => option.id === value);

  return (
    <div className="mb-6 space-y-2">
      <label
        htmlFor={selectId}
        className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
      >
        {label}
      </label>

      <div className="relative">
        <button
          id={selectId}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex min-h-10 w-full items-center justify-between gap-2 rounded-none px-3 py-2 text-left text-[13px]',
            'bg-white dark:bg-zinc-950',
            'border',
            error
              ? 'border-red-500 focus:border-red-600 dark:border-red-700'
              : isOpen
                ? 'border-zinc-900 dark:border-zinc-300'
                : 'border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
            'text-zinc-900 dark:text-zinc-100',
            'transition-colors',
            'focus:outline-none',
            disabled &&
              'cursor-not-allowed bg-zinc-50 text-zinc-500 hover:border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-800',
          )}
        >
          {selectedOption ? (
            <div className="flex min-w-0 items-center gap-2">
              {selectedOption.logoUrl && (
                <div className="flex h-7 items-center">
                  <img
                    src={selectedOption.logoUrl}
                    alt={`${selectedOption.name} logo`}
                    className="block h-7 w-7 rounded-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="mb-0.5 truncate font-medium">{selectedOption.name}</div>
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{selectedOption.description}</div>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400 dark:text-zinc-600">Select a blockchain ID</div>
          )}
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-px max-h-60 w-full overflow-auto border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {options.map((option) => {
                const isSelected = option.id === value;
                return (
                  <div
                    key={option.id}
                    className={cn(
                      'group/opt relative flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors',
                      'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-colors',
                      isSelected
                        ? 'before:bg-zinc-900 dark:before:bg-zinc-100'
                        : 'hover:before:bg-zinc-300 dark:hover:before:bg-zinc-600',
                    )}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {option.logoUrl ? (
                        <div className="flex h-7 items-center">
                          <img
                            src={option.logoUrl}
                            alt={`${option.name} logo`}
                            className="block h-7 w-7 rounded-full object-cover"
                          />
                        </div>
                      ) : (
                        <Globe className="h-7 w-7 shrink-0 p-1 text-zinc-400 dark:text-zinc-500" />
                      )}
                      <div className="min-w-0">
                        <div className="mb-0.5 truncate text-[13px] font-medium text-zinc-900 underline-offset-4 group-hover/opt:underline dark:text-zinc-100">
                          {option.name}
                        </div>
                        <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{option.description}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-zinc-900 dark:text-zinc-100" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[12px] text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
