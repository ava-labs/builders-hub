"use client"

import type { ReactNode } from "react"
import { cn } from "../lib/utils"

interface ContainerProps {
  title: string
  children: ReactNode
  description?: ReactNode
  subDescription?: string
  showConfetti?: boolean
  logoSrc?: string
  logoAlt?: string
}

export function Container({
  title,
  children,
  description,
  subDescription,
  logoSrc = "/small-logo.png",
  logoAlt = "Logo",
}: ContainerProps) {
  return (
    <div
      className={cn(
        "w-full",
        "rounded-xl",
        "bg-background",
        "border border-border",
        "shadow-sm",
        "overflow-hidden",
        "mx-auto",
        "my-4",
      )}
    >
      {/* Header - matching FlowNavigation style */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={logoSrc} 
                alt={logoAlt} 
                className="h-6 w-auto brightness-0 dark:invert transition-all duration-200" 
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {description}
                </div>
              )}
              {subDescription && (
                <p className="text-sm text-muted-foreground mt-1">{subDescription}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content area - matching ConsoleLayout content styling */}
      <div className="p-6">
        <div className="rounded-xl bg-muted/50 p-6">
          <div className="space-y-6 text-foreground prose prose-sm max-w-none dark:prose-invert">
            {children}
          </div>
        </div>

        {/* Footer - simplified and modern */}
        <div className="pt-6 mt-6 border-t border-border text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span>Explore more</span>
            <a
              href="https://build.avax.network/tools/l1-toolbox"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:text-sky-600 dark:hover:text-sky-400 font-medium transition-colors"
            >
              <img src="/small-logo.png" alt="Avalanche" className="h-3 w-auto brightness-0 dark:invert" />
              <span>Avalanche Builder Tooling</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

