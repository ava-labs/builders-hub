"use client"

import type React from "react"

import { useState, type InputHTMLAttributes } from "react"
import { cn } from "../lib/utils"

interface RawInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null | React.ReactNode
}

function RawInput({ className, error, ...props }: RawInputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md px-3 py-2.5",
        "bg-white dark:bg-zinc-900",
        "border-1",
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
          : "border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-primary/30",
        "text-zinc-900 dark:text-zinc-100",
        "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
        "shadow-sm",
        "transition-colors duration-200",
        "focus:outline-none focus:ring-2",
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        props.disabled ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed" : "",
        className,
      )}
      {...props}
    />
  )
}

interface AmountInputProps extends Omit<RawInputProps, "onChange"> {
  label: string
  unit?: string
  onChange?: (newValue: string) => void
  helperText?: string | React.ReactNode
  button?: React.ReactNode
  error?: string | null | React.ReactNode
}

export function AmountInput({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  ...props
}: AmountInputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || "")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange?.(newValue)
  }

  return (
    <div className="space-y-2 mb-6">

      <div className="flex items-center justify-between gap-1">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Max: {props.max}
        </div>
      </div>

      <div className="relative">
        <div className="flex">
          <RawInput
            id={id}
            value={inputValue}
            onChange={handleChange}
            className={cn("flex-1", unit ? "pr-12" : "", button ? "rounded-r-none" : "", className)}
            error={error}
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

      {error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  )
}
