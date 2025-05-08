"use client"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "./utils"
import { Button } from "./Button"

export type PChainOwner = { 
  addresses: string[]
  threshold: number
}

interface OwnerAddressesInputProps {
  label: string
  owner: PChainOwner
  onChange: (owner: PChainOwner) => void
}

export function OwnerAddressesInput({ label, owner, onChange }: OwnerAddressesInputProps) {
  const updateAddresses = (addresses: string[]) => {
    // If there's only one address, set threshold to 1
    const threshold = addresses.length <= 1 ? 1 : owner.threshold

    // Make sure threshold is not greater than the number of addresses
    const validThreshold = Math.min(threshold, addresses.length)

    onChange({
      addresses,
      threshold: validThreshold,
    })
  }

  const updateThreshold = (threshold: number) => {
    onChange({
      ...owner,
      threshold: Math.max(1, Math.min(threshold, owner.addresses.length)),
    })
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      <div className="space-y-2">
        {owner.addresses.map((address, addrIndex) => (
          <div key={addrIndex} className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => {
                const newAddresses = [...owner.addresses]
                newAddresses[addrIndex] = e.target.value
                updateAddresses(newAddresses)
              }}
              className={cn(
                "flex-1 rounded p-2",
                "bg-zinc-50 dark:bg-zinc-900",
                "border border-zinc-200 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "shadow-sm focus:ring focus:ring-indigo-200 focus:ring-opacity-50",
                "font-mono text-sm",
              )}
            />
            <button
              onClick={() => {
                const newAddresses = [...owner.addresses]
                newAddresses.splice(addrIndex, 1)
                updateAddresses(newAddresses)
              }}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors text-red-500"
              title="Remove address"
              type="button"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {owner.addresses.length > 1 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Threshold:</span>
              <input
                type="number"
                min="1"
                max={owner.addresses.length}
                value={owner.threshold}
                onChange={(e) => updateThreshold(Number.parseInt(e.target.value) || 1)}
                className={cn(
                  "w-20 rounded p-2",
                  "bg-zinc-50 dark:bg-zinc-900",
                  "border border-zinc-200 dark:border-zinc-700",
                  "text-zinc-900 dark:text-zinc-100",
                  "shadow-sm focus:ring focus:ring-indigo-200 focus:ring-opacity-50",
                )}
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                of {owner.addresses.length} addresses
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The threshold determines how many addresses must sign to authorize actions.
            </p>
          </div>
        )}

        <Button
          onClick={() => {
            const newAddresses = [...owner.addresses, ""]
            updateAddresses(newAddresses)
          }}
          variant="secondary"
          className="w-full"
          icon={<Plus className="w-4 h-4" />}
        >
          Add Address
        </Button>
      </div>
    </div>
  )
}

