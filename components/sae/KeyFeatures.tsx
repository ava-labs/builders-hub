"use client"
import { Colors } from "./types"
import { GasClockCard } from "./GasClockCard"
import { ImmediateConfirmationCard } from "./ImmediateConfirmationCard"
import { GuaranteedExecutionCard } from "./GuaranteedExecutionCard"
import { ParallelStreamsCard } from "./ParallelStreamsCard"

export function KeyFeatures({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gas is the clock - full width */}
        <div className="min-h-[260px] col-span-1 md:col-span-2">
          <GasClockCard colors={colors} />
        </div>
        {/* Budget for worst case & See results instantly - side by side */}
        <div className="min-h-[260px]">
          <GuaranteedExecutionCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <ImmediateConfirmationCard colors={colors} />
        </div>
        {/* Two engines - full width */}
        <ParallelStreamsCard colors={colors} />
      </div>
      
    </div>
  )
}
