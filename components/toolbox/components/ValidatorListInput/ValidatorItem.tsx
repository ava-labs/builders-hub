'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import { OwnerAddressesInput, type PChainOwner } from '../OwnerAddressesInput';
import type { ConvertToL1Validator } from '../ValidatorListInput';

interface Props {
  index: number;
  validator: ConvertToL1Validator;
  isExpanded: boolean;
  onToggle: (index: number) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updated: Partial<ConvertToL1Validator>) => void;
  l1TotalInitializedWeight?: bigint | null;
  userPChainBalanceNavax?: bigint | null;
  hideConsensusWeight?: boolean;
}

export function ValidatorItem({
  index,
  validator,
  isExpanded,
  onToggle,
  onRemove,
  onUpdate,
  l1TotalInitializedWeight = null,
  userPChainBalanceNavax = null,
  hideConsensusWeight = false,
}: Props) {
  let insufficientBalanceError: string | null = null;
  if (userPChainBalanceNavax !== null && validator.validatorBalance > userPChainBalanceNavax) {
    insufficientBalanceError = `Validator balance (${(Number(validator.validatorBalance) / 1e9).toFixed(2)} AVAX) exceeds your P-Chain balance (${(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX).`;
  }

  const hasWeightError =
    l1TotalInitializedWeight &&
    l1TotalInitializedWeight > 0n &&
    validator.validatorWeight > 0n &&
    (validator.validatorWeight * 100n) / l1TotalInitializedWeight >= 20n;

  const hasError = !!insufficientBalanceError || !!hasWeightError;

  return (
    <div
      className={cn(
        'overflow-hidden border bg-white transition-colors dark:bg-zinc-950',
        hasError
          ? 'border-red-300 dark:border-red-900'
          : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600',
      )}
    >
      <div
        className={cn(
          'group/row flex cursor-pointer items-center justify-between p-3 transition-colors',
          hasError && 'bg-red-50/60 dark:bg-red-950/20',
        )}
        onClick={() => onToggle(index)}
      >
        <div className="flex-1 truncate font-mono text-[12px] text-zinc-900 underline-offset-4 group-hover/row:underline dark:text-zinc-100">
          {validator.nodeID}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="p-1 text-zinc-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
            title="Remove validator"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/row:text-[#E6212F]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover/row:text-[#E6212F]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="space-y-2">
            <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Node ID (must be unique)
            </label>
            <input
              type="text"
              value={validator.nodeID}
              onChange={(e) => onUpdate(index, { nodeID: e.target.value })}
              className={cn(
                'h-10 w-full rounded-none px-3',
                'bg-white dark:bg-zinc-950',
                'border border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
                'text-zinc-900 dark:text-zinc-100',
                'transition-colors focus:outline-none',
                'font-mono text-[12px]',
              )}
            />
          </div>

          <div className={cn('grid gap-3', hideConsensusWeight ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
            {!hideConsensusWeight && (
              <div className="space-y-2">
                <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Consensus Weight
                </label>
                <input
                  type="number"
                  value={validator.validatorWeight.toString()}
                  onChange={(e) => onUpdate(index, { validatorWeight: BigInt(e.target.value || 0) })}
                  className={cn(
                    'h-10 w-full rounded-none px-3 text-[13px]',
                    'bg-white dark:bg-zinc-950',
                    'border border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
                    'text-zinc-900 dark:text-zinc-100',
                    'transition-colors focus:outline-none',
                  )}
                />
                {hasWeightError && (
                  <p className="text-[12px] text-red-700 dark:text-red-400">
                    Warning: This validator's weight is 20% or more of the current L1 total stake (
                    {Number((validator.validatorWeight * 10000n) / l1TotalInitializedWeight / 100n).toFixed(2)}%).
                    Recommended to be less than 20%.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Validator Balance (P-Chain AVAX)
              </label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={Number(validator.validatorBalance) / 1000000000}
                onChange={(e) =>
                  onUpdate(index, {
                    validatorBalance: BigInt(Math.round(parseFloat(e.target.value || '0') * 1000000000)),
                  })
                }
                className={cn(
                  'h-10 w-full rounded-none border bg-white px-3 text-[13px] dark:bg-zinc-950',
                  insufficientBalanceError
                    ? 'border-red-500 focus:border-red-600 dark:border-red-700'
                    : 'border-zinc-200 hover:border-zinc-400 focus:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus:border-zinc-300',
                  'text-zinc-900 dark:text-zinc-100',
                  'transition-colors focus:outline-none',
                )}
              />
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                Will last for {getBalanceDurationEstimate(Number(validator.validatorBalance) / 1000000000)} with a fee
                of 1.33 AVAX per month.
              </p>
              {insufficientBalanceError && (
                <p className="text-[12px] text-red-700 dark:text-red-400">{insufficientBalanceError}</p>
              )}
            </div>
          </div>

          <OwnerAddressesInput
            label="Remaining Balance Owner Addresses"
            owner={validator.remainingBalanceOwner}
            onChange={(owner: PChainOwner) => onUpdate(index, { remainingBalanceOwner: owner })}
          />
          <OwnerAddressesInput
            label="Deactivation Owner Addresses"
            owner={validator.deactivationOwner}
            onChange={(owner: PChainOwner) => onUpdate(index, { deactivationOwner: owner })}
          />
        </div>
      )}
    </div>
  );
}

function getBalanceDurationEstimate(balance: number): string {
  const feePerSecond = 0.000000512;
  const seconds = balance / feePerSecond;

  const oneHour = 3600;
  const oneDay = 86400;
  const oneMonth = oneDay * 30;
  const oneYear = oneDay * 365;

  if (seconds < oneHour) return 'less than 1 hour';
  if (seconds < oneDay) {
    const hours = Math.round(seconds / oneHour);
    return hours === 1 ? 'roughly 1 hour' : `roughly ${hours} hours`;
  }
  if (seconds < oneMonth) {
    const days = Math.round(seconds / oneDay);
    return days === 1 ? 'roughly 1 day' : `roughly ${days} days`;
  }
  if (seconds < oneYear) {
    const months = Math.round(seconds / oneMonth);
    return months === 1 ? 'roughly 1 month' : `roughly ${months} months`;
  }
  return 'more than 1 year';
}
