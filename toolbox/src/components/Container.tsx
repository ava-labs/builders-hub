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
    <div className="space-y-3 prose">
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


    <div className="space-y-8 text-foreground prose">
      {children}
    </div>
  </>
  )
}

