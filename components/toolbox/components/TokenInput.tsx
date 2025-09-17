"use client"

import type React from "react"

import { useEffect, useState, type InputHTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { RefreshCcw } from "lucide-react"
import { formatEther } from "viem"

export interface RawInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null | React.ReactNode
}

export function RawInput({ className, error, ...props }: RawInputProps) {
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

export interface Suggestion {
  title: string
  value: string
  description: string
  token?: {
    name: string
    symbol: string
    decimals: number,
    balance?: bigint,
    chain?: {
      name?: string,
      id?: string,
      logoUrl?: string
    }
  }
}

export interface TokenInputProps extends Omit<RawInputProps, "onChange"> {
  label: string
  unit?: string
  onChange?: (newValue: string) => void
  helperText?: string | React.ReactNode
  button?: React.ReactNode
  error?: string | null | React.ReactNode
  suggestions?: Suggestion[]
  selected?: any
}

export function TokenInput({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  suggestions,
  selected,
  ...props
}: TokenInputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || "")
  const [showSuggestions, setShowSuggestions] = useState(true)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange?.(newValue)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.value)
    onChange?.(suggestion.value)
    setShowSuggestions(false)
    // Focus the input after selection
    const inputElement = document.getElementById(id as string)
    if (inputElement) {
      inputElement.focus()
    }
  }

  useEffect(() => {
    setShowSuggestions(!selected)
  }, [selected])

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center justify-between gap-1">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
        { selected && <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          Balance: {Number(formatEther(selected?.balance || 0n)).toFixed(2)}
          <button
            type="button"
            className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            aria-label="Refresh balance"
            onClick={() => {/* your refresh logic here */}}
          >
            <RefreshCcw className="w-3 h-3" />
          </button>
        </div>}
      </div>

      <div className="relative">
        <div className="flex">
          <RawInput
            id={id}
            value={inputValue}
            onChange={handleChange}
            className={cn("flex-1", unit ? "pr-12" : "", selected ? "rounded-r-none" : "", className)}
            error={error}
            {...props}
          />

          {selected && <div className="flex items-center gap-2 border px-4 p-2 border-1 border-zinc-300 dark:border-zinc-700 border-l-0 rounded-r-md">
            {selected.symbol && (
              <div className="relative w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 font-bold text-base">
                {selected.symbol[0]}
                {selected.chain?.logoUrl && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full overflow-hidden border border-white bg-white/80 dark:border-zinc-800 dark:bg-zinc-800/80 flex items-center justify-center">
                    <img
                      src={selected.chain.logoUrl}
                      alt={selected.chain.name || 'Chain logo'}
                      className="w-full h-full object-contain p-0.5 block rounded-full"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selected.name}</div>
          </div>}
        </div>
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 pointer-events-none">{unit}</span>
          </div>
        )}

        {suggestions && suggestions.length > 0 && showSuggestions && (<>
          <div className="text-xs mt-2">Suggestions:</div>
          <div className="z-50 mt-1 w-full bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 max-h-60 overflow-auto">
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors text-left"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {suggestion.token?.symbol && (
                        <div className="relative w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100 font-bold text-base">
                          {suggestion.token.symbol[0]}
                          {suggestion.token.chain?.logoUrl && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full overflow-hidden border border-white bg-white/80 dark:border-zinc-800 dark:bg-zinc-800/80 flex items-center justify-center">
                              <img 
                                src={suggestion.token.chain.logoUrl} 
                                alt={suggestion.token.chain.name || 'Chain logo'} 
                                className="w-full h-full object-contain p-0.5 block rounded-full"
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{suggestion.token?.name}</div>
                      <div className="text-sm font-medium bg-blue-100 dark:bg-blue-700 px-1.5 py-0.5 rounded-md text-zinc-900 dark:text-zinc-100">{suggestion.token?.symbol}</div>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{suggestion.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>)}
      </div>

      {error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  )
}
