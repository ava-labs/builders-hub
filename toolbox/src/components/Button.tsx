"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "../lib/utils"

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  loading?: boolean
  loadingText?: string
  icon?: ReactNode
  disabled?: boolean
  variant?: "primary" | "secondary" | "outline" | "danger" | "outline-danger" | "light-danger"
  size?: "default" | "sm" | "lg"
  className?: string
  stickLeft?: boolean
<<<<<<< HEAD
=======
  error?: string
>>>>>>> upstream/master
}

export function Button({
  children,
  onClick,
  loading = false,
  loadingText,
  icon,
  disabled = false,
  variant = "primary",
  size = "default",
  className,
  stickLeft = false,
<<<<<<< HEAD
=======
  error,
>>>>>>> upstream/master
}: ButtonProps) {
  // Base classes shared by all buttons
  const baseClasses = [
    stickLeft ? "whitespace-nowrap" : "w-full", // When stickLeft is true, use minimal width
    "text-sm font-medium shadow-sm",
    "transition-colors duration-300",
    "flex items-center justify-center gap-2",
<<<<<<< HEAD
=======
    "cursor-pointer", // Add explicit cursor-pointer for all interactive buttons
>>>>>>> upstream/master
  ];

  // Add rounded corners based on stickLeft
  const roundedClasses = stickLeft ? "rounded-r-xl" : "rounded-xl";
  baseClasses.push(roundedClasses);

  // Size-specific classes
  let sizeClasses = "";
  if (size === "default") sizeClasses = "px-4 py-3";
<<<<<<< HEAD
  else if (size === "sm") sizeClasses = "px-3 py-2 text-xs rounded-sm";
=======
  else if (size === "sm") sizeClasses = "px-3 py-2 text-xs rounded-md";
>>>>>>> upstream/master
  else if (size === "lg") sizeClasses = "px-6 py-4 text-base";

  // Adjust size-specific rounding
  if (size === "sm" && stickLeft) {
<<<<<<< HEAD
    sizeClasses = sizeClasses.replace("rounded-sm", "rounded-r-sm");
=======
    sizeClasses = sizeClasses.replace("rounded-md", "rounded-r-md");
>>>>>>> upstream/master
  }

  // Variant-specific classes
  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600";
  } else if (variant === "secondary") {
<<<<<<< HEAD
    variantClasses = "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600";
=======
    variantClasses = "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50";
>>>>>>> upstream/master
  } else if (variant === "outline") {
    variantClasses = "border-2 border-zinc-300 bg-transparent text-zinc-800 hover:bg-zinc-100 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-500";
  } else if (variant === "danger") {
    variantClasses = "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600";
  } else if (variant === "light-danger") {
    variantClasses = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 dark:border-red-900/50";
  }

  // State classes (disabled)
  const stateClasses = "disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400 disabled:cursor-not-allowed";

  // Combine all classes
  const buttonClasses = cn(
    ...baseClasses,
    sizeClasses,
    variantClasses,
    stateClasses,
    className
  );

  return (
<<<<<<< HEAD
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={buttonClasses}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          {loadingText || "Loading..."}
        </>
      ) : (
        <>
          {icon && icon}
          {children}
        </>
      )}
    </button>
=======
    <>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={buttonClasses}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {loadingText || "Loading..."}
          </>
        ) : (
          <>
            {icon && icon}
            {children}
          </>
        )}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </>
>>>>>>> upstream/master
  )
}

