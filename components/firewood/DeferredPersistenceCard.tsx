"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"

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
  const [permits, setPermits] = useState<"0/1" | "1/1">("1/1")
  const [persistQueue, setPersistQueue] = useState<number[]>([])

  const commitIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const persistQueueRef = useRef<number[]>([])
  const isPersistingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true

    // Commit thread: fast pace, new block every ~800ms
    const scheduleCommit = () => {
      if (!isMountedRef.current) return

      commitIdRef.current++
      if (commitIdRef.current > 999) commitIdRef.current = 1
      const newId = commitIdRef.current

      setCommitBlocks(prev => [
        ...prev.slice(-7),
        { id: newId, status: "committed" as const },
      ])

      // Queue for persistence
      persistQueueRef.current = [...persistQueueRef.current, newId]
      setPersistQueue([...persistQueueRef.current])

      commitTimeoutRef.current = setTimeout(scheduleCommit, 800 + Math.random() * 200)
    }

    // Persistence thread: slower, processes one block at a time with backpressure
    const schedulePersist = () => {
      if (!isMountedRef.current) return

      if (persistQueueRef.current.length === 0) {
        persistTimeoutRef.current = setTimeout(schedulePersist, 100)
        return
      }

      isPersistingRef.current = true
      setPermits("0/1")

      // Take the latest block (skip intermediate ones — key insight)
      const latestId = persistQueueRef.current[persistQueueRef.current.length - 1]
      persistQueueRef.current = []
      setPersistQueue([])

      // Start writing
      setPersistBlocks(prev => [
        ...prev.slice(-5),
        { id: latestId, status: "writing" as const, progress: 0 },
      ])

      // Complete persistence after ~1.5s
      setTimeout(() => {
        if (!isMountedRef.current) return
        setPersistBlocks(prev =>
          prev.map(b =>
            b.id === latestId
              ? { ...b, status: "persisted" as const, progress: 1 }
              : b
          )
        )
        isPersistingRef.current = false
        setPermits("1/1")

        persistTimeoutRef.current = setTimeout(schedulePersist, 200)
      }, 1500)
    }

    commitTimeoutRef.current = setTimeout(scheduleCommit, 300)
    persistTimeoutRef.current = setTimeout(schedulePersist, 1200)

    return () => {
      isMountedRef.current = false
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current)
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current)
    }
  }, [])

  return (
    <div className={`p-6 h-full flex flex-col col-span-1 md:col-span-2 ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Deferred persistence.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            Commits return instantly. A background thread writes to disk — only the latest revision needs persisting.
          </p>
        </div>
        <InfoTooltip colors={colors} text="When a block commits, the new state is ready in memory immediately — execution doesn't wait for disk I/O. A background thread writes the latest revision to disk on its own schedule. Since each revision captures the full state, only one disk write is needed even if multiple blocks committed in between. A permit system prevents memory from growing unbounded." />
      </div>

      {/* Two lanes with label between */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        {/* Commit thread lane */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <motion.div
              className="w-2 h-2"
              style={{ backgroundColor: FIREWOOD_COLORS.disk }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>
              Commit Thread
            </span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>
              ~800ms/block
            </span>
          </div>
          <motion.div
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            style={{
              backgroundColor: `${FIREWOOD_COLORS.disk}08`,
              border: `1px solid ${FIREWOOD_COLORS.disk}20`,
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
                    className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: isLatest
                        ? `${FIREWOOD_COLORS.disk}25`
                        : `${FIREWOOD_COLORS.disk}10`,
                      border: isLatest
                        ? `1.5px solid ${FIREWOOD_COLORS.disk}60`
                        : `1px solid ${FIREWOOD_COLORS.disk}20`,
                    }}
                  >
                    <motion.svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={FIREWOOD_COLORS.disk}
                      strokeOpacity={isLatest ? 0.9 : 0.4}
                      strokeWidth="3"
                      initial={isLatest ? { scale: 0 } : undefined}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <path d="M5 13l4 4L19 7" />
                    </motion.svg>
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

        {/* Middle label */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="flex-1 h-px" style={{ backgroundColor: `${colors.stroke}15` }} />
          <span className={`text-[9px] ${colors.textMuted} font-mono text-center px-2`}>
            Only latest revision persisted (includes all prior effects)
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: `${colors.stroke}15` }} />
        </div>

        {/* Persistence thread lane */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2"
                style={{ backgroundColor: FIREWOOD_COLORS.trie }}
              />
              <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>
                Persistence Thread
              </span>
              <span className={`text-[9px] ${colors.textMuted} font-mono`}>
                ~1.5s/write
              </span>
            </div>
            <motion.span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5"
              animate={{
                color: permits === "0/1" ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.disk,
                backgroundColor: permits === "0/1"
                  ? `${FIREWOOD_COLORS.compaction}15`
                  : `${FIREWOOD_COLORS.disk}15`,
              }}
              style={{
                border: `1px solid ${permits === "0/1" ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.disk}30`,
              }}
            >
              Permits: {permits}
            </motion.span>
          </div>
          <motion.div
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            style={{
              backgroundColor: `${FIREWOOD_COLORS.trie}08`,
              border: `1px solid ${FIREWOOD_COLORS.trie}20`,
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
                    className="w-6 h-6 flex-shrink-0 relative overflow-hidden"
                    style={{
                      backgroundColor: isWriting
                        ? `${FIREWOOD_COLORS.trie}15`
                        : `${FIREWOOD_COLORS.trie}10`,
                      border: isWriting
                        ? `1.5px solid ${FIREWOOD_COLORS.trie}60`
                        : `1px solid ${FIREWOOD_COLORS.trie}30`,
                    }}
                  >
                    {isWriting && isLatest ? (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0"
                        style={{ backgroundColor: `${FIREWOOD_COLORS.trie}40` }}
                        initial={{ height: 0 }}
                        animate={{ height: "100%" }}
                        transition={{ duration: 1.5, ease: "linear" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={FIREWOOD_COLORS.trie}
                          strokeOpacity={0.6}
                          strokeWidth="3"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
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

      {/* Footer with queue depth */}
      <div
        className={`flex items-center justify-center gap-4 text-[10px] ${colors.textMuted} font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span>
          Queued: {persistQueue.length} revisions
        </span>
        <span>
          Backpressure limit: 1 permit
        </span>
      </div>
    </div>
  )
}
