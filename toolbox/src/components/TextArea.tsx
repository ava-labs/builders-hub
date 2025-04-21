"use client"

import type { TextareaHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
    label: string
    onChange?: (newValue: string) => void
    helperText?: string
    button?: React.ReactNode
    error?: string | null
    rows?: number
}

export function Textarea({
    label,
    className,
    onChange,
    id,
    helperText,
    button,
    error,
    rows = 3,
    ...props
}: TextareaProps) {
    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {label}
            </label>

            <div className="relative">
                <div className="flex">
                    <textarea
                        id={id}
                        rows={rows}
                        onChange={(e) => onChange?.(e.target.value)}
                        className={cn(
                            "w-full rounded-md px-3 py-2.5",
                            "bg-white dark:bg-zinc-900",
                            "border",
                            error
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                                : "border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-primary/30",
                            "text-zinc-900 dark:text-zinc-100",
                            "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
                            "shadow-sm",
                            "transition-colors duration-200",
                            "focus:outline-none focus:ring-2",
                            "resize-y",
                            props.disabled ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed" : "",
                            button ? "rounded-r-none" : "",
                            className,
                        )}
                        {...props}
                    />
                    {button}
                </div>
            </div>

            {error ? (
                <p className="text-xs text-red-500 mt-1">{error}</p>
            ) : helperText ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{helperText}</p>
            ) : null}
        </div>
    )
}
