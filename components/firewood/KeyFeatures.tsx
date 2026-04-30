"use client"
import { Colors } from "./types"
import { NoCompactionCard } from "./NoCompactionCard"
import { ParallelMerkleCard } from "./ParallelMerkleCard"
import { CopyOnWriteCard } from "./CopyOnWriteCard"
import { DeferredPersistenceCard } from "./DeferredPersistenceCard"
import { AreaAllocatorCard } from "./AreaAllocatorCard"

export function KeyFeatures({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* No Compaction - full width */}
        <div className="min-h-[260px] col-span-1 md:col-span-2">
          <NoCompactionCard colors={colors} />
        </div>
        {/* Parallel Merkle & Copy-on-Write - side by side */}
        <div className="min-h-[260px]">
          <ParallelMerkleCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <CopyOnWriteCard colors={colors} />
        </div>
        {/* Deferred Persistence & Area Allocator - side by side */}
        <div className="min-h-[260px]">
          <DeferredPersistenceCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <AreaAllocatorCard colors={colors} />
        </div>
      </div>
    </div>
  )
}
