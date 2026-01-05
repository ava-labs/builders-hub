"use client"
import { useEffect, useState, useRef } from "react"
import { motion } from "framer-motion"
import { Colors } from "./types"

// Simpler, smoother animation approach using fixed slots
const SLOT_COUNT = 8
const LEVEL_COUNT = 4

interface SlotData {
  filled: boolean
  color: string
  id: number
}

// ============================================================================
// LEVELDB SIDE
// ============================================================================

function LevelDBSide({ colors, tick }: { colors: Colors; tick: number }) {
  const [memtable, setMemtable] = useState<SlotData[]>(
    Array(4).fill(null).map((_, i) => ({ filled: false, color: '', id: i }))
  )
  const [levels, setLevels] = useState<SlotData[][]>(
    Array(LEVEL_COUNT).fill(null).map((_, lvl) =>
      Array(SLOT_COUNT).fill(null).map((_, i) => ({ filled: false, color: '', id: lvl * 100 + i }))
    )
  )
  const [isCompacting, setIsCompacting] = useState(false)
  const [compactionProgress, setCompactionProgress] = useState(0)
  const [completedOps, setCompletedOps] = useState(0)
  const writeQueue = useRef<string[]>([])
  const tickRef = useRef(0)

  // Color palette for writes
  const getColor = (idx: number) => {
    const colors = ['#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6']
    return colors[idx % colors.length]
  }

  // Add writes to queue on each tick
  useEffect(() => {
    if (tick > tickRef.current) {
      tickRef.current = tick
      writeQueue.current.push(getColor(tick))
    }
  }, [tick])

  // Process queue - writes go to memtable
  useEffect(() => {
    if (isCompacting || writeQueue.current.length === 0) return

    const interval = setInterval(() => {
      if (writeQueue.current.length === 0 || isCompacting) {
        clearInterval(interval)
        return
      }

      const color = writeQueue.current.shift()!

      setMemtable(prev => {
        const emptyIdx = prev.findIndex(s => !s.filled)
        if (emptyIdx === -1) return prev
        const next = [...prev]
        next[emptyIdx] = { ...next[emptyIdx], filled: true, color }
        return next
      })

      setCompletedOps(c => c + 1)
    }, isCompacting ? 500 : 180)

    return () => clearInterval(interval)
  }, [isCompacting, tick])

  // Flush memtable to L0 when full
  useEffect(() => {
    const filledCount = memtable.filter(s => s.filled).length
    if (filledCount >= 4 && !isCompacting) {
      // Move to L0
      setLevels(prev => {
        const newLevels = prev.map(l => [...l])
        const l0Empty = newLevels[0].findIndex(s => !s.filled)
        if (l0Empty !== -1) {
          memtable.filter(s => s.filled).forEach((slot, i) => {
            if (l0Empty + i < SLOT_COUNT) {
              newLevels[0][l0Empty + i] = { ...slot, filled: true }
            }
          })
        }
        return newLevels
      })
      setMemtable(prev => prev.map(s => ({ ...s, filled: false, color: '' })))
    }
  }, [memtable, isCompacting])

  // Trigger compaction when L0 is full
  useEffect(() => {
    const l0Filled = levels[0].filter(s => s.filled).length
    if (l0Filled >= 6 && !isCompacting) {
      setIsCompacting(true)
      setCompactionProgress(0)

      // Animate compaction
      let progress = 0
      const compactInterval = setInterval(() => {
        progress += 0.04
        setCompactionProgress(Math.min(progress, 1))

        if (progress >= 1) {
          clearInterval(compactInterval)
          // Complete compaction - clear L0, add some to L1
          setLevels(prev => {
            const newLevels = prev.map(l => [...l])
            // Move L0 data to L1
            const l0Data = newLevels[0].filter(s => s.filled)
            newLevels[0] = newLevels[0].map(s => ({ ...s, filled: false, color: '' }))

            const l1Empty = newLevels[1].findIndex(s => !s.filled)
            l0Data.slice(0, 4).forEach((slot, i) => {
              if (l1Empty + i < SLOT_COUNT) {
                newLevels[1][l1Empty + i] = { ...slot, filled: true }
              }
            })
            return newLevels
          })
          setIsCompacting(false)
          setCompactionProgress(0)
        }
      }, 80)
    }
  }, [levels, isCompacting])

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold font-mono" style={{ color: '#dc2626' }}>
          LevelDB
        </h3>
        <span className="text-xs font-mono" style={{ color: '#dc2626' }}>
          {completedOps} ops
        </span>
      </div>

      <div
        className="relative p-4 rounded-sm"
        style={{
          backgroundColor: isCompacting ? 'rgba(220, 38, 38, 0.08)' : 'rgba(120, 80, 40, 0.05)',
          border: isCompacting ? '2px solid rgba(220, 38, 38, 0.4)' : '1px solid rgba(120, 80, 40, 0.2)',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Compaction overlay */}
        {isCompacting && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-sm"
            style={{ backgroundColor: 'rgba(30, 20, 10, 0.85)' }}
          >
            <div
              className="w-10 h-10 border-3 rounded-full mb-3 animate-spin"
              style={{
                borderColor: 'rgba(220, 38, 38, 0.3)',
                borderTopColor: '#dc2626'
              }}
            />
            <span className="text-xs font-mono text-white uppercase tracking-wider mb-2">
              Compacting...
            </span>
            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ backgroundColor: '#dc2626', width: `${compactionProgress * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono mt-2" style={{ color: '#fca5a5' }}>
              Writes blocked
            </span>
          </div>
        )}

        {/* MemTable */}
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: 'rgba(180, 140, 100, 0.7)' }}>
            MemTable
          </div>
          <div className="flex gap-1.5">
            {memtable.map((slot, i) => (
              <div
                key={slot.id}
                className="w-7 h-7 rounded-sm transition-all duration-200"
                style={{
                  backgroundColor: slot.filled ? slot.color : 'rgba(120, 80, 40, 0.1)',
                  border: slot.filled ? 'none' : '1px dashed rgba(120, 80, 40, 0.3)',
                  transform: slot.filled ? 'scale(1)' : 'scale(0.9)',
                  opacity: slot.filled ? 1 : 0.5
                }}
              />
            ))}
          </div>
        </div>

        {/* LSM Levels */}
        <div className="space-y-2">
          {levels.map((level, lvlIdx) => (
            <div key={lvlIdx} className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono w-5"
                style={{ color: isCompacting && lvlIdx === 0 ? '#dc2626' : 'rgba(180, 140, 100, 0.6)' }}
              >
                L{lvlIdx}
              </span>
              <div className="flex gap-1 flex-1">
                {level.map((slot) => (
                  <div
                    key={slot.id}
                    className="w-5 h-5 rounded-sm transition-all duration-200"
                    style={{
                      backgroundColor: slot.filled ? slot.color : 'rgba(120, 80, 40, 0.08)',
                      border: slot.filled ? 'none' : '1px dashed rgba(120, 80, 40, 0.15)',
                      opacity: isCompacting && lvlIdx === 0 ? 0.4 : (slot.filled ? 1 : 0.3),
                      transform: slot.filled ? 'scale(1)' : 'scale(0.85)'
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(120, 80, 40, 0.15)' }}>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: isCompacting ? '#dc2626' : '#22c55e',
              boxShadow: isCompacting ? '0 0 8px #dc2626' : 'none'
            }}
          />
          <span className="text-[10px] font-mono" style={{ color: isCompacting ? '#dc2626' : 'rgba(180, 140, 100, 0.7)' }}>
            {isCompacting ? 'BLOCKED' : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// FIREWOOD SIDE
// ============================================================================

function FirewoodSide({ colors, tick }: { colors: Colors; tick: number }) {
  const [nodes, setNodes] = useState<SlotData[]>(
    Array(12).fill(null).map((_, i) => ({
      filled: i < 3,
      color: i < 3 ? '#22c55e' : '',
      id: i
    }))
  )
  const [freeList, setFreeList] = useState<number[]>([])
  const [completedOps, setCompletedOps] = useState(0)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const tickRef = useRef(0)

  const getColor = (idx: number) => {
    const colors = ['#22c55e', '#10b981', '#059669', '#047857', '#14b8a6', '#0d9488']
    return colors[idx % colors.length]
  }

  // Process writes immediately - no blocking!
  useEffect(() => {
    if (tick > tickRef.current) {
      tickRef.current = tick

      // Find slot to write to (prefer free list, then next empty)
      const targetSlot = freeList.length > 0
        ? freeList[0]
        : nodes.findIndex(n => !n.filled)

      if (targetSlot !== -1 && targetSlot < 12) {
        setActiveSlot(targetSlot)

        setTimeout(() => {
          setNodes(prev => {
            const next = [...prev]
            next[targetSlot] = { ...next[targetSlot], filled: true, color: getColor(tick) }
            return next
          })
          setFreeList(prev => prev.slice(1))
          setCompletedOps(c => c + 1)
          setActiveSlot(null)
        }, 60) // Fast writes!
      }
    }
  }, [tick, freeList, nodes])

  // Occasionally "free" old nodes to show free list working
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => {
        const filledCount = prev.filter(n => n.filled).length
        if (filledCount > 6) {
          // Free a random filled slot (not the first 3 - they're "root" nodes)
          const filledIndices = prev.map((n, i) => n.filled && i > 2 ? i : -1).filter(i => i !== -1)
          if (filledIndices.length > 0) {
            const toFree = filledIndices[Math.floor(Math.random() * filledIndices.length)]
            setFreeList(fl => [...fl, toFree].slice(-3))
            const next = [...prev]
            next[toFree] = { ...next[toFree], filled: false, color: '' }
            return next
          }
        }
        return prev
      })
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold font-mono" style={{ color: '#16a34a' }}>
          Firewood
        </h3>
        <span className="text-xs font-mono" style={{ color: '#16a34a' }}>
          {completedOps} ops
        </span>
      </div>

      <div
        className="relative p-4 rounded-sm"
        style={{
          backgroundColor: activeSlot !== null ? 'rgba(22, 163, 74, 0.08)' : 'rgba(120, 80, 40, 0.05)',
          border: activeSlot !== null ? '2px solid rgba(22, 163, 74, 0.4)' : '1px solid rgba(120, 80, 40, 0.2)',
          transition: 'all 0.15s ease'
        }}
      >
        {/* Trie nodes on disk */}
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: 'rgba(180, 140, 100, 0.7)' }}>
            Trie Nodes (Direct Disk)
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {nodes.map((node, i) => (
              <div
                key={node.id}
                className="w-7 h-7 rounded-sm flex items-center justify-center transition-all duration-150"
                style={{
                  backgroundColor: node.filled ? node.color : 'rgba(120, 80, 40, 0.08)',
                  border: node.filled ? 'none' : '1px dashed rgba(120, 80, 40, 0.2)',
                  transform: activeSlot === i ? 'scale(1.15)' : (node.filled ? 'scale(1)' : 'scale(0.9)'),
                  boxShadow: activeSlot === i ? '0 0 12px rgba(22, 163, 74, 0.6)' : 'none',
                  opacity: node.filled ? 1 : 0.4
                }}
              >
                {node.filled && i < 3 && (
                  <span className="text-[8px] font-mono text-white/80">
                    {i === 0 ? 'R' : 'B'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Free list */}
        <div className="mb-4">
          <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: 'rgba(180, 140, 100, 0.7)' }}>
            Free List
          </div>
          <div className="flex gap-1.5 min-h-[28px] items-center">
            {freeList.length > 0 ? freeList.map((addr, i) => (
              <div
                key={`free-${addr}-${i}`}
                className="w-6 h-6 rounded-sm flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(120, 80, 40, 0.1)',
                  border: '1px dashed rgba(22, 163, 74, 0.4)'
                }}
              >
                <span className="text-[9px] font-mono" style={{ color: 'rgba(180, 140, 100, 0.6)' }}>
                  {addr}
                </span>
              </div>
            )) : (
              <span className="text-[10px] font-mono" style={{ color: 'rgba(180, 140, 100, 0.4)' }}>
                (empty - all space in use)
              </span>
            )}
          </div>
        </div>

        {/* No compaction badge */}
        <div
          className="p-2.5 rounded-sm text-center"
          style={{
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            border: '1px solid rgba(22, 163, 74, 0.3)'
          }}
        >
          <span className="text-[11px] font-mono" style={{ color: '#16a34a' }}>
            ✓ Zero compaction overhead
          </span>
        </div>

        {/* Status */}
        <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(120, 80, 40, 0.15)' }}>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#22c55e' }}
          />
          <span className="text-[10px] font-mono" style={{ color: 'rgba(180, 140, 100, 0.7)' }}>
            Always ready
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DatabaseRace({ colors }: { colors: Colors }) {
  const [tick, setTick] = useState(0)

  // Generate ticks for both sides
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(180, 140, 100, 0.9)' }}>
          Write Stress Test
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'rgba(180, 140, 100, 0.5)' }}>
          same workload → different results
        </span>
      </div>

      {/* Main container with wood-inspired styling */}
      <div
        className="p-3 rounded-sm"
        style={{
          backgroundColor: 'rgba(120, 80, 40, 0.03)',
          border: '1px solid rgba(120, 80, 40, 0.2)',
        }}
      >
        {/* Incoming writes indicator */}
        <div className="mb-4 flex items-center justify-center gap-3 py-2 rounded-sm" style={{ backgroundColor: 'rgba(120, 80, 40, 0.05)' }}>
          <span className="text-[10px] font-mono uppercase" style={{ color: 'rgba(180, 140, 100, 0.6)' }}>
            Incoming
          </span>
          <div className="flex gap-1">
            {Array(6).fill(null).map((_, i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: ['#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6'][i] }}
                animate={{
                  y: [0, -4, 0],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>

        {/* Side by side */}
        <div
          className="p-4 rounded-sm"
          style={{
            backgroundColor: 'rgba(120, 80, 40, 0.04)',
            boxShadow: 'inset 0 2px 8px rgba(120, 80, 40, 0.1)',
          }}
        >
          <div className="flex gap-6">
            <LevelDBSide colors={colors} tick={tick} />

            {/* Divider */}
            <div
              className="w-px self-stretch"
              style={{ backgroundColor: 'rgba(120, 80, 40, 0.2)' }}
            />

            <FirewoodSide colors={colors} tick={tick} />
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-6 px-1">
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(180, 140, 100, 0.8)' }}>
          <span className="font-semibold" style={{ color: '#dc2626' }}>LevelDB</span> accumulates writes in memory, then periodically blocks everything to compact and merge levels.
          <span className="font-semibold" style={{ color: '#16a34a' }}> Firewood</span> writes trie nodes directly to disk at their address — no compaction, no blocking, predictable latency.
        </p>
      </div>
    </div>
  )
}
