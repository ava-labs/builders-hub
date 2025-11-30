"use client"
import { Colors } from "./types"
import { GasClockCard } from "./GasClockCard"
import { DeferredSettlementCard } from "./DeferredSettlementCard"
import { ImmediateConfirmationCard } from "./ImmediateConfirmationCard"
import { GuaranteedExecutionCard } from "./GuaranteedExecutionCard"
import { ParallelStreamsCard } from "./ParallelStreamsCard"

export function KeyFeatures({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="min-h-[260px]">
          <GasClockCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <DeferredSettlementCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <ImmediateConfirmationCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <GuaranteedExecutionCard colors={colors} />
        </div>
        <ParallelStreamsCard colors={colors} />
      </div>
      
    </div>
  )
}
