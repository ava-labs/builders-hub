"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"

interface AreaBucket {
  label: string
  sizeBytes: number
  width: number
  free: number
}

interface AnimEvent {
  type: "write" | "free"
  nodeLabel: string
  nodeSize: number
  targetIdx: number
}

const AREA_BUCKETS: AreaBucket[] = [
  { label: "16B", sizeBytes: 16, width: 14, free: 7 },
  { label: "64B", sizeBytes: 64, width: 18, free: 5 },
  { label: "256B", sizeBytes: 256, width: 24, free: 4 },
  { label: "1KB", sizeBytes: 1024, width: 30, free: 6 },
  { label: "4KB", sizeBytes: 4096, width: 38, free: 3 },
  { label: "16KB", sizeBytes: 16384, width: 46, free: 5 },
  { label: "64KB", sizeBytes: 65536, width: 54, free: 2 },
  { label: "256KB", sizeBytes: 262144, width: 62, free: 4 },
  { label: "1MB", sizeBytes: 1048576, width: 70, free: 3 },
  { label: "16MB", sizeBytes: 16777216, width: 80, free: 1 },
]

const WRITE_EVENTS: AnimEvent[] = [
  { type: "write", nodeLabel: "96B node", nodeSize: 96, targetIdx: 2 },
  { type: "write", nodeLabel: "3KB leaf", nodeSize: 3072, targetIdx: 4 },
  { type: "write", nodeLabel: "40B branch", nodeSize: 40, targetIdx: 1 },
  { type: "write", nodeLabel: "200KB val", nodeSize: 204800, targetIdx: 7 },
  { type: "write", nodeLabel: "12B key", nodeSize: 12, targetIdx: 0 },
]

const FREE_EVENTS: AnimEvent[] = [
  { type: "free", nodeLabel: "freed", nodeSize: 0, targetIdx: 3 },
  { type: "free", nodeLabel: "freed", nodeSize: 0, targetIdx: 5 },
  { type: "free", nodeLabel: "freed", nodeSize: 0, targetIdx: 1 },
  { type: "free", nodeLabel: "freed", nodeSize: 0, targetIdx: 6 },
  { type: "free", nodeLabel: "freed", nodeSize: 0, targetIdx: 8 },
]

function findSmallestFitLabel(sizeBytes: number): string {
  const bucket = AREA_BUCKETS.find(b => b.sizeBytes >= sizeBytes)
  return bucket ? bucket.label : "16MB"
}

