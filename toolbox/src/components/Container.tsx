"use client"

import type { ReactNode } from "react"
import { cn } from "../lib/utils"

type ColorTheme = "red" | "blue" | "green" | "purple" | "orange" | "cyan" | "amber" | "emerald" | "indigo" | "pink"

interface ContainerProps {
  title: string
  children: ReactNode
  description?: ReactNode
  subDescription?: string
  showConfetti?: boolean
  logoSrc?: string
  logoAlt?: string
  logoColorTheme?: ColorTheme
}

const colorThemeMap: Record<
  ColorTheme,
  {
    bg: string
    darkBg: string
    hover: string
    darkHover: string
    gradient: string
    darkGradient: string
  }
> = {
  red: {
    bg: "bg-red-100",
    darkBg: "dark:bg-red-900/30",
    hover: "hover:text-red-600",
    darkHover: "dark:hover:text-red-400",
    gradient: "from-red-50 to-red-100",
    darkGradient: "dark:from-red-900/20 dark:to-red-800/30",
  },
  blue: {
    bg: "bg-blue-100",
    darkBg: "dark:bg-blue-900/30",
    hover: "hover:text-blue-600",
    darkHover: "dark:hover:text-blue-400",
    gradient: "from-blue-50 to-blue-100",
    darkGradient: "dark:from-blue-900/20 dark:to-blue-800/30",
  },
  green: {
    bg: "bg-green-100",
    darkBg: "dark:bg-green-900/30",
    hover: "hover:text-green-600",
    darkHover: "dark:hover:text-green-400",
    gradient: "from-green-50 to-green-100",
    darkGradient: "dark:from-green-900/20 dark:to-green-800/30",
  },
  purple: {
    bg: "bg-purple-100",
    darkBg: "dark:bg-purple-900/30",
    hover: "hover:text-purple-600",
    darkHover: "dark:hover:text-purple-400",
    gradient: "from-purple-50 to-purple-100",
    darkGradient: "dark:from-purple-900/20 dark:to-purple-800/30",
  },
  orange: {
    bg: "bg-orange-100",
    darkBg: "dark:bg-orange-900/30",
    hover: "hover:text-orange-600",
    darkHover: "dark:hover:text-orange-400",
    gradient: "from-orange-50 to-orange-100",
    darkGradient: "dark:from-orange-900/20 dark:to-orange-800/30",
  },
  cyan: {
    bg: "bg-cyan-100",
    darkBg: "dark:bg-cyan-900/30",
    hover: "hover:text-cyan-600",
    darkHover: "dark:hover:text-cyan-400",
    gradient: "from-cyan-50 to-cyan-100",
    darkGradient: "dark:from-cyan-900/20 dark:to-cyan-800/30",
  },
  amber: {
    bg: "bg-amber-100",
    darkBg: "dark:bg-amber-900/30",
    hover: "hover:text-amber-600",
    darkHover: "dark:hover:text-amber-400",
    gradient: "from-amber-50 to-amber-100",
    darkGradient: "dark:from-amber-900/20 dark:to-amber-800/30",
  },
  emerald: {
    bg: "bg-emerald-100",
    darkBg: "dark:bg-emerald-900/30",
    hover: "hover:text-emerald-600",
    darkHover: "dark:hover:text-emerald-400",
    gradient: "from-emerald-50 to-emerald-100",
    darkGradient: "dark:from-emerald-900/20 dark:to-emerald-800/30",
  },
  indigo: {
    bg: "bg-indigo-100",
    darkBg: "dark:bg-indigo-900/30",
    hover: "hover:text-indigo-600",
    darkHover: "dark:hover:text-indigo-400",
    gradient: "from-indigo-50 to-indigo-100",
    darkGradient: "dark:from-indigo-900/20 dark:to-indigo-800/30",
  },
  pink: {
    bg: "bg-pink-100",
    darkBg: "dark:bg-pink-900/30",
    hover: "hover:text-pink-600",
    darkHover: "dark:hover:text-pink-400",
    gradient: "from-pink-50 to-pink-100",
    darkGradient: "dark:from-pink-900/20 dark:to-pink-800/30",
  },
}

export function Container({
  title,
  children,
  description,
  subDescription,
  logoSrc = "/small-logo.png",
  logoAlt = "Logo",
  logoColorTheme = "red",
}: ContainerProps) {
  const colorTheme = colorThemeMap[logoColorTheme] || colorThemeMap.red

  return (
    <div>
      <h3 className="text-3xl font-semibold text-foreground">{title}</h3>
      {description && (
        <div className="text-sm text-muted-foreground mt-1">
          {description}
        </div>
      )}
      {subDescription && (
        <p className="text-sm text-muted-foreground mt-1">{subDescription}</p>
      )}


      {/* Content area - matching ConsoleLayout content styling */}
      
      <div className="space-y-6 text-foreground prose prose-sm max-w-none dark:prose-invert">
        {children}
      </div>
    </div>
  )
}

