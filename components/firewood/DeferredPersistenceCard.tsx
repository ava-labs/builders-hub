"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS, lt } from "./types"
import { InfoTooltip } from "./shared"

const DEFAULT_PERMITS = 4
const MIN_PERMITS = 1
const MAX_PERMITS = 5

interface CommitBlock {
  id: number
  status: "committed"
}

interface PersistBlock {
  id: number
  status: "writing" | "persisted"
  progress: number
}

export function DeferredPersistenceCard({ colors }: { colors: Colors }) {
  const [commitBlocks, setCommitBlocks] = useState<CommitBlock[]>([])
  const [persistBlocks, setPersistBlocks] = useState<PersistBlock[]>([])
  const [maxPermits, setMaxPermits] = useState(DEFAULT_PERMITS)
  const [permits, setPermits] = useState(DEFAULT_PERMITS)
  const [persistQueue, setPersistQueue] = useState<number[]>([])
  const [isStalled, setIsStalled] = useState(false)

  const commitIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistWriteTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistQueueRef = useRef<number[]>([])
  const permitsRef = useRef(DEFAULT_PERMITS)
  const maxPermitsRef = useRef(DEFAULT_PERMITS)
  // Expose scheduleCommit so the slider handler can wake the commit thread
  const scheduleCommitRef = useRef<(() => void) | null>(null)

  // Slider handler: reset permits to new max, wake commit thread
  const handleMaxPermitsChange = useCallback((newMax: number) => {
    maxPermitsRef.current = newMax
    permitsRef.current = newMax
    setMaxPermits(newMax)
    setPermits(newMax)
    setIsStalled(false)
    // Wake the commit thread by clearing any stale timer and scheduling fresh
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current)
    if (scheduleCommitRef.current) {
      commitTimeoutRef.current = setTimeout(scheduleCommitRef.current, 300)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    // Commit thread: each commit consumes a permit.
    // When permits reach 0, stall. Persist completion or slider change wakes it.
    const scheduleCommit = () => {
      if (!isMountedRef.current) return

      if (permitsRef.current <= 0) {
        setIsStalled(true)
        return
      }

      setIsStalled(false)

      permitsRef.current = permitsRef.current - 1
      setPermits(permitsRef.current)

      commitIdRef.current = commitIdRef.current + 1
      if (commitIdRef.current > 999) commitIdRef.current = 1
      const newId = commitIdRef.current

      setCommitBlocks(prev => [
        ...prev.slice(-7),
        { id: newId, status: "committed" as const },
      ])

      persistQueueRef.current = [...persistQueueRef.current, newId]
      setPersistQueue([...persistQueueRef.current])

      commitTimeoutRef.current = setTimeout(scheduleCommit, 500 + Math.random() * 100)
    }

    // Persistence thread: writes latest revision, restores permits, wakes commit thread
    const schedulePersist = () => {
      if (!isMountedRef.current) return

      if (persistQueueRef.current.length === 0) {
        persistTimeoutRef.current = setTimeout(schedulePersist, 100)
        return
      }

      const latestId = persistQueueRef.current[persistQueueRef.current.length - 1]
      persistQueueRef.current = []
      setPersistQueue([])

      setPersistBlocks(prev => [
        ...prev.slice(-5),
        { id: latestId, status: "writing" as const, progress: 0 },
      ])

      persistWriteTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return
        setPersistBlocks(prev =>
          prev.map(b =>
            b.id === latestId
              ? { ...b, status: "persisted" as const, progress: 1 }
              : b
          )
        )

        // Restore all permits (latest revision includes all prior effects)
        permitsRef.current = maxPermitsRef.current
        setPermits(maxPermitsRef.current)
        setIsStalled(false)

        // Clear any pending commit timer, then wake commit thread
        if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current)
        commitTimeoutRef.current = setTimeout(scheduleCommit, 400)

        persistTimeoutRef.current = setTimeout(schedulePersist, 200)
      }, 1500)
    }

    scheduleCommitRef.current = scheduleCommit
    commitTimeoutRef.current = setTimeout(scheduleCommit, 300)
    persistTimeoutRef.current = setTimeout(schedulePersist, 1200)

    return () => {
      isMountedRef.current = false
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current)
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
      if (persistWriteTimeoutRef.current) clearTimeout(persistWriteTimeoutRef.current)
    }
  }, [])

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Deferred persistence.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            Commits are fast and in-memory. A background thread writes to disk — the permit count gates how far ahead commits can run before waiting for persistence.
          </p>
        </div>
        <InfoTooltip colors={colors} text="When a block commits, the new state is ready in memory immediately — execution doesn't wait for disk I/O. A background thread writes the latest revision to disk on its own schedule. Since each revision captures the full state, only one disk write is needed even if multiple blocks committed in between. A permit system prevents memory from growing unbounded." />
      </div>

      {/* Two lanes with permits between */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        {/* Commit thread lane */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5"
                style={{
                  backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "15"),
                  color: FIREWOOD_COLORS.disk,
                  border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "30")}`,
                }}
              >
                Commit
              </span>
              <span className={`text-[9px] ${colors.textMuted} font-mono`}>in-memory</span>
            </div>
            <motion.span
              animate={{ opacity: isStalled ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5"
              style={{
                backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.compaction, "bg", "20"),
                color: FIREWOOD_COLORS.compaction,
                border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.compaction, "border", "40")}`,
              }}
            >
              STALLED
            </motion.span>
          </div>
          <motion.div
            className="h-10 flex items-center gap-0.5 px-2 overflow-hidden"
            style={{
              backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "08"),
              border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "20")}`,
            }}
          >
            <AnimatePresence mode="popLayout">
              {commitBlocks.map((block, i) => {
                const isLatest = i === commitBlocks.length - 1
                return (
                  <motion.div
                    key={`cm-${block.id}`}
                    layout
                    initial={{ scale: 0, x: 20, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: isLatest ? 1 : 0.5 }}
                    exit={{ scale: 0.7, x: -15, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 25 }}
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: isLatest
                        ? lt(colors.stroke, FIREWOOD_COLORS.disk, "bgStrong", "25")
                        : lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "10"),
                      border: isLatest
                        ? `1.5px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "borderStrong", "60")}`
                        : `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "20")}`,
                    }}
                  >
                    <span
                      className="text-[7px] font-mono font-bold"
                      style={{ color: FIREWOOD_COLORS.disk, opacity: isLatest ? 0.9 : 0.4 }}
                    >
                      {block.id % 100}
                    </span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div className="flex-1" />
            <span className="text-[8px] font-mono flex-shrink-0" style={{ color: `${FIREWOOD_COLORS.disk}60` }}>
              in-memory
            </span>
          </motion.div>
        </div>

        {/* Middle section - permit circles */}
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="flex-1 h-px" style={{ backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "15") }} />
          <div className="flex items-center gap-1.5 px-3">
            <span className={`text-[8px] ${colors.textMuted} font-mono mr-1`}>Permits</span>
            {Array.from({ length: maxPermits }, (_, i) => {
              const isFilled = i < permits
              const isWarning = permits === 0
              return (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  animate={{
                    backgroundColor: isFilled
                      ? FIREWOOD_COLORS.disk
                      : "transparent",
                    borderColor: isFilled
                      ? FIREWOOD_COLORS.disk
                      : lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "25"),
                    scale: isWarning && !isFilled && i === 0 ? [1, 1.2, 1] : 1,
                  }}
                  transition={{
                    duration: 0.3,
                    scale: isWarning ? { duration: 0.8, repeat: Infinity } : undefined,
                  }}
                  style={{ border: "1.5px solid" }}
                />
              )
            })}
            {permits === 0 && (
              <span className="text-[8px] font-mono font-bold ml-1" style={{ color: FIREWOOD_COLORS.compaction }}>
                0
              </span>
            )}
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "15") }} />
        </div>

        {/* Persistence thread lane */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5"
                style={{
                  backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.trie, "bg", "15"),
                  color: FIREWOOD_COLORS.trie,
                  border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.trie, "border", "30")}`,
                }}
              >
                Persist
              </span>
              <span className={`text-[9px] ${colors.textMuted} font-mono`}>disk I/O</span>
            </div>
          </div>
          <motion.div
            className="h-10 flex items-center gap-0.5 px-2 overflow-hidden"
            style={{
              backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.trie, "bg", "08"),
              border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.trie, "border", "20")}`,
            }}
          >
            <AnimatePresence mode="popLayout">
              {persistBlocks.map((block, i) => {
                const isLatest = i === persistBlocks.length - 1
                const isWriting = block.status === "writing"
                return (
                  <motion.div
                    key={`ps-${block.id}`}
                    layout
                    initial={{ scale: 0, x: 20, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: isLatest ? 1 : 0.5 }}
                    exit={{ scale: 0.7, x: -15, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 25 }}
                    className="w-7 h-7 flex-shrink-0 relative overflow-hidden"
                    style={{
                      backgroundColor: isWriting
                        ? lt(colors.stroke, FIREWOOD_COLORS.trie, "bgStrong", "15")
                        : lt(colors.stroke, FIREWOOD_COLORS.trie, "bg", "10"),
                      border: isWriting
                        ? `1.5px solid ${lt(colors.stroke, FIREWOOD_COLORS.trie, "borderStrong", "60")}`
                        : `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.trie, "border", "30")}`,
                    }}
                  >
                    {isWriting && isLatest ? (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0"
                        style={{ backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.trie, "bgStrong", "40") }}
                        initial={{ height: 0 }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 1.5, ease: "linear" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="text-[7px] font-mono font-bold"
                          style={{ color: FIREWOOD_COLORS.trie, opacity: isLatest ? 0.9 : 0.4 }}
                        >
                          {block.id % 100}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div className="flex-1" />
            <span className="text-[8px] font-mono flex-shrink-0" style={{ color: `${FIREWOOD_COLORS.trie}60` }}>
              on-disk
            </span>
          </motion.div>
        </div>
      </div>

      {/* Footer with slider */}
      <div
        className={`flex flex-col gap-2 pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "10")}` }}
      >
        {/* Permit slider */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-[10px] ${colors.textMuted} font-mono`}>
            {MIN_PERMITS}
          </span>
          <input
            type="range"
            min={MIN_PERMITS}
            max={MAX_PERMITS}
            value={maxPermits}
            onChange={e => handleMaxPermitsChange(parseInt(e.target.value, 10))}
            className="flex-1 max-w-[160px] h-1 appearance-none rounded-full cursor-pointer"
            style={{
              background: `${FIREWOOD_COLORS.rust}40`,
              accentColor: FIREWOOD_COLORS.rust,
            }}
          />
          <span className={`text-[10px] ${colors.textMuted} font-mono`}>
            {MAX_PERMITS}
          </span>
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 min-w-[60px] text-center"
            style={{
              backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.rust, "bg", "12"),
              color: FIREWOOD_COLORS.rust,
              border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.rust, "border", "25")}`,
            }}
          >
            N = {maxPermits}
          </span>
        </div>

        {/* Legend */}
        <div className={`flex items-center justify-center gap-4 text-[10px] ${colors.textMuted} font-mono`}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 inline-block" style={{ backgroundColor: FIREWOOD_COLORS.disk }} />
            committed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 inline-block" style={{ backgroundColor: FIREWOOD_COLORS.trie }} />
            persisting
          </span>
        </div>
      </div>
    </div>
  )
}
