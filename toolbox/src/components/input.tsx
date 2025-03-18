"use client"

import type { InputHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string
  unit?: string
  onChange?: (newValue: string) => void
  helperText?: string
}

export function Input({ label, unit, className, onChange, id, helperText, ...props }: InputProps) {
  return (
    <div className="space-y-2">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{label}</span>
        </div>
        <div className="relative">
          <input
            id={id}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full rounded p-3",
              "bg-white dark:bg-zinc-800",
              "border-none",
              "text-zinc-900 dark:text-zinc-100",
              "shadow-sm focus:ring focus:ring-blue-500/30",
              unit ? "pr-12" : "",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              props.disabled ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400" : "",
              className,
            )}
            {...props}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      </div>
      {helperText && <p className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">{helperText}</p>}
    </div>
  )
}

