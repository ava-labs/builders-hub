"use client"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"

const NUM_POINTS = 36
const TICK_MS = 300

// Chart dimensions (each chart is half-width)
const CW = 230
const CH = 160
const M = { top: 6, right: 6, bottom: 20, left: 44 }
const PW = CW - M.left - M.right
const PH = CH - M.top - M.bottom

// Firewood latency: nearly constant
const FW_BASE = 0.18
const FW_JITTER = 0.02

function toPolyline(points: readonly number[], pw: number, ph: number, ml: number, mt: number, n: number): string {
  if (points.length < 2) return ""
  const sx = pw / (n - 1)
  return points.map((y, i) => `${(ml + i * sx).toFixed(1)},${(mt + ph * (1 - y)).toFixed(1)}`).join(" ")
}

function toCumPolyline(
  points: readonly number[],
  pw: number, ph: number, ml: number, mt: number, n: number,
  minV: number, rangeV: number,
): string {
  if (points.length < 2 || rangeV === 0) return ""
  const sx = pw / (n - 1)
  return points.map((v, i) => {
    const norm = (v - minV) / rangeV
    return `${(ml + i * sx).toFixed(1)},${(mt + ph * (1 - norm)).toFixed(1)}`
  }).join(" ")
}

export function NoCompactionCard({ colors }: { colors: Colors }) {
  // Per-block latency data (left chart)
  const [fwLat, setFwLat] = useState<readonly number[]>([])
  const [ldbLat, setLdbLat] = useState<readonly number[]>([])
  // Cumulative throughput data (right chart)
  const [fwCum, setFwCum] = useState<readonly number[]>([])
  const [ldbCum, setLdbCum] = useState<readonly number[]>([])

  const [isCompacting, setIsCompacting] = useState(false)

  const spikeActiveRef = useRef(0)
  const spikeCooldownRef = useRef(0)
  const fwTotalRef = useRef(0)
  const ldbTotalRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    // Seed client-side only (Math.random → no SSR hydration mismatch)
    const iFwLat: number[] = []
    const iLdbLat: number[] = []
    const iFwCum: number[] = []
    const iLdbCum: number[] = []
    for (let i = 0; i < NUM_POINTS; i = i + 1) {
      iFwLat.push(FW_BASE + (Math.random() - 0.5) * FW_JITTER * 2)
      iLdbLat.push(0.20 + (Math.random() - 0.5) * 0.10)
      fwTotalRef.current = fwTotalRef.current + 1
      ldbTotalRef.current = ldbTotalRef.current + 1 + (Math.random() - 0.5) * 0.3
      iFwCum.push(fwTotalRef.current)
      iLdbCum.push(ldbTotalRef.current)
    }
    setFwLat(iFwLat)
    setLdbLat(iLdbLat)
    setFwCum(iFwCum)
    setLdbCum(iLdbCum)

    const interval = setInterval(() => {
      if (!isMountedRef.current) return

      // --- Shared spike state machine ---
      // Capture compacting state BEFORE decrementing (keeps badge in sync with data)
      const compacting = spikeActiveRef.current > 0

      let latLdb: number
      let cumIncrement: number

      if (compacting) {
        latLdb = 0.65 + Math.random() * 0.25
        cumIncrement = Math.random() * 0.1
        spikeActiveRef.current = spikeActiveRef.current - 1
      } else if (spikeCooldownRef.current > 0) {
        const decay = spikeCooldownRef.current / 8
        latLdb = 0.20 + decay * 0.12 + (Math.random() - 0.5) * 0.08
        cumIncrement = 1.3 + Math.random() * 0.3
        spikeCooldownRef.current = spikeCooldownRef.current - 1
      } else if (Math.random() < 0.10) {
        spikeActiveRef.current = 3 + Math.floor(Math.random() * 4)
        spikeCooldownRef.current = 8
        latLdb = 0.70 + Math.random() * 0.20
        cumIncrement = 0.05
      } else {
        latLdb = 0.20 + (Math.random() - 0.5) * 0.10
        cumIncrement = 1 + (Math.random() - 0.5) * 0.3
      }

      const latFw = FW_BASE + (Math.random() - 0.5) * FW_JITTER * 2
      fwTotalRef.current = fwTotalRef.current + 1
      ldbTotalRef.current = ldbTotalRef.current + cumIncrement

      // Also flag as compacting when a NEW spike just started this tick
      setIsCompacting(compacting || spikeActiveRef.current > 0)
      setFwLat(prev => [...prev.slice(-(NUM_POINTS - 1)), latFw])
      setLdbLat(prev => [...prev.slice(-(NUM_POINTS - 1)), latLdb])
      setFwCum(prev => [...prev.slice(-(NUM_POINTS - 1)), fwTotalRef.current])
      setLdbCum(prev => [...prev.slice(-(NUM_POINTS - 1)), ldbTotalRef.current])
    }, TICK_MS)

    return () => {
      isMountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  // Latest values for leading dots
  const latFwLast = fwLat.length > 0 ? fwLat[fwLat.length - 1] : FW_BASE
  const latLdbLast = ldbLat.length > 0 ? ldbLat[ldbLat.length - 1] : 0.20

  // Normalize cumulative chart to visible window
  const allCum = [...fwCum, ...ldbCum]
  const cumMin = allCum.length > 0 ? Math.min(...allCum) : 0
  const cumMax = allCum.length > 0 ? Math.max(...allCum) : 1
  const cumRange = cumMax - cumMin || 1

  const cumFwLast = fwCum.length > 0 ? (fwCum[fwCum.length - 1] - cumMin) / cumRange : 0.5
  const cumLdbLast = ldbCum.length > 0 ? (ldbCum[ldbCum.length - 1] - cumMin) / cumRange : 0.5

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            No compaction. Ever.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            LevelDB compaction creates backpressure that stalls writes and spikes latency. Firewood reclaims space inline via a Future-Delete Log — constant write performance.
          </p>
        </div>
        <InfoTooltip colors={colors} text="LevelDB stores data in sorted tables that periodically need merging (compaction). During heavy traffic this can stall writes and spike your block processing latency. Firewood never compacts — when old revisions expire, their disk space goes straight back to a free list. No pauses, no jitter." />
      </div>

      {/* COMPACTION badge — centered above both charts */}
      <div className="flex items-center justify-end h-5 mb-1">
        <motion.span
          animate={{ opacity: isCompacting ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[9px] font-mono font-bold px-1.5 py-0.5"
          style={{
            backgroundColor: `${FIREWOOD_COLORS.compaction}20`,
            color: FIREWOOD_COLORS.compaction,
            border: `1px solid ${FIREWOOD_COLORS.compaction}40`,
          }}
        >
          COMPACTION
        </motion.span>
      </div>

      {/* Dual charts: side by side on desktop, single chart on mobile */}
      <div className="flex-1 flex gap-2">
        {/* Left chart: Write Latency */}
        <div className="flex-1 min-w-0 flex flex-col">
          <span className={`text-[9px] font-mono uppercase tracking-wider ${colors.textMuted} mb-1 text-center`}>
            Latency per block
          </span>
          <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full flex-1">
            <text x={16} y={M.top + PH / 2} fontSize="6" fontFamily="monospace" fill={`${colors.stroke}30`} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90, 16, ${M.top + PH / 2})`}>
              Write Latency
            </text>
            <text x={M.left + PW / 2} y={CH - 3} fontSize="6" fontFamily="monospace" fill={`${colors.stroke}28`} textAnchor="middle">
              Blocks
            </text>
            <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + PH} stroke={`${colors.stroke}10`} />
            <line x1={M.left} y1={M.top + PH} x2={M.left + PW} y2={M.top + PH} stroke={`${colors.stroke}10`} />
            {[0.33, 0.66].map(f => (
              <line key={f} x1={M.left} y1={M.top + PH * (1 - f)} x2={M.left + PW} y2={M.top + PH * (1 - f)} stroke={`${colors.stroke}08`} strokeDasharray="3 6" />
            ))}
            {ldbLat.length > 1 && (
              <polyline points={toPolyline(ldbLat, PW, PH, M.left, M.top, NUM_POINTS)} fill="none" stroke={FIREWOOD_COLORS.leveldb} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {fwLat.length > 1 && (
              <polyline points={toPolyline(fwLat, PW, PH, M.left, M.top, NUM_POINTS)} fill="none" stroke={FIREWOOD_COLORS.rust} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {fwLat.length > 0 && (
              <circle cx={M.left + PW} cy={M.top + PH * (1 - latFwLast)} r={2.5} fill={FIREWOOD_COLORS.rust}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            {ldbLat.length > 0 && (
              <circle cx={M.left + PW} cy={M.top + PH * (1 - latLdbLast)} r={3} fill={isCompacting ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.leveldb}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px self-stretch my-2" style={{ backgroundColor: `${colors.stroke}10` }} />

        {/* Right chart: Block Production (cumulative throughput) — hidden on mobile */}
        <div className="hidden sm:flex flex-1 min-w-0 flex-col">
          <span className={`text-[9px] font-mono uppercase tracking-wider ${colors.textMuted} mb-1 text-center`}>
            Cumulative throughput
          </span>
          <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full flex-1">
            <text x={16} y={M.top + PH / 2} fontSize="6" fontFamily="monospace" fill={`${colors.stroke}30`} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90, 16, ${M.top + PH / 2})`}>
              Blocks Committed
            </text>
            <text x={M.left + PW / 2} y={CH - 3} fontSize="6" fontFamily="monospace" fill={`${colors.stroke}28`} textAnchor="middle">
              Time
            </text>
            <line x1={M.left} y1={M.top} x2={M.left} y2={M.top + PH} stroke={`${colors.stroke}10`} />
            <line x1={M.left} y1={M.top + PH} x2={M.left + PW} y2={M.top + PH} stroke={`${colors.stroke}10`} />
            {[0.33, 0.66].map(f => (
              <line key={f} x1={M.left} y1={M.top + PH * (1 - f)} x2={M.left + PW} y2={M.top + PH * (1 - f)} stroke={`${colors.stroke}08`} strokeDasharray="3 6" />
            ))}
            {ldbCum.length > 1 && (
              <polyline points={toCumPolyline(ldbCum, PW, PH, M.left, M.top, NUM_POINTS, cumMin, cumRange)} fill="none" stroke={FIREWOOD_COLORS.leveldb} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {fwCum.length > 1 && (
              <polyline points={toCumPolyline(fwCum, PW, PH, M.left, M.top, NUM_POINTS, cumMin, cumRange)} fill="none" stroke={FIREWOOD_COLORS.rust} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {fwCum.length > 0 && (
              <circle cx={M.left + PW} cy={M.top + PH * (1 - cumFwLast)} r={2.5} fill={FIREWOOD_COLORS.rust}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
            {ldbCum.length > 0 && (
              <circle cx={M.left + PW} cy={M.top + PH * (1 - cumLdbLast)} r={3} fill={isCompacting ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.leveldb}>
                <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div
        className={`flex items-center justify-center gap-5 text-[10px] ${colors.textMuted} font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[1.5px] inline-block rounded-full" style={{ backgroundColor: FIREWOOD_COLORS.rust }} />
          Firewood
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[1px] inline-block rounded-full" style={{ backgroundColor: FIREWOOD_COLORS.leveldb }} />
          LevelDB
        </span>
      </div>
    </div>
  )
}
