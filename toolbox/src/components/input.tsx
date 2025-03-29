"use client"

import type { InputHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string
  unit?: string
  onChange?: (newValue: string) => void
  helperText?: string
  button?: React.ReactNode
}

export function Input({ label, unit, className, onChange, id, helperText, button, ...props }: InputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>

      <div className="relative">
        <div className="flex">
          <input
            id={id}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full rounded-md px-3 py-2.5",
              "bg-white dark:bg-zinc-900",
              "border border-zinc-300 dark:border-zinc-700",
              "text-zinc-900 dark:text-zinc-100",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
              "shadow-sm",
              "transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              unit ? "pr-12" : "",
              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
              props.disabled ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed" : "",
              button ? "rounded-r-none" : "",
              className,
            )}
            {...props}
          />
          {button}
        </div>
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 pointer-events-none">{unit}</span>
          </div>
        )}
      </div>

      {helperText && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{helperText}</p>}
    </div>
  )
}

