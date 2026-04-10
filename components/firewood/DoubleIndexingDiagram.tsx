"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Colors, FIREWOOD_COLORS } from "./types"
import { LayerLabel, VerticalFlowArrow, InfoTooltip } from "./shared"

const DOT_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6"]

interface Layer {
  label: string
  sublabel: string
  color?: string
}

const TRADITIONAL_LAYERS: Layer[] = [
  { label: "EVM", sublabel: "SSTORE(key, value)" },
  { label: "Merkle Patricia Trie", sublabel: "Serialize to KV pairs", color: FIREWOOD_COLORS.trie },
  { label: "LevelDB", sublabel: "Re-index in LSM-tree", color: FIREWOOD_COLORS.leveldb },
  { label: "LSM-Tree Levels", sublabel: "L0 \u2192 L1 \u2192 L2", color: FIREWOOD_COLORS.pebble },
  { label: "Disk", sublabel: "Final write", color: FIREWOOD_COLORS.disk },
]

const FIREWOOD_LAYERS: Layer[] = [
  { label: "EVM", sublabel: "SSTORE(key, value)" },
  { label: "Firewood", sublabel: "Trie node at byte offset", color: FIREWOOD_COLORS.firewood },
  { label: "Disk", sublabel: "Direct write", color: FIREWOOD_COLORS.disk },
]

const ARROW_HEIGHT = 20

function LayerStack({
  colors,
  layers,
  activeLayerIndex,
  dotColor,
  label,
  indexCount,
}: {
  colors: Colors
  layers: Layer[]
  activeLayerIndex: number
  dotColor: string
  label: string
  indexCount: number
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`text-[11px] font-mono font-bold uppercase tracking-wider ${colors.text}`}
        >
          {label}
        </span>
      </div>

      <div className="flex flex-col items-center">
        {layers.map((layer, i) => (
          <div key={layer.label} className="flex flex-col items-center">
            <LayerLabel
              colors={colors}
              label={layer.label}
              sublabel={layer.sublabel}
              color={layer.color}
              active={activeLayerIndex === i}
              dotColor={activeLayerIndex === i ? dotColor : undefined}
            />
            {i < layers.length - 1 && (
              <VerticalFlowArrow
                colors={colors}
                height={ARROW_HEIGHT}
                active={activeLayerIndex === i || activeLayerIndex === i + 1}
                color={layer.color}
              />
            )}
          </div>
        ))}
      </div>

      {/* Index counter */}
      <div
        className={`mt-4 px-3 py-1.5 border text-center ${colors.border}`}
        style={{
          backgroundColor: `${colors.stroke}05`,
        }}
      >
        <span className={`text-[9px] font-mono ${colors.textMuted}`}>
          Indices:{" "}
        </span>
        <span
          className="text-[11px] font-mono font-bold"
          style={{
            color: indexCount > 1 ? FIREWOOD_COLORS.compaction : FIREWOOD_COLORS.disk,
          }}
        >
          {indexCount}
        </span>
      </div>
    </div>
  )
}

export function DoubleIndexingDiagram({ colors }: { colors: Colors }) {
  const [traditionalStep, setTraditionalStep] = useState(-1)
  const [firewoodStep, setFirewoodStep] = useState(-1)
  const [dotColor, setDotColor] = useState(DOT_COLORS[0])

  const cycleRef = useRef(0)
  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t))
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay)
    timeoutsRef.current = [...timeoutsRef.current, t]
    return t
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const runCycle = () => {
      if (!isMountedRef.current) return
      clearAllTimeouts()

      const currentColor = DOT_COLORS[cycleRef.current % DOT_COLORS.length]
      setDotColor(currentColor)
      cycleRef.current = cycleRef.current + 1

      // Reset
      setTraditionalStep(-1)
      setFirewoodStep(-1)

      // Start both after short delay
      addTimeout(() => {
        if (!isMountedRef.current) return
        setTraditionalStep(0)
        setFirewoodStep(0)
      }, 400)

      // Traditional path: 5 layers, ~700ms per step
      const traditionalStepDelay = 700
      TRADITIONAL_LAYERS.forEach((_, i) => {
        if (i === 0) return
        addTimeout(() => {
          if (!isMountedRef.current) return
          setTraditionalStep(i)
        }, 400 + i * traditionalStepDelay)
      })

      const traditionalEndTime = 400 + (TRADITIONAL_LAYERS.length - 1) * traditionalStepDelay

      // Firewood path: 3 layers, ~500ms per step (faster)
      const firewoodStepDelay = 500
      FIREWOOD_LAYERS.forEach((_, i) => {
        if (i === 0) return
        addTimeout(() => {
          if (!isMountedRef.current) return
          setFirewoodStep(i)
        }, 400 + i * firewoodStepDelay)
      })

      const firewoodEndTime = 400 + (FIREWOOD_LAYERS.length - 1) * firewoodStepDelay

      // Clear highlights after arriving
      addTimeout(() => {
        if (!isMountedRef.current) return
        setFirewoodStep(-1)
      }, firewoodEndTime + 1000)

      addTimeout(() => {
        if (!isMountedRef.current) return
        setTraditionalStep(-1)
      }, traditionalEndTime + 1000)

      // Schedule next cycle
      const cycleTime = Math.max(traditionalEndTime, firewoodEndTime) + 2000
      addTimeout(() => {
        if (!isMountedRef.current) return
        runCycle()
      }, cycleTime)
    }

    runCycle()

    return () => {
      isMountedRef.current = false
      clearAllTimeouts()
    }
  }, [addTimeout, clearAllTimeouts])

  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Double Indexing
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            Traditional databases flatten the trie into key-value pairs, then build
            a second index on top. Firewood eliminates the redundant layer.
          </p>
        </div>
        <InfoTooltip colors={colors} text="When you call SSTORE, the value goes into a Merkle trie. LevelDB flattens that trie into key-value pairs and builds its own LSM-tree index on top — two separate indices for the same data. Firewood skips the middleman: the trie on disk IS the index." />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <LayerStack
          colors={colors}
          layers={TRADITIONAL_LAYERS}
          activeLayerIndex={traditionalStep}
          dotColor={dotColor}
          label="Traditional"
          indexCount={2}
        />

        <LayerStack
          colors={colors}
          layers={FIREWOOD_LAYERS}
          activeLayerIndex={firewoodStep}
          dotColor={dotColor}
          label="Firewood"
          indexCount={1}
        />
      </div>
    </div>
  )
}
