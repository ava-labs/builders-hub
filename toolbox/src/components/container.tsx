"use client"

import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface ContainerProps {
  title: string
  children: ReactNode
  description?: string
  showConfetti?: boolean
}

export function Container({
  title,
  children,
  description,
}: ContainerProps) {
  return (
    <div
      className={cn(
        "w-full",
        "rounded-xl",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "shadow-md",
        "overflow-hidden",
        "mx-auto",
        "my-8",
        "relative",
      )}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        </div>

        {description && <div className="text-sm text-zinc-600 dark:text-zinc-400">{description}</div>}

        <div className="space-y-6">{children}</div>

        <div className="pt-4 mt-6 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Explore more{" "}
            <a
              href="https://build.avax.network/tools/l1-toolbox"
              target="_blank"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-400 font-medium"
            >
               Avalanche Builder Tooling
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

