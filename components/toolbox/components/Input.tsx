"use client"

import type React from "react"

import { useState, useEffect, type InputHTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { Check } from "lucide-react"

interface RawInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null | React.ReactNode
  hasSuggestions?: boolean
}

export function RawInput({ className, error, hasSuggestions, ...props }: RawInputProps) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2.5",
        "bg-white dark:bg-zinc-900",
        "border-1",
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
          : "border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-primary/30",
        "text-zinc-900 dark:text-zinc-100",
        "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
        !hasSuggestions && "shadow-sm",
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
}

interface InputProps extends Omit<RawInputProps, "onChange"> {
  label: string
  unit?: string
  onChange?: (newValue: string) => void
  helperText?: string | React.ReactNode
  button?: React.ReactNode
  error?: string | null | React.ReactNode
  suggestions?: Suggestion[]
}

export function Input({
  label,
  unit,
  className,
  onChange,
  id,
  helperText,
  button,
  error,
  suggestions,
  ...props
}: InputProps) {
  const [inputValue, setInputValue] = useState(props.value?.toString() || props.defaultValue?.toString() || "")

  // Sync inputValue with props.value when it changes
  useEffect(() => {
    if (props.value !== undefined) {
      setInputValue(props.value.toString())
    }
  }, [props.value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange?.(newValue)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.value)
    onChange?.(suggestion.value)
    // Focus the input after selection
    const inputElement = document.getElementById(id as string)
    if (inputElement) {
      inputElement.focus()
    }
  }

  return (
    <div className="space-y-2 mb-6">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}
      </label>

      <div className="relative">
        <div className="flex">
          <RawInput
            {...props}
            id={id}
            value={inputValue}
            onChange={handleChange}
            hasSuggestions={suggestions && suggestions.length > 0 || !!error || !!helperText}
            className={cn(
              "flex-1",
              (suggestions && suggestions.length > 0) || error || helperText ? "rounded-t-md" : "rounded-md",
              unit ? "pr-12" : "",
              button ? "rounded-r-none" : "",
              className
            )}
            error={error}
          />
          {button}
        </div>
        {unit && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 pointer-events-none">{unit}</span>
          </div>
        )}

        {error ? (
          <div className={cn(
            "p-3 py-1 bg-red-50/50 dark:bg-red-950/30 border border-t-0 border-red-200/50 dark:border-red-800/50",
            suggestions && suggestions.length > 0 ? "border-b-0" : "rounded-b-lg"
          )}>
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : helperText ? (
          <div className={cn(
            "p-3 py-1 bg-zinc-50/50 dark:bg-zinc-900/30 border border-t-0 border-zinc-200/50 dark:border-zinc-800/50",
            suggestions && suggestions.length > 0 ? "border-b-0" : "rounded-b-lg"
          )}>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{helperText}</p>
          </div>
        ) : null}

        {suggestions && suggestions.length > 0 && (
          <div className={cn(
            "p-3 rounded-b-lg bg-zinc-50/50 dark:bg-zinc-900/30 border border-t-0 border-zinc-200/50 dark:border-zinc-800/50",
            (helperText) && "pt-0"
          )}>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Suggestions:</div>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => {
                const isSelected = inputValue === suggestion.value;
                return (
                  <div
                    key={index}
                    className={cn(
                      "px-3 py-1 cursor-pointer transition-all duration-150 text-left border-l-4 flex items-center justify-between gap-2",
                      isSelected
                        ? "border-zinc-400 dark:border-zinc-500"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                    )}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{suggestion.title}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{suggestion.description}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
