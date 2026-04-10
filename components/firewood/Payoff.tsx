"use client"
import { Colors } from "./types"
import { DatabaseComparison } from "./DatabaseComparison"
import { PipelineIntegration } from "./PipelineIntegration"

export function Payoff({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-1 md:col-span-2">
          <DatabaseComparison colors={colors} />
        </div>
        <div className="col-span-1 md:col-span-2">
          <PipelineIntegration colors={colors} />
        </div>
      </div>
      <p className={`text-xs ${colors.textMuted} font-mono text-center`}>
        * Firewood is currently experimental. LevelDB remains the default for AvalancheGo.
      </p>
    </div>
  )
}
