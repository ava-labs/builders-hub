"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS, lt } from "./types"
import { InfoTooltip } from "./shared"

interface TrieNodeState {
  id: string
  label: string
  status: "active" | "deleting" | "gone"
}

interface DeleteLogEntry {
  id: string
  label: string
  status: "logged" | "recycling" | "done"
}

const INITIAL_TRIE_NODES: TrieNodeState[] = [
  { id: "n1", label: "N1", status: "active" },
  { id: "n2", label: "N2", status: "active" },
  { id: "n3", label: "N3", status: "active" },
  { id: "n4", label: "N4", status: "active" },
  { id: "n5", label: "N5", status: "active" },
]

const NODE_COUNT = 5

function ArrowIndicator({ colors, label }: { colors: Colors; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 gap-0.5">
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
        <path
          d="M2 8H20M20 8L14 3M20 8L14 13"
          stroke={`${colors.stroke}30`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[7px] font-mono leading-none"
        style={{ color: `${colors.stroke}35` }}
      >
        {label}
      </span>
    </div>
  )
}

export function AreaAllocatorCard({ colors }: { colors: Colors }) {
  const [trieNodes, setTrieNodes] = useState<TrieNodeState[]>(INITIAL_TRIE_NODES)
  const [deleteLog, setDeleteLog] = useState<DeleteLogEntry[]>([])
  const [reusedNodes, setReusedNodes] = useState<string[]>([])

  const isMountedRef = useRef(true)
  const cycleIndexRef = useRef(0)
  const nextIdRef = useRef(6)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])
  // Track node labels by position so we never need to read from state
  const nodeLabelsRef = useRef(["N1", "N2", "N3", "N4", "N5"])
  // Track delete log length and labels synchronously to gate recycle phases
  const deleteLogCountRef = useRef(0)
  const deleteLogLabelsRef = useRef<string[]>([])

  const scheduleTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      if (isMountedRef.current) fn()
    }, delay)
    timeoutsRef.current = [...timeoutsRef.current, id]
    return id
  }, [])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id))
    timeoutsRef.current = []
  }, [])

  const runCycle = useCallback(() => {
    if (!isMountedRef.current) return

    const targetPosition = cycleIndexRef.current % NODE_COUNT
    cycleIndexRef.current = cycleIndexRef.current + 1
    const deletedLabel = nodeLabelsRef.current[targetPosition]

    // Phase 1: Mark the node at target position as "deleting" (blue -> orange)
    setTrieNodes(prev =>
      prev.map((n, i) =>
        i === targetPosition && n.status === "active"
          ? { ...n, status: "deleting" as const }
          : n
      )
    )

    // Phase 2: Move to delete log, replace node in trie
    scheduleTimeout(() => {
      const newLabel = `N${nextIdRef.current}`
      nextIdRef.current = nextIdRef.current + 1
      if (nextIdRef.current > 99) nextIdRef.current = 6

      // Update the labels ref
      nodeLabelsRef.current = nodeLabelsRef.current.map((l, i) =>
        i === targetPosition ? newLabel : l
      )

      // Add deleted node to the log
      deleteLogCountRef.current = deleteLogCountRef.current + 1
      deleteLogLabelsRef.current = [...deleteLogLabelsRef.current, deletedLabel]
      const logEntryId = `log-${deletedLabel}-${Date.now()}`
      setDeleteLog(prev => [
        ...prev,
        { id: logEntryId, label: deletedLabel, status: "logged" as const },
      ])

      // Replace deleted node with a new active node
      setTrieNodes(prev =>
        prev.map((n, i) =>
          i === targetPosition
            ? { id: `n-${newLabel}-${Date.now()}`, label: newLabel, status: "active" as const }
            : n
        )
      )

      // Only run recycle phases if the log has enough entries
      const canRecycle = deleteLogCountRef.current >= 2

      if (canRecycle) {
        // Phase 3: Mark oldest as recycling
        scheduleTimeout(() => {
          setDeleteLog(prev => {
            if (prev.length < 2) return prev
            const oldest = prev[0]
            if (oldest.status !== "logged") return prev
            return [
              { ...oldest, status: "recycling" as const },
              ...prev.slice(1),
            ]
          })

          // Phase 4: Mark as done
          scheduleTimeout(() => {
            setDeleteLog(prev => {
              if (prev.length === 0 || prev[0].status !== "recycling") return prev
              return [
                { ...prev[0], status: "done" as const },
                ...prev.slice(1),
              ]
            })

            // Phase 5: Remove from log and show reused indicator
            scheduleTimeout(() => {
              deleteLogCountRef.current = deleteLogCountRef.current - 1
              // Pop the oldest label — this is the node actually being recycled
              const recycledLabel = deleteLogLabelsRef.current[0] ?? deletedLabel
              deleteLogLabelsRef.current = deleteLogLabelsRef.current.slice(1)
              setDeleteLog(prev => {
                if (prev.length === 0 || prev[0].status !== "done") return prev
                return prev.slice(1)
              })
              setReusedNodes(r => [...r, recycledLabel])

              scheduleTimeout(() => {
                setReusedNodes(r => r.slice(1))
              }, 800)

              // Restart cycle
              scheduleTimeout(() => {
                runCycle()
              }, 1000)
            }, 400)
          }, 600)
        }, 700)
      } else {
        // No recycling yet — just restart cycle after a pause
        scheduleTimeout(() => {
          runCycle()
        }, 1700)
      }
    }, 700)
  }, [scheduleTimeout])

  useEffect(() => {
    isMountedRef.current = true
    const startId = setTimeout(() => {
      if (isMountedRef.current) runCycle()
    }, 1200)

    return () => {
      isMountedRef.current = false
      clearTimeout(startId)
      clearAllTimeouts()
    }
  }, [runCycle, clearAllTimeouts])

  const trieBoxColor = (status: TrieNodeState["status"]) => {
    if (status === "deleting") return FIREWOOD_COLORS.fdl
    return FIREWOOD_COLORS.trie
  }

  const trieBoxBg = (status: TrieNodeState["status"]) => {
    if (status === "deleting") return lt(colors.stroke, FIREWOOD_COLORS.fdl, "bg", "18")
    return lt(colors.stroke, FIREWOOD_COLORS.trie, "bg", "18")
  }

  const trieBoxBorder = (status: TrieNodeState["status"]) => {
    if (status === "deleting") return lt(colors.stroke, FIREWOOD_COLORS.fdl, "border", "40")
    return lt(colors.stroke, FIREWOOD_COLORS.trie, "border", "40")
  }

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Delete-log recycling.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            Deleted nodes are added to a delete-log and their space is eventually reused. No compaction needed.
          </p>
        </div>
        <InfoTooltip
          colors={colors}
          text="Space for nodes may be allocated from the end of the file, or from space freed from expired revisions. When revisions expire, their deleted nodes are returned to per-size free lists — algorithmically resembling traditional heap memory management. Each node return is O(1)."
        />
      </div>

      {/* Three-zone flow visualization */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-stretch gap-0 w-full">

          {/* Trie zone */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-wider mb-2"
              style={{ color: FIREWOOD_COLORS.trie }}
            >
              Trie
            </span>
            <div className="flex flex-col gap-1.5 items-center">
              <AnimatePresence mode="popLayout">
                {trieNodes.map(node => (
                  <motion.div
                    key={node.id}
                    layout
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                      opacity: node.status === "gone" ? 0 : 1,
                      scale: node.status === "gone" ? 0.5 : 1,
                      backgroundColor: trieBoxBg(node.status),
                      borderColor: trieBoxBorder(node.status),
                    }}
                    exit={{ opacity: 0, scale: 0.5, x: 20 }}
                    transition={{ duration: 0.4 }}
                    className="w-9 h-7 flex items-center justify-center"
                    style={{
                      border: `1.5px solid ${trieBoxBorder(node.status)}`,
                      backgroundColor: trieBoxBg(node.status),
                    }}
                  >
                    <span
                      className="text-[9px] font-mono font-bold"
                      style={{ color: trieBoxColor(node.status) }}
                    >
                      {node.label}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Arrow: Trie -> Delete Log */}
          <ArrowIndicator colors={colors} label="expire" />

          {/* Delete Log zone */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-wider mb-2"
              style={{ color: FIREWOOD_COLORS.fdl }}
            >
              Delete Log
            </span>
            <div
              className="flex flex-col gap-1.5 items-center w-full min-h-[120px] py-2 px-1"
              style={{
                border: `1px dashed ${lt(colors.stroke, FIREWOOD_COLORS.fdl, "border", "30")}`,
                backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.fdl, "bg", "08"),
              }}
            >
              <AnimatePresence mode="popLayout">
                {deleteLog.map(entry => {
                  const isRecycling = entry.status === "recycling" || entry.status === "done"
                  const entryColor = isRecycling ? FIREWOOD_COLORS.disk : FIREWOOD_COLORS.fdl
                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, x: -15, scale: 0.7 }}
                      animate={{
                        opacity: entry.status === "done" ? 0.5 : 1,
                        x: entry.status === "done" ? 15 : 0,
                        scale: 1,
                        backgroundColor: isRecycling
                          ? lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "20")
                          : lt(colors.stroke, FIREWOOD_COLORS.fdl, "bg", "18"),
                        borderColor: isRecycling
                          ? lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "40")
                          : lt(colors.stroke, FIREWOOD_COLORS.fdl, "border", "40"),
                      }}
                      exit={{ opacity: 0, x: 20, scale: 0.5 }}
                      transition={{ duration: 0.4 }}
                      className="w-9 h-7 flex items-center justify-center"
                      style={{
                        border: `1.5px solid ${
                          isRecycling
                            ? lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "40")
                            : lt(colors.stroke, FIREWOOD_COLORS.fdl, "border", "40")
                        }`,
                        backgroundColor: isRecycling
                          ? lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "20")
                          : lt(colors.stroke, FIREWOOD_COLORS.fdl, "bg", "18"),
                      }}
                    >
                      <span
                        className="text-[9px] font-mono font-bold"
                        style={{ color: entryColor }}
                      >
                        {entry.label}
                      </span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {deleteLog.length === 0 && (
                <span
                  className="text-[8px] font-mono italic mt-auto mb-auto"
                  style={{ color: `${colors.stroke}25` }}
                >
                  empty
                </span>
              )}
            </div>
          </div>

          {/* Arrow: Delete Log -> Reused */}
          <ArrowIndicator colors={colors} label="reclaim" />

          {/* Reused zone */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-wider mb-0.5"
              style={{ color: FIREWOOD_COLORS.disk }}
            >
              Reused
            </span>
            <span
              className={`text-[8px] ${colors.textMuted} font-mono mb-1`}
            >
              O(1) per node
            </span>
            <div className="flex flex-col gap-1.5 items-center min-h-[120px] justify-center">
              <AnimatePresence>
                {reusedNodes.map((label, idx) => (
                  <motion.div
                    key={`reused-${label}-${idx}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.5 }}
                    className="w-9 h-7 flex items-center justify-center"
                    style={{
                      border: `1.5px solid ${lt(colors.stroke, FIREWOOD_COLORS.disk, "border", "50")}`,
                      backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.disk, "bg", "20"),
                    }}
                  >
                    <span
                      className="text-[9px] font-mono font-bold"
                      style={{ color: FIREWOOD_COLORS.disk }}
                    >
                      {label}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {reusedNodes.length === 0 && (
                <div className="flex flex-col items-center gap-1">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 3V5M10 15V17M3 10H5M15 10H17M5.05 5.05L6.46 6.46M13.54 13.54L14.95 14.95M14.95 5.05L13.54 6.46M6.46 13.54L5.05 14.95"
                      stroke={`${colors.stroke}20`}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className="text-[8px] font-mono italic"
                    style={{ color: `${colors.stroke}25` }}
                  >
                    waiting
                  </span>
                </div>
              )}
            </div>
          </div>
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
          active
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 inline-block"
            style={{ backgroundColor: FIREWOOD_COLORS.fdl }}
          />
          in delete-log
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 inline-block"
            style={{ backgroundColor: FIREWOOD_COLORS.disk }}
          />
          reused
        </span>
      </div>
    </div>
  )
}
