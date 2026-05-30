"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS, NIBBLES } from "./types"
import { InfoTooltip } from "./shared"

type CellState = "idle" | "receiving" | "hashing" | "done"

interface SubtrieCell {
  nibble: string
  state: CellState
  progress: number
}

function createIdleCells(): SubtrieCell[] {
  return NIBBLES.map(nibble => ({
    nibble,
    state: "idle" as const,
    progress: 0,
  }))
}

function pickActiveNibbles(count: number): number[] {
  const clamped = Math.max(1, Math.min(16, count))
  const indices: number[] = []
  while (indices.length < clamped) {
    const idx = Math.floor(Math.random() * 16)
    if (!indices.includes(idx)) {
      indices.push(idx)
    }
  }
  return indices
}

export function ParallelMerkleCard({ colors }: { colors: Colors }) {
  const [cells, setCells] = useState<SubtrieCell[]>(createIdleCells)
  const [phase, setPhase] = useState<"idle" | "distribute" | "hash" | "done">("idle")
  const [activeIndices, setActiveIndices] = useState<number[]>([])
  const [batchKey, setBatchKey] = useState(0)
  const [threadCount, setThreadCount] = useState(6)
  const threadCountRef = useRef(6)
  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(t => clearTimeout(t))
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timeoutsRef.current = [...timeoutsRef.current, t]
    return t
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const runCycle = () => {
      if (!isMountedRef.current) return

      const chosen = pickActiveNibbles(threadCountRef.current)
      setActiveIndices(chosen)
      setBatchKey(k => k + 1)

      // Phase 1: Distribute dots to cells
      setPhase("distribute")
      setCells(prev =>
        prev.map((cell, i) => ({
          ...cell,
          state: chosen.includes(i) ? ("receiving" as const) : ("idle" as const),
          progress: 0,
        }))
      )

      // Phase 2: Start hashing (all active cells simultaneously)
      addTimeout(() => {
        if (!isMountedRef.current) return
        setPhase("hash")
        setCells(prev =>
          prev.map((cell, i) => ({
            ...cell,
            state: chosen.includes(i) ? ("hashing" as const) : cell.state,
          }))
        )
      }, 800)

      // Phase 3: Mark done
      addTimeout(() => {
        if (!isMountedRef.current) return
        setPhase("done")
        setCells(prev =>
          prev.map((cell, i) => ({
            ...cell,
            state: chosen.includes(i) ? ("done" as const) : cell.state,
            progress: chosen.includes(i) ? 1 : cell.progress,
          }))
        )
      }, 2000)

      // Phase 4: Reset
      addTimeout(() => {
        if (!isMountedRef.current) return
        setPhase("idle")
        setCells(createIdleCells())
        setActiveIndices([])
        addTimeout(runCycle, 600)
      }, 3200)
    }

    addTimeout(runCycle, 500)

    return () => {
      isMountedRef.current = false
      clearAllTimeouts()
    }
  }, [addTimeout, clearAllTimeouts])

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            N parallel threads.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            State changes split by first nibble. Each subtrie hashes independently.
          </p>
        </div>
        <InfoTooltip colors={colors} text="After a block executes, all state changes need to be hashed into the trie. Firewood splits the root into 16 independent subtries (one per nibble 0-F) and hashes them in parallel using Rayon worker threads. A block touching 6 subtries hashes all 6 at once instead of sequentially." />
      </div>

      {/* Incoming state changes indicator — fixed height to prevent layout shift */}
      <div className="flex items-center gap-2 mb-3 h-4">
        <AnimatePresence>
          {(phase === "distribute" || phase === "hash") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1"
            >
              {activeIndices.map((_, i) => (
                <div
                  key={`dot-${batchKey}-${i}`}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: FIREWOOD_COLORS.parallel }}
                />
              ))}
              <span className={`text-[9px] ${colors.textMuted} font-mono ml-1`}>
                {activeIndices.length} changes
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4x4 nibble grid */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map((cell, i) => {
            const isActive = activeIndices.includes(i)
            return (
              <motion.div
                key={`cell-${cell.nibble}`}
                className="w-10 h-10 relative flex items-center justify-center overflow-hidden"
                animate={{
                  borderColor: isActive
                    ? cell.state === "done"
                      ? `${FIREWOOD_COLORS.disk}80`
                      : `${FIREWOOD_COLORS.parallel}60`
                    : `${colors.stroke}15`,
                  backgroundColor: isActive
                    ? cell.state === "done"
                      ? `${FIREWOOD_COLORS.disk}15`
                      : `${FIREWOOD_COLORS.parallel}10`
                    : `${colors.stroke}05`,
                }}
                transition={{ duration: 0.2 }}
                style={{ border: "1.5px solid" }}
              >
                {/* Progress bar fill */}
                {cell.state === "hashing" && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ backgroundColor: `${FIREWOOD_COLORS.parallel}30` }}
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 1.1, ease: "linear" }}
                  />
                )}

                {/* Nibble label or checkmark */}
                <div className="relative z-10 flex items-center justify-center">
                  {cell.state === "done" ? (
                    <motion.svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={FIREWOOD_COLORS.disk}
                      strokeWidth="3"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <path d="M5 13l4 4L19 7" />
                    </motion.svg>
                  ) : (
                    <span
                      className={`text-[10px] font-mono font-bold`}
                      style={{
                        color: isActive ? FIREWOOD_COLORS.parallel : `${colors.stroke}40`,
                      }}
                    >
                      {cell.nibble}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Footer with thread slider */}
      <div
        className={`flex flex-col gap-2 pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <div className="flex items-center justify-center gap-3">
          <span className={`text-[10px] ${colors.textMuted} font-mono`}>1</span>
          <input
            type="range"
            min={1}
            max={16}
            value={threadCount}
            onChange={e => {
              const val = parseInt(e.target.value, 10)
              threadCountRef.current = val
              setThreadCount(val)
            }}
            className="flex-1 max-w-[140px] h-1 appearance-none rounded-full cursor-pointer"
            style={{
              background: `${FIREWOOD_COLORS.parallel}40`,
              accentColor: FIREWOOD_COLORS.parallel,
            }}
          />
          <span className={`text-[10px] ${colors.textMuted} font-mono`}>16</span>
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 min-w-[50px] text-center"
            style={{
              backgroundColor: `${FIREWOOD_COLORS.parallel}15`,
              color: FIREWOOD_COLORS.parallel,
              border: `1px solid ${FIREWOOD_COLORS.parallel}25`,
            }}
          >
            N = {threadCount}
          </span>
        </div>
        <div className={`text-[10px] ${colors.textMuted} font-mono text-center`}>
          All active subtries hash simultaneously
        </div>
      </div>
    </div>
  )
}
