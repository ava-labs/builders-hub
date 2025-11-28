"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Types
type Colors = {
  bg: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  borderStrong: string
  stroke: string
  blockBg: string
  blockSolid: string
  blockFaint: string
  blockBgStrong: string
}

// Vibrant transaction colors - matching main animation
const TX_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
]

function getRandomTxColors(count: number): string[] {
  return Array.from({ length: count }, () => TX_COLORS[Math.floor(Math.random() * TX_COLORS.length)])
}

// Config - using same values as main animation
const SAE_CONFIG = {
  consensusInterval: 1500,
  executionTime: 5000,
}

const MAX_TX = 16

// 4x4 Block component matching main animation with colorful txs
function Block({
  colors,
  txCount = MAX_TX,
  txColors,
  size = "sm",
}: {
  colors: Colors
  txCount?: number
  txColors?: string[]
  size?: "sm" | "md" | "xs"
}) {
  const sizeMap = {
    sm: { box: 28, txSize: 4, gap: 1, padding: 2 },
    md: { box: 36, txSize: 6, gap: 1, padding: 3 },
    xs: { box: 20, txSize: 2, gap: 0.5, padding: 1 },
  }
  const s = sizeMap[size]

  return (
    <div
      className={`relative border ${colors.border}`}
      style={{
        width: s.box,
        height: s.box,
        backgroundColor: `${colors.stroke}10`,
      }}
    >
      <div className="absolute inset-0 grid grid-cols-4" style={{ padding: s.padding, gap: s.gap }}>
        {[...Array(MAX_TX)].map((_, i) => (
          <div
            key={i}
            style={{
              width: s.txSize,
              height: s.txSize,
              backgroundColor: i < txCount 
                ? (txColors?.[i] || `${colors.stroke}40`)
                : `${colors.stroke}10`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function AssemblyLineAnimation({ colors }: { colors: Colors }) {
  const [incomingBlock, setIncomingBlock] = useState<{
    id: number
    txCount: number
    txColors: string[]
    phase: "entering" | "accepted"
  } | null>(null)
  const [beltBlocks, setBeltBlocks] = useState<{ id: number; txCount: number; txColors: string[]; progress: number; addedAt: number }[]>([])
  const [executingBlocks, setExecutingBlocks] = useState<{ id: number; txCount: number; txColors: string[] }[]>([])
  const [settledBatches, setSettledBatches] = useState<
    {
      id: number
      blocks: { id: number; txCount: number; txColors: string[] }[]
      progress: number
      addedAt: number
    }[]
  >([])
  const [isProcessing, setIsProcessing] = useState(false)
  const blockIdRef = useRef(0)
  const batchIdRef = useRef(0)
  const lastTimeRef = useRef(Date.now())
  const lastExecutionRef = useRef(0)

  const beltWidth = 400
  const blockSize = 36
  const blockGap = 6
  const maxBeltBlocks = 8
  const beltTravelTime = 6500 // Sped up from 7500ms
  const settledTravelTime = 3000
  const settledBeltWidth = 240
  const beltLineSpacing = beltWidth / 8
  const maxTravel = beltWidth - blockSize - 16 // 276px - actual distance blocks travel
  const beltLineDuration = (beltTravelTime / 1000) * (beltLineSpacing / maxTravel) // Time to move one spacing at block speed

  // Reset animation state when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset all state to start fresh
        setIncomingBlock(null)
        setBeltBlocks([])
        setExecutingBlocks([])
        setSettledBatches([])
        setIsProcessing(false)
        lastExecutionRef.current = 0
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    let animationId: number

    const animate = () => {
      const now = Date.now()

      // Update belt blocks progress - LINEAR movement (removed easing)
      setBeltBlocks((prev) =>
        prev.map((b) => ({
          ...b,
          progress: Math.min(1, (now - b.addedAt) / beltTravelTime),
        })),
      )

      // Update settled batches progress - LINEAR movement
      setSettledBatches((prev) =>
        prev
          .map((b) => ({
            ...b,
            progress: Math.min(1, (now - b.addedAt) / settledTravelTime),
          }))
          .filter((b) => b.progress < 1),
      )

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const newId = blockIdRef.current++
      const txCount = Math.floor(Math.random() * 9) + 8
      const txColors = getRandomTxColors(txCount)

      setIncomingBlock({ id: newId, txCount, txColors, phase: "entering" })

      setTimeout(() => {
        setIncomingBlock((prev) => (prev ? { ...prev, phase: "accepted" } : null))
      }, 500)

      setTimeout(() => {
        setIncomingBlock(null)
        setBeltBlocks((prev) => {
          if (prev.length >= maxBeltBlocks) return prev
          return [{ id: newId, txCount, txColors, progress: 0, addedAt: Date.now() }, ...prev]
        })
      }, 1000)
    }, SAE_CONFIG.consensusInterval)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isProcessing) return
    if (beltBlocks.length < 1) return

    const oldestBlock = beltBlocks[beltBlocks.length - 1]
    const queueFull = beltBlocks.length >= maxBeltBlocks
    const oldestReady = oldestBlock.progress >= 0.8

    // Execute if queue is full OR oldest block is ready
    if (!queueFull && !oldestReady) return

    const now = Date.now()
    const minInterval = 2500
    if (now - lastExecutionRef.current < minInterval) return
    lastExecutionRef.current = now

    const maxTake = Math.min(beltBlocks.length, 4)
    const toTake = Math.max(1, Math.floor(Math.random() * maxTake) + 1)
    const blocksToTake = beltBlocks.slice(-toTake)
    const idsToTake = new Set(blocksToTake.map((b) => b.id))

    setBeltBlocks((prev) => prev.filter((b) => !idsToTake.has(b.id)))
    setExecutingBlocks(blocksToTake.map((b) => ({ id: b.id, txCount: b.txCount, txColors: b.txColors })))
    setIsProcessing(true)

    setTimeout(() => {
      setSettledBatches((prevBatches) => {
        const newBatch = {
          id: batchIdRef.current++,
          blocks: blocksToTake.map((b) => ({ id: b.id, txCount: b.txCount, txColors: b.txColors })),
          progress: 0, // start at 0
          addedAt: Date.now(),
        }
        return [...prevBatches, newBatch]
      })
      setExecutingBlocks([])
      setIsProcessing(false)
    }, 1500)
  }, [isProcessing, beltBlocks])

  return (
    <div className={`w-full py-8 ${colors.bg}`}>
      {/* Assembly Line */}
      <div className="flex items-center justify-center gap-1">
        {/* Consensus Box */}
        <div
          className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center`}
          style={{ width: 100, height: 90, minWidth: 100 }}
        >
          <div
            className={`absolute top-1 left-0 right-0 text-center text-[8px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}
          >
            Consensus
          </div>

          <AnimatePresence mode="wait">
            {incomingBlock && (
              <motion.div
                key={incomingBlock.id}
                className="relative"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Block colors={colors} txCount={incomingBlock.txCount} txColors={incomingBlock.txColors} size="md" />
                {/* Checkmark when accepted */}
                <AnimatePresence>
                  {incomingBlock.phase === "accepted" && (
                    <motion.div
                      className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: colors.bg, border: `1px solid ${colors.stroke}` }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <motion.path
                          d="M2 5 L4 7 L8 3"
                          stroke={colors.stroke}
                          strokeWidth="1.5"
                          fill="none"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Output arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>

        {/* Conveyor Belt (FIFO Queue) */}
        <div
          className={`relative border ${colors.border} ${colors.blockBg} overflow-hidden`}
          style={{ width: beltWidth, height: 80, minWidth: beltWidth }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  backgroundColor: colors.stroke + "20",
                  left: (i - 2) * beltLineSpacing,
                }}
                animate={{
                  x: [0, beltLineSpacing],
                }}
                transition={{
                  duration: beltLineDuration,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                  repeatType: "loop",
                }}
              />
            ))}
          </div>

          {/* Belt label */}
          <div
            className={`absolute top-1 left-0 right-0 text-center text-[8px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}
          >
            FIFO Queue
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2" style={{ height: blockSize }}>
            <AnimatePresence>
              {beltBlocks.map((block, index) => {
                const basePos = block.progress * beltWidth
                const indexFromRight = beltBlocks.length - 1 - index
                const stackOffset = indexFromRight * (blockSize + blockGap)
                const xPos = Math.min(basePos, beltWidth - blockSize - stackOffset)

                return (
                  <motion.div
                    key={block.id}
                    className="absolute top-0"
                    style={{ left: xPos }}
                    initial={{ x: -blockSize, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <Block colors={colors} txCount={block.txCount} txColors={block.txColors} size="md" />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Execution Box */}
        <div
          className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center`}
          style={{ width: 150, height: 90, minWidth: 150 }}
        >
          {/* Input arrow */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <div
            className={`absolute top-1 left-0 right-0 text-center text-[8px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}
          >
            Execution
          </div>

          <AnimatePresence mode="popLayout">
            {executingBlocks.length > 0 && (
              <motion.div
                key="executing"
                className="flex flex-wrap gap-0.5 items-center justify-center p-1"
                initial={{ x: -30, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {executingBlocks.map((block) => (
                  <Block key={block.id} colors={colors} txCount={block.txCount} txColors={block.txColors} size="xs" />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          {isProcessing && (
            <motion.div
              className="absolute bottom-2 left-2 right-2 h-1 overflow-hidden rounded-full"
              style={{ backgroundColor: colors.stroke + "20" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: colors.stroke }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "linear" }}
              />
            </motion.div>
          )}

          {/* Output arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>

        {/* Settled Conveyor Belt */}
        <div
          className={`relative border ${colors.border} ${colors.blockBg} overflow-hidden`}
          style={{ width: settledBeltWidth, height: 80, minWidth: settledBeltWidth }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  backgroundColor: colors.stroke + "20",
                  left: `${(i * 100) / 8}%`,
                }}
                animate={{
                  x: [0, settledBeltWidth / 8],
                }}
                transition={{
                  duration: settledTravelTime / 1000,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* Belt label */}
          <div
            className={`absolute top-1 left-0 right-0 text-center text-[8px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}
          >
            Settled
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2" style={{ height: blockSize }}>
            <AnimatePresence>
              {settledBatches.map((batch) => {
                // Fixed travel distance for consistent speed regardless of batch size
                const fixedMaxTravel = settledBeltWidth - 60
                const xPos = batch.progress * fixedMaxTravel

                return (
                  <motion.div
                    key={batch.id}
                    className="absolute flex gap-0.5 p-1.5 top-0"
                    style={{
                      left: xPos,
                      backgroundColor: colors.stroke + "08",
                    }}
                    initial={{ x: -20, opacity: 0, scale: 0.8 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Pulsing secure border */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ border: `2px solid #22c55e` }}
                      animate={{ 
                        opacity: [0.3, 0.7, 0.3],
                        boxShadow: [
                          '0 0 0px rgba(34, 197, 94, 0)',
                          '0 0 6px rgba(34, 197, 94, 0.4)',
                          '0 0 0px rgba(34, 197, 94, 0)',
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    
                    {batch.blocks.map((block) => (
                      <Block key={block.id} colors={colors} txCount={block.txCount} txColors={block.txColors} size="md" />
                    ))}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AssemblyLineCard({ colors }: { colors: Colors }) {
  return (
    <div className="py-8 md:py-12">
      {/* Separator line */}
      <div className={`flex items-center mb-8`}>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      {/* Header - matching main title style */}
      <div className="text-center mb-6">
        <h2 className={`text-base sm:text-xl md:text-2xl font-medium ${colors.text} uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-3 font-mono`}>
          Assembly Lines, but for Blockchains!
        </h2>
        <p className={`text-[10px] sm:text-xs ${colors.textMuted} font-mono uppercase tracking-[0.1em]`}>
          Blockchain go vroom!
        </p>
      </div>
      
      {/* Animation */}
      <AssemblyLineAnimation colors={colors} />
      
      {/* Description underneath */}
      <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider text-center`}>
        Faster block acceptance • Saturated execution • Instant receipts
      </p>
    </div>
  )
}

export function LeanExecutionSection({ colors }: { colors: Colors }) {
  return (
    <div className={`border ${colors.border} p-8 ${colors.blockBg}`}>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-8">
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
        <span className={`text-[11px] uppercase tracking-[0.2em] ${colors.textFaint} font-mono`}>LEAN EXECUTION</span>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      <div className="grid grid-cols-2 gap-12">
        {/* Left side - headline */}
        <div className="flex flex-col justify-center">
          <h3 className={`text-2xl font-mono uppercase tracking-[0.1em] ${colors.text} mb-3`}>
            RESULTS WITHOUT THE BAGGAGE.
          </h3>
          <p className={`text-sm font-mono uppercase tracking-[0.1em] ${colors.textMuted}`}>LEAN EXECUTION CLIENTS</p>
        </div>

        {/* Right side - bullet points */}
        <div>
          <h4 className={`text-lg font-mono uppercase tracking-[0.1em] ${colors.text} mb-4`}>LEAFING MERKLE BEHIND</h4>
          <ul className={`space-y-2 ${colors.textMuted} font-mono text-sm uppercase tracking-[0.05em]`}>
            <li className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 mt-1.5 ${colors.blockSolid}`} />
              <span>Merkle trees are great for consensus and verification</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 mt-1.5 ${colors.blockSolid}`} />
              <span>{"But if you don't need the root, don't grow the tree!"}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className={`w-1.5 h-1.5 mt-1.5 ${colors.blockSolid}`} />
              <span>Trust the node? See the future:</span>
            </li>
            <li className="flex items-start gap-2 ml-4">
              <span className={`w-1 h-1 mt-1.5 rounded-full border ${colors.border}`} />
              <span>Explorers</span>
            </li>
            <li className="flex items-start gap-2 ml-4">
              <span className={`w-1 h-1 mt-1.5 rounded-full border ${colors.border}`} />
              <span>Custodians</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