export function AreaAllocatorCard({ colors }: { colors: Colors }) {
  const [buckets, setBuckets] = useState<AreaBucket[]>(AREA_BUCKETS)
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)
  const [flashType, setFlashType] = useState<"write" | "free" | null>(null)
  const [activeEvent, setActiveEvent] = useState<AnimEvent | null>(null)
  const [showFitLabel, setShowFitLabel] = useState(false)

  const isMountedRef = useRef(true)
  const cycleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const writeIdxRef = useRef(0)
  const freeIdxRef = useRef(0)

  const clearAllTimeouts = useCallback(() => {
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current)
  }, [])

  const runCycle = useCallback(() => {
    if (!isMountedRef.current) return

    // Phase 1: Write event arrives
    const writeEvent = WRITE_EVENTS[writeIdxRef.current % WRITE_EVENTS.length]
    writeIdxRef.current++

    setActiveEvent(writeEvent)
    setHighlightIdx(null)
    setFlashType(null)
    setShowFitLabel(false)

    // Phase 2: Highlight target bucket after short delay
    cycleTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return
      setHighlightIdx(writeEvent.targetIdx)
      setFlashType("write")
      setShowFitLabel(true)

      // Phase 3: Decrement free count
      cycleTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return
        setBuckets(prev =>
          prev.map((b, i) =>
            i === writeEvent.targetIdx
              ? { ...b, free: Math.max(0, b.free - 1) }
              : b
          )
        )

        // Phase 4: Clear write, pause
        cycleTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          setHighlightIdx(null)
          setFlashType(null)
          setActiveEvent(null)
          setShowFitLabel(false)

          // Phase 5: Free event
          cycleTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return
            const freeEvent = FREE_EVENTS[freeIdxRef.current % FREE_EVENTS.length]
            freeIdxRef.current++

            setHighlightIdx(freeEvent.targetIdx)
            setFlashType("free")
            setActiveEvent(freeEvent)

            // Phase 6: Increment free count
            cycleTimeoutRef.current = setTimeout(() => {
              if (!isMountedRef.current) return
              setBuckets(prev =>
                prev.map((b, i) =>
                  i === freeEvent.targetIdx
                    ? { ...b, free: b.free + 1 }
                    : b
                )
              )

              // Phase 7: Clear and restart
              cycleTimeoutRef.current = setTimeout(() => {
                if (!isMountedRef.current) return
                setHighlightIdx(null)
                setFlashType(null)
                setActiveEvent(null)
                runCycle()
              }, 600)
            }, 400)
          }, 400)
        }, 500)
      }, 500)
    }, 600)
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    cycleTimeoutRef.current = setTimeout(runCycle, 800)

    return () => {
      isMountedRef.current = false
      clearAllTimeouts()
    }
  }, [runCycle, clearAllTimeouts])

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Malloc-like allocation.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            23 area sizes from 16B to 16MB. Freed nodes return to per-size free lists — no compaction, no fragmentation.
          </p>
        </div>
        <InfoTooltip colors={colors} text="Instead of compacting files like LevelDB, Firewood manages disk space the way malloc manages heap memory. There are 23 bucket sizes (16 bytes to 16 MB). Writing a trie node picks the smallest bucket that fits. When old nodes are freed, their space goes back to the matching bucket's free list — ready for the next write, no reorganization needed." />
      </div>

      {/* Event indicator */}
      <div className="mb-3 h-6 flex items-center gap-2">
        <AnimatePresence mode="wait">
          {activeEvent && (
            <motion.div
              key={`${activeEvent.type}-${activeEvent.nodeLabel}-${activeEvent.targetIdx}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <span
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 uppercase"
                style={{
                  backgroundColor: activeEvent.type === "write"
                    ? `${FIREWOOD_COLORS.trie}20`
                    : `${FIREWOOD_COLORS.disk}20`,
                  color: activeEvent.type === "write"
                    ? FIREWOOD_COLORS.trie
                    : FIREWOOD_COLORS.disk,
                  border: `1px solid ${
                    activeEvent.type === "write"
                      ? FIREWOOD_COLORS.trie
                      : FIREWOOD_COLORS.disk
                  }40`,
                }}
              >
                {activeEvent.type === "write" ? "ALLOC" : "FREE"}
              </span>
              {activeEvent.type === "write" && (
                <span
                  className="text-[10px] font-mono"
                  style={{ color: FIREWOOD_COLORS.trie }}
                >
                  {activeEvent.nodeLabel}
                </span>
              )}
              {showFitLabel && activeEvent.type === "write" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[9px] font-mono"
                  style={{ color: `${colors.stroke}60` }}
                >
                  {"-> "}
                  {findSmallestFitLabel(activeEvent.nodeSize)} bucket
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Area buckets visualization */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-end gap-1">
          {buckets.map((bucket, idx) => {
            const isHighlighted = highlightIdx === idx
            const isWrite = isHighlighted && flashType === "write"
            const isFree = isHighlighted && flashType === "free"

            const accentColor = isWrite
              ? FIREWOOD_COLORS.trie
              : isFree
                ? FIREWOOD_COLORS.disk
                : FIREWOOD_COLORS.rust

            return (
              <div
                key={bucket.label}
                className="flex flex-col items-center gap-1 flex-1"
              >
                {/* Free count */}
                <motion.span
                  className="text-[8px] font-mono font-bold"
                  animate={{
                    color: isHighlighted ? accentColor : `${colors.stroke}50`,
                    scale: isHighlighted ? 1.15 : 1,
                  }}
                  transition={{ duration: 0.15 }}
                >
                  {bucket.free}
                </motion.span>

                {/* Bar */}
                <motion.div
                  className="w-full relative"
                  style={{
                    height: bucket.width,
                    minWidth: 20,
                  }}
                  animate={{
                    backgroundColor: isHighlighted
                      ? `${accentColor}30`
                      : `${FIREWOOD_COLORS.rust}12`,
                    borderColor: isHighlighted
                      ? accentColor
                      : `${FIREWOOD_COLORS.rust}25`,
                  }}
                  transition={{ duration: 0.15 }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      border: `1px solid ${
                        isHighlighted ? accentColor : `${FIREWOOD_COLORS.rust}25`
                      }`,
                    }}
                  />
                  {isHighlighted && (
                    <motion.div
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.4, 0] }}
                      transition={{ duration: 0.6 }}
                      style={{
                        backgroundColor: accentColor,
                      }}
                    />
                  )}
                </motion.div>

                {/* Size label */}
                <span
                  className="text-[7px] font-mono leading-none"
                  style={{
                    color: isHighlighted ? accentColor : `${colors.stroke}40`,
                  }}
                >
                  {bucket.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer legend */}
      <div
        className={`flex items-center justify-center gap-4 text-[10px] ${colors.textMuted} font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 inline-block"
            style={{ backgroundColor: FIREWOOD_COLORS.trie }}
          />
          allocate
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 inline-block"
            style={{ backgroundColor: FIREWOOD_COLORS.disk }}
          />
          reclaim
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 inline-block"
            style={{ backgroundColor: `${FIREWOOD_COLORS.rust}40` }}
          />
          free slots
        </span>
      </div>
    </div>
  )
}
