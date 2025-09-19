"use client"

import { ConsoleToolMetadata } from "@/types/consoleTool"
import type { ReactNode } from "react"
import { CheckWalletRequirements } from "./CheckWalletRequirements"

interface ToolContainerProps {
  consoleToolMetadata: ConsoleToolMetadata
  children: ReactNode
}

// simplified container does not use color themes currently

export function ToolContainer({
  consoleToolMetadata,
  children,
}: ToolContainerProps) {

  return (
    <CheckWalletRequirements configKey={consoleToolMetadata.walletRequirements}>
      <div className="space-y-3 prose">
        <h3 className="text-xl md:text-2xl font-semibold leading-tight text-foreground">{consoleToolMetadata.title}</h3>
        {consoleToolMetadata.description && (
          <div className="text-sm text-muted-foreground leading-relaxed">
            {consoleToolMetadata.description}
          </div>
        )}
      </div>

      <div className="space-y-8 text-foreground prose">
        {children}
      </div>
    </CheckWalletRequirements>
  )
}

