"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { HorizontalFlowArrow } from "./shared"

interface Stage {
  id: string
  label: string
  isFirewood: boolean
}

const STAGES: Stage[] = [
  { id: "consensus", label: "Consensus", isFirewood: false },
  { id: "queue", label: "Execution Queue", isFirewood: false },
  { id: "executor", label: "Block Executor", isFirewood: false },
  { id: "strevm", label: "StreVM", isFirewood: false },
  { id: "firewood", label: "Firewood", isFirewood: true },
  { id: "disk", label: "Disk", isFirewood: false },
]

const CALLOUTS = [
  "No compaction pauses",
  "Native trie I/O",
  "Parallel hashing",
]

const STAGE_DURATION = 500
const CALLOUT_DISPLAY_MS = 1200

export function PipelineIntegration({ colors }: { colors: Colors }) {
  const [activeStageIndex, setActiveStageIndex] = useState(-1)
  const [showCallouts, setShowCallouts] = useState(false)
  const [isFirewoodHovered, setIsFirewoodHovered] = useState(false)
  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay)
    timeoutsRef.current = [...timeoutsRef.current, id]
    return id
  }, [])

  const runCycle = useCallback(() => {
    if (!isMountedRef.current) return

    clearAllTimeouts()

    STAGES.forEach((_, i) => {
      addTimeout(() => {
        if (!isMountedRef.current) return
        setActiveStageIndex(i)

        // Show callouts when reaching the Firewood stage
        if (STAGES[i].isFirewood) {
          setShowCallouts(true)
          addTimeout(() => {
            if (!isMountedRef.current) return
            setShowCallouts(false)
          }, CALLOUT_DISPLAY_MS)
        }
      }, i * STAGE_DURATION)
    })

    // Reset after full cycle
    addTimeout(() => {
      if (!isMountedRef.current) return
      setActiveStageIndex(-1)
      setShowCallouts(false)

      // Start next cycle
      addTimeout(() => {
        if (!isMountedRef.current) return
        runCycle()
      }, 600)
    }, STAGES.length * STAGE_DURATION + CALLOUT_DISPLAY_MS)
  }, [clearAllTimeouts, addTimeout])

  useEffect(() => {
    isMountedRef.current = true
    const startDelay = setTimeout(() => {
      if (isMountedRef.current) {
        runCycle()
      }
    }, 800)

    return () => {
      isMountedRef.current = false
      clearTimeout(startDelay)
      clearAllTimeouts()
    }
  }, [runCycle, clearAllTimeouts])

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg} border ${colors.border}`}>
      <h3
        className={`text-sm sm:text-base font-mono font-bold ${colors.text} mb-1`}
      >
        Where Firewood fits.
      </h3>
      <p className={`text-xs ${colors.textMuted} font-mono mb-6`}>
        Firewood is the storage layer for StreVM, Avalanche&apos;s Streaming Async Execution engine.
      </p>

      {/* Pipeline diagram */}
      <div className="flex-1 flex items-center justify-center py-4 pb-20 relative">
        <div className="flex items-center gap-0 flex-wrap justify-center sm:flex-nowrap">
          {STAGES.map((stage, i) => {
            const isActive = activeStageIndex === i
            const isPast = activeStageIndex > i

            return (
              <div key={stage.id} className="flex items-center">
                {/* Stage box */}
                <div className="relative flex flex-col items-center">
                  <div
                    className="px-2 sm:px-3 py-2 sm:py-2.5 border text-center transition-colors duration-200"
                    style={{
                      borderColor: stage.isFirewood
                        ? FIREWOOD_COLORS.rust
                        : isActive
                          ? `${colors.stroke}60`
                          : `${colors.stroke}20`,
                      borderWidth: stage.isFirewood ? 2 : 1,
                      backgroundColor: isActive
                        ? stage.isFirewood
                          ? `${FIREWOOD_COLORS.rust}20`
                          : `${colors.stroke}10`
                        : stage.isFirewood
                          ? (isFirewoodHovered ? `${FIREWOOD_COLORS.rust}20` : `${FIREWOOD_COLORS.rust}08`)
                          : `${colors.stroke}05`,
                      cursor: stage.isFirewood ? "pointer" : "default",
                    }}
                    onMouseEnter={stage.isFirewood ? () => setIsFirewoodHovered(true) : undefined}
                    onMouseLeave={stage.isFirewood ? () => setIsFirewoodHovered(false) : undefined}
                  >
                    {/* Traveling dot */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full"
                          style={{
                            width: 8,
                            height: 8,
                            backgroundColor: stage.isFirewood
                              ? FIREWOOD_COLORS.rust
                              : colors.stroke,
                          }}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        />
                      )}
                    </AnimatePresence>

                    <span
                      className="text-[7px] sm:text-[9px] font-mono font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{
                        color: stage.isFirewood
                          ? FIREWOOD_COLORS.rust
                          : isActive
                            ? `${colors.stroke}90`
                            : isPast
                              ? `${colors.stroke}60`
                              : `${colors.stroke}50`,
                      }}
                    >
                      {stage.label}
                    </span>
                  </div>

                  {/* Callouts for Firewood stage — show on animation or hover */}
                  <AnimatePresence>
                    {stage.isFirewood && (showCallouts || isFirewoodHovered) && (
                      <motion.div
                        className="absolute top-full mt-3 flex flex-col items-center gap-1 z-10"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        {CALLOUTS.map((callout, ci) => (
                          <motion.div
                            key={callout}
                            className="px-2 py-0.5 whitespace-nowrap"
                            style={{
                              backgroundColor: `${FIREWOOD_COLORS.rust}15`,
                              border: `1px solid ${FIREWOOD_COLORS.rust}30`,
                            }}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: ci * 0.1, duration: 0.15 }}
                          >
                            <span
                              className="text-[7px] sm:text-[9px] font-mono"
                              style={{ color: FIREWOOD_COLORS.rust }}
                            >
                              {callout}
                            </span>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Arrow between stages */}
                {i < STAGES.length - 1 && (
                  <HorizontalFlowArrow
                    colors={colors}
                    width={20}
                    active={activeStageIndex > i}
                    color={
                      STAGES[i + 1].isFirewood
                        ? FIREWOOD_COLORS.rust
                        : undefined
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
