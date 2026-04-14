"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS, lt } from "./types"
import { InfoTooltip } from "./shared"

interface Block {
  id: number
  status: "active" | "done"
}

interface FdlMarker {
  id: number
  reclaimed: boolean
}

export function NoCompactionCard({ colors }: { colors: Colors }) {
  const [leveldbBlocks, setLeveldbBlocks] = useState<Block[]>([])
  const [firewoodBlocks, setFirewoodBlocks] = useState<Block[]>([])
  const [fdlMarkers, setFdlMarkers] = useState<FdlMarker[]>([])
  const [isCompacting, setIsCompacting] = useState(false)
  const [leveldbLatency, setLeveldbLatency] = useState<"steady" | "spiking">("steady")

  const leveldbIdRef = useRef(0)
  const firewoodIdRef = useRef(0)
  const fdlIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const leveldbTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const firewoodTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const compactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const compactionCycleRef = useRef<NodeJS.Timeout | null>(null)
  const reclaimTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    const isCompactingRef = { current: false }

    // LevelDB lane: generate blocks, pause during compaction
    const scheduleLeveldb = () => {
      if (!isMountedRef.current) return

      if (isCompactingRef.current) {
        leveldbTimeoutRef.current = setTimeout(scheduleLeveldb, 200)
        return
      }

      leveldbIdRef.current++
      if (leveldbIdRef.current > 999) leveldbIdRef.current = 1
      const newId = leveldbIdRef.current

      setLeveldbBlocks(prev => [
        ...prev.slice(-9),
        { id: newId, status: "active" as const },
      ])

      // Mark previous block as done
      setTimeout(() => {
        if (!isMountedRef.current) return
        setLeveldbBlocks(prev =>
          prev.map(b => b.id === newId ? { ...b, status: "done" as const } : b)
        )
      }, 300)

      leveldbTimeoutRef.current = setTimeout(scheduleLeveldb, 700 + Math.random() * 200)
    }

    // Firewood lane: steady block generation, never interrupted
    const scheduleFirewood = () => {
      if (!isMountedRef.current) return

      firewoodIdRef.current++
      if (firewoodIdRef.current > 999) firewoodIdRef.current = 1
      const newId = firewoodIdRef.current

      setFirewoodBlocks(prev => [
        ...prev.slice(-9),
        { id: newId, status: "active" as const },
      ])

      // FDL marker on ~30% of blocks
      if (Math.random() < 0.3) {
        fdlIdRef.current++
        const markerId = fdlIdRef.current
        setFdlMarkers(prev => [
          ...prev.slice(-5),
          { id: markerId, reclaimed: false },
        ])

        // Occasionally reclaim an old marker
        reclaimTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          setFdlMarkers(prev => {
            const unreclaimedIdx = prev.findIndex(m => !m.reclaimed)
            if (unreclaimedIdx === -1) return prev
            return prev.map((m, i) =>
              i === unreclaimedIdx ? { ...m, reclaimed: true } : m
            )
          })
        }, 1500 + Math.random() * 1000)
      }

      setTimeout(() => {
        if (!isMountedRef.current) return
        setFirewoodBlocks(prev =>
          prev.map(b => b.id === newId ? { ...b, status: "done" as const } : b)
        )
      }, 300)

      firewoodTimeoutRef.current = setTimeout(scheduleFirewood, 700 + Math.random() * 200)
    }

    // Compaction cycle: every ~6s, trigger compaction for ~2s
    const scheduleCompaction = () => {
      if (!isMountedRef.current) return

      isCompactingRef.current = true
      setIsCompacting(true)
      setLeveldbLatency("spiking")

      compactionTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return
        isCompactingRef.current = false
        setIsCompacting(false)
        setLeveldbLatency("steady")

        compactionCycleRef.current = setTimeout(scheduleCompaction, 6000)
      }, 2000)
    }

    leveldbTimeoutRef.current = setTimeout(scheduleLeveldb, 400)
    firewoodTimeoutRef.current = setTimeout(scheduleFirewood, 400)
    compactionCycleRef.current = setTimeout(scheduleCompaction, 5000)

    return () => {
      isMountedRef.current = false
      if (leveldbTimeoutRef.current) clearTimeout(leveldbTimeoutRef.current)
      if (firewoodTimeoutRef.current) clearTimeout(firewoodTimeoutRef.current)
      if (compactionTimeoutRef.current) clearTimeout(compactionTimeoutRef.current)
      if (compactionCycleRef.current) clearTimeout(compactionCycleRef.current)
      if (reclaimTimeoutRef.current) clearTimeout(reclaimTimeoutRef.current)
    }
  }, [])

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            No compaction. Ever.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            LevelDB compaction runs in the background, but under load it creates backpressure that stalls writes and spikes latency. Firewood reclaims space inline via a Future-Delete Log.
          </p>
        </div>
        <InfoTooltip colors={colors} text="LevelDB stores data in sorted tables that periodically need merging (compaction). During heavy traffic this can stall writes and spike your block processing latency. Firewood never compacts — when old revisions expire, their disk space goes straight back to a free list. No pauses, no jitter." />
      </div>

      {/* Two parallel lanes */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* LevelDB lane */}
        <div>
          <div className="flex items-center justify-between mb-1.5 h-6">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2"
                animate={{
                  backgroundColor: isCompacting ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.leveldb,
                }}
                transition={{ duration: 0.15 }}
              />
              <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>LevelDB</span>
              <AnimatePresence>
                {isCompacting && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5"
                    style={{
                      backgroundColor: `${FIREWOOD_COLORS.compaction}20`,
                      color: FIREWOOD_COLORS.compaction,
                      border: `1px solid ${FIREWOOD_COLORS.compaction}40`,
                    }}
                  >
                    WRITE STALL
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <motion.span
              className="text-[10px] font-mono font-bold"
              animate={{
                color: isCompacting ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.leveldb,
              }}
              key={leveldbLatency}
            >
              {leveldbLatency === "spiking" ? "latency spike" : "steady"}
            </motion.span>
          </div>
          <motion.div
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            animate={{
              backgroundColor: isCompacting
                ? lt(colors.stroke, FIREWOOD_COLORS.compaction, "bg", "12")
                : lt(colors.stroke, FIREWOOD_COLORS.leveldb, "bg", "08"),
              borderColor: isCompacting
                ? lt(colors.stroke, FIREWOOD_COLORS.compaction, "border", "40")
                : lt(colors.stroke, FIREWOOD_COLORS.leveldb, "border", "20"),
            }}
            transition={{ duration: 0.2 }}
            style={{ border: "1px solid" }}
          >
            <AnimatePresence mode="popLayout">
              {leveldbBlocks.map(block => (
                <motion.div
                  key={`ldb-${block.id}`}
                  layout
                  initial={{ scale: 0, x: 20, opacity: 0 }}
                  animate={{
                    scale: 1,
                    x: 0,
                    opacity: block.status === "active" ? 1 : 0.5,
                  }}
                  exit={{ scale: 0.7, x: -15, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 25 }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: block.status === "active"
                      ? lt(colors.stroke, FIREWOOD_COLORS.leveldb, "bgStrong", "25")
                      : lt(colors.stroke, FIREWOOD_COLORS.leveldb, "bg", "10"),
                    border: block.status === "active"
                      ? `1.5px solid ${lt(colors.stroke, FIREWOOD_COLORS.leveldb, "borderStrong", "50")}`
                      : `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.leveldb, "border", "20")}`,
                  }}
                >
                  {block.status === "done" ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_COLORS.leveldb} strokeOpacity={0.4} strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: FIREWOOD_COLORS.leveldb }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex-1" />
            <span className="text-[9px] font-mono flex-shrink-0 opacity-40" style={{ color: FIREWOOD_COLORS.leveldb }}>
              {isCompacting ? "||" : "\u2192"}
            </span>
          </motion.div>
        </div>

        {/* Firewood lane */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2"
                style={{ backgroundColor: FIREWOOD_COLORS.rust }}
              />
              <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>Firewood (FDL)</span>
            </div>
            <span
              className="text-[10px] font-mono font-bold"
              style={{ color: FIREWOOD_COLORS.disk }}
            >
              always steady
            </span>
          </div>
          <motion.div
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            style={{
              backgroundColor: lt(colors.stroke, FIREWOOD_COLORS.rust, "bg", "08"),
              border: `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.rust, "border", "20")}`,
            }}
          >
            <AnimatePresence mode="popLayout">
              {firewoodBlocks.map(block => (
                <motion.div
                  key={`fw-${block.id}`}
                  layout
                  initial={{ scale: 0, x: 20, opacity: 0 }}
                  animate={{
                    scale: 1,
                    x: 0,
                    opacity: block.status === "active" ? 1 : 0.5,
                  }}
                  exit={{ scale: 0.7, x: -15, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 25 }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center relative"
                  style={{
                    backgroundColor: block.status === "active"
                      ? lt(colors.stroke, FIREWOOD_COLORS.rust, "bgStrong", "25")
                      : lt(colors.stroke, FIREWOOD_COLORS.rust, "bg", "10"),
                    border: block.status === "active"
                      ? `1.5px solid ${lt(colors.stroke, FIREWOOD_COLORS.rust, "borderStrong", "50")}`
                      : `1px solid ${lt(colors.stroke, FIREWOOD_COLORS.rust, "border", "20")}`,
                  }}
                >
                  {block.status === "done" ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_COLORS.rust} strokeOpacity={0.4} strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: FIREWOOD_COLORS.rust }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* FDL markers */}
            <AnimatePresence>
              {fdlMarkers.map(marker => (
                <motion.div
                  key={`fdl-${marker.id}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: marker.reclaimed ? 0.3 : 0.8,
                    backgroundColor: marker.reclaimed ? FIREWOOD_COLORS.disk : FIREWOOD_COLORS.fdl,
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="w-2 h-2 rounded-full flex-shrink-0"
                />
              ))}
            </AnimatePresence>

            <div className="flex-1" />
            <span className="text-[9px] font-mono flex-shrink-0 opacity-40" style={{ color: FIREWOOD_COLORS.rust }}>
              {"\u2192"}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Footer legend */}
      <div
        className={`flex items-center justify-center gap-4 text-[10px] ${colors.textMuted} font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: FIREWOOD_COLORS.fdl }} />
          FDL entry
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: FIREWOOD_COLORS.disk }} />
          reclaimed
        </span>
      </div>
    </div>
  )
}
