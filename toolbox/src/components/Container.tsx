"use client"

import type { ReactNode } from "react"

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

// simplified container does not use color themes currently

export function Container({
  title,
  children,
  description,
  subDescription,
}: ContainerProps) {

  return (<>
    <div className="space-y-3">
      <h3 className="text-xl md:text-2xl font-semibold leading-tight text-foreground">{title}</h3>
      {description && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </div>
      )}
      {subDescription && (
        <p className="text-sm text-muted-foreground leading-relaxed">{subDescription}</p>
      )}
    </div>

    <div className="p-6 md:p-8 prose">
      <div className="space-y-8 text-foreground [&_.steps>li:not(:last-child)]:mb-12 [&_.step]:pb-8 [&_button]:mb-4 [&_.steps]:space-y-12 [&_p]:leading-relaxed [&_p]:mb-4 [&_div]:leading-relaxed [&_.step_h3]:mb-3 [&_.step_div]:space-y-3">
        {children}
      </div>
    </div>
  </>
  )
}

