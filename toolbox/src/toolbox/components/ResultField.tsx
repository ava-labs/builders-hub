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
          "w-full rounded-lg p-3.5 font-mono text-sm shadow-sm whitespace-pre-wrap break-words",
          "text-zinc-900 dark:text-zinc-100",
          showCheck
            ? "bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30"
            : "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30",
        )}
      >
        {value}
      </div>
    </div>
  )
}

