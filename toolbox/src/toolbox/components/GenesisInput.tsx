"use client"
import { cn } from "../../lib/utils"

interface GenesisInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  disabled?: boolean
  rows?: number
}

export function GenesisInput({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 25,
}: GenesisInputProps) {
  return (
    <div className="space-y-2">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{label}</span>
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Use the{" "}
            <a href="https://build.avax.network/tools/l1-toolbox#genesisBuilder" className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70">
                Genesis Builder
            </a>{" "}
            to configure the permissions, tokenomics and transaction fees for your L1. The there generated  genesis file is filled automatically below and can be modified as needed.
        </div>
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              "w-full rounded p-3 font-mono text-sm",
              "bg-white dark:bg-zinc-800",
              "border-none",
              "text-zinc-900 dark:text-zinc-100",
              "shadow-sm focus:ring focus:ring-blue-500/30",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
              disabled ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400" : "",
            )}
          />
        </div>
        
      </div>
    </div>
  )
}

