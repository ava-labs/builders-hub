"use client"

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { cn } from "../utils"
import { OwnerAddressesInput, type PChainOwner } from "../OwnerAddressesInput"
import type { ConvertToL1Validator } from "../ValidatorListInput"

interface Props {
  index: number
  validator: ConvertToL1Validator
  isExpanded: boolean
  onToggle: (index: number) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, updated: Partial<ConvertToL1Validator>) => void
  l1TotalInitializedWeight?: bigint | null
  userPChainBalanceNavax?: bigint | null
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
}: Props) {

  let insufficientBalanceError: string | null = null
  if (userPChainBalanceNavax !== null && validator.validatorBalance > userPChainBalanceNavax) {
    insufficientBalanceError = `Validator balance (${(Number(validator.validatorBalance) / 1e9).toFixed(2)} AVAX) exceeds your P-Chain balance (${(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX).`
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm hover:shadow transition-shadow duration-200">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
        onClick={() => onToggle(index)}
      >
        <div className="flex-1 font-mono text-sm truncate">{validator.nodeID}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove(index)
            }}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors text-red-500"
            title="Remove validator"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Node ID (must be unique)
            </label>
            <input
              type="text"
              value={validator.nodeID}
              onChange={(e) => onUpdate(index, { nodeID: e.target.value })}
              className={cn(
                "w-full rounded p-2",
                "bg-zinc-50 dark:bg-zinc-900",
                "border border-zinc-200 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "shadow-sm focus:ring focus:ring-primary/30 focus:ring-opacity-50",
                "font-mono text-sm",
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Consensus Weight
              </label>
              <input
                type="number"
                value={validator.validatorWeight.toString()}
                onChange={(e) => onUpdate(index, { validatorWeight: BigInt(e.target.value || 0) })}
                className={cn(
                  "w-full rounded p-2",
                  "bg-zinc-50 dark:bg-zinc-900",
                  "border border-zinc-200 dark:border-zinc-700",
                  "text-zinc-900 dark:text-zinc-100",
                  "shadow-sm focus:ring focus:ring-primary/30 focus:ring-opacity-50",
                )}
              />
              {l1TotalInitializedWeight && l1TotalInitializedWeight > 0n && validator.validatorWeight > 0n &&
               (validator.validatorWeight * 100n / l1TotalInitializedWeight) >= 20n && (
                <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                  Warning: This validator's weight is 20% or more of the current L1 total stake ({ Number(validator.validatorWeight * 10000n / l1TotalInitializedWeight / 100n).toFixed(2) }%). Recommended to be less than 20%.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Validator Balance (AVAX)
              </label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={Number(validator.validatorBalance) / 1000000000}
                onChange={(e) => onUpdate(index, { validatorBalance: BigInt(parseFloat(e.target.value || "0") * 1000000000) })}
                className={cn(
                  "w-full rounded p-2",
                  "bg-zinc-50 dark:bg-zinc-900",
                  "border border-zinc-200 dark:border-zinc-700",
                  (insufficientBalanceError ? "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500/30" : "focus:ring-primary/30 focus:border-primary"),
                  "text-zinc-900 dark:text-zinc-100",
                  "shadow-sm focus:ring focus:ring-opacity-50",
                )}
              />
              <p className="text-xs mt-0 mb-0 text-zinc-500 dark:text-zinc-400">
                Will last for {getBalanceDurationEstimate(Number(validator.validatorBalance) / 1000000000)} with a fee of 1.33 AVAX per month.
              </p>
              {insufficientBalanceError && (
                <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                  {insufficientBalanceError}
                </p>
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
  )
}

function getBalanceDurationEstimate(balance: number): string {
  const feePerSecond = 0.000000512;
  const seconds = balance / feePerSecond;

  const oneHour = 3600;
  const oneDay = 86400;
  const oneMonth = oneDay * 30;
  const oneYear = oneDay * 365;

  if (seconds < oneHour) return "less than 1 hour";
  if (seconds < oneDay) {
    const hours = Math.round(seconds / oneHour);
    return hours === 1 ? "roughly 1 hour" : `roughly ${hours} hours`;
  }
  if (seconds < oneMonth) {
    const days = Math.round(seconds / oneDay);
    return days === 1 ? "roughly 1 day" : `roughly ${days} days`;
  }
  if (seconds < oneYear) {
    const months = Math.round(seconds / oneMonth);
    return months === 1 ? "roughly 1 month" : `roughly ${months} months`;
  }
  return "more than 1 year";
}


