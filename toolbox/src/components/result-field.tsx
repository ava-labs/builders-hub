"use client"

import { Check } from "lucide-react"
import { cn } from "../../lib/utils"

interface ResultFieldProps {
  label: string
  value: string
  showCheck?: boolean
}

export function ResultField({ label, value, showCheck = false }: ResultFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
        {showCheck && <Check className="w-4 h-4 text-green-500" />}
      </div>
      <div
        className={cn(
          "w-full rounded-md p-3",
          "bg-zinc-50 dark:bg-zinc-900",
          "border border-zinc-200 dark:border-zinc-800",
          "font-mono text-sm",
          "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {value}
      </div>
    </div>
  )
}

