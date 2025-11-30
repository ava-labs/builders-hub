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
  settled = false,
}: {
  colors: Colors
  txCount?: number
  txColors?: string[]
  size?: "sm" | "md" | "xs"
  settled?: boolean
}) {
  const sizeMap = {
    sm: { box: 28, txSize: 4, gap: 1, padding: 2 },
    md: { box: 36, txSize: 6, gap: 1, padding: 3 },
    xs: { box: 20, txSize: 2, gap: 0.5, padding: 1 },
  }
  const s = sizeMap[size]

  return (
    <div
      className="relative"
      style={{
        width: s.box,
        height: s.box,
        backgroundColor: settled ? `rgba(34, 197, 94, 0.15)` : `${colors.stroke}10`,
        border: settled ? `1px solid #22c55e` : `1px solid ${colors.stroke}20`,
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

// Executing block with animated disappearing txs
function ExecutingBlock({
  colors,
  blockId,
  txCount = MAX_TX,
  txColors,
  processedIndices,
}: {
  colors: Colors
  blockId: number
  txCount?: number
  txColors?: string[]
  processedIndices: Set<string>
}) {
  const s = { box: 20, txSize: 2, gap: 0.5, padding: 1 } // xs size

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
        {[...Array(MAX_TX)].map((_, i) => {
          const isProcessed = processedIndices.has(`${blockId}-${i}`)
          const hasTx = i < txCount
          
          return (
            <AnimatePresence key={i} mode="popLayout">
              {hasTx && !isProcessed ? (
                <motion.div
                  key={`tx-${i}`}
                  style={{
                    width: s.txSize,
                    height: s.txSize,
                    backgroundColor: txColors?.[i] || `${colors.stroke}40`,
                  }}
                  exit={{ 
                    opacity: 0,
                    scale: 0,
                    y: -8,
                    x: 4,
                  }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              ) : (
                <div
                  key={`empty-${i}`}
                  style={{
                    width: s.txSize,
                    height: s.txSize,
                    backgroundColor: `${colors.stroke}10`,
                  }}
                />
              )}
            </AnimatePresence>
          )
        })}
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
  const [smokeParticles, setSmokeParticles] = useState<{ id: number; color: string; x: number }[]>([])
  const [processedTxIndices, setProcessedTxIndices] = useState<Set<string>>(new Set()) // "blockId-txIndex"
  const blockIdRef = useRef(0)
  const lastBlockCreationTime = useRef(0)
  const smokeIdRef = useRef(0)
  const batchIdRef = useRef(0)

  const beltWidth = 400
  const blockSize = 36
  const blockGap = 6
  const maxBeltBlocks = 8
  const beltTravelTime = 3500 // Faster belt
  const settledTravelTime = 2000
  const settledBeltWidth = 240
  const beltLineSpacing = beltWidth / 8
  // Belt lines move at same speed as blocks: beltWidth / beltTravelTime
  const beltLineDuration = beltTravelTime / 1000 / 8 // Time to move one spacing at block speed
  // Settled belt: batches travel fixedMaxTravel (180px) in settledTravelTime
  const settledLineSpacing = settledBeltWidth / 8 // 30px
  const settledMaxTravel = settledBeltWidth - 60 // 180px - matches fixedMaxTravel in render
  const settledLineDuration = (settledLineSpacing / settledMaxTravel) * (settledTravelTime / 1000)

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
        setProcessedTxIndices(new Set())
        processingBlocksRef.current = new Set()
        activeIntervalsRef.current.forEach(i => clearInterval(i))
        activeIntervalsRef.current = []
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

  // Random consensus interval - generates blocks at varying speeds
  useEffect(() => {
    const animationDuration = 600 // Time for entering + accepted animation
    const allTimeouts: NodeJS.Timeout[] = [] // Track ALL timeouts for proper cleanup
    let isMounted = true
    
    const scheduleNextBlock = () => {
      // Sporadic intervals: minimum must be > animation duration to prevent overwrites
      const randomInterval = Math.random() < 0.3 
        ? 900 + Math.random() * 300   // 30% chance: fast (900-1200ms)
        : 1400 + Math.random() * 1000 // 70% chance: slower (1400-2400ms)
      
      const outerTimeout = setTimeout(() => {
        if (!isMounted) return
        
        const now = Date.now()
        // Guard against StrictMode double-execution (must be at least 200ms apart)
        if (now - lastBlockCreationTime.current < 200) return
        lastBlockCreationTime.current = now
        
        const newId = ++blockIdRef.current // Pre-increment so first block is 1
        const txCount = Math.floor(Math.random() * 9) + 8
        const txColors = getRandomTxColors(txCount)

        setIncomingBlock({ id: newId, txCount, txColors, phase: "entering" })

        const phaseTimeout = setTimeout(() => {
          if (!isMounted) return
          setIncomingBlock((prev) => (prev && prev.id === newId ? { ...prev, phase: "accepted" } : prev))
        }, 300)
        allTimeouts.push(phaseTimeout)

        const beltTimeout = setTimeout(() => {
          if (!isMounted) return
          setIncomingBlock((prev) => (prev && prev.id === newId ? null : prev))
          setBeltBlocks((prev) => {
            if (prev.length >= maxBeltBlocks) return prev
            // Check if this block is already on the belt
            if (prev.some(b => b.id === newId)) return prev
            return [{ id: newId, txCount, txColors, progress: 0, addedAt: Date.now() }, ...prev]
          })
        }, animationDuration)
        allTimeouts.push(beltTimeout)
        
        // Schedule next block
        scheduleNextBlock()
      }, randomInterval)
      
      allTimeouts.push(outerTimeout)
    }
    
    scheduleNextBlock()
    
    return () => {
      isMounted = false
      allTimeouts.forEach(t => clearTimeout(t))
    }
  }, [])

  // Track which blocks we've started processing and their intervals
  const processingBlocksRef = useRef<Set<number>>(new Set())
  const activeIntervalsRef = useRef<NodeJS.Timeout[]>([])
  const currentProcessingBlockRef = useRef<number | null>(null)
  
  // Emit smoke particles - process txs ONE BLOCK AT A TIME (wait for previous to finish)
  useEffect(() => {
    if (!isProcessing || executingBlocks.length === 0) return
    
    // If we're currently processing a block, wait for it to finish
    if (currentProcessingBlockRef.current !== null) {
      const currentBlock = executingBlocks.find(b => b.id === currentProcessingBlockRef.current)
      if (currentBlock) {
        // Check if current block is done (all its txs processed)
        const allProcessed = currentBlock.txColors.every((_, idx) => 
          processedTxIndices.has(`${currentBlock.id}-${idx}`)
        )
        if (!allProcessed) return // Still processing, wait
      }
      // Current block is done, clear it
      currentProcessingBlockRef.current = null
    }
    
    // Find next block to process (first unprocessed block in order)
    const nextBlock = executingBlocks.find(b => !processingBlocksRef.current.has(b.id))
    if (!nextBlock) return
    
    // Mark this block as being processed
    processingBlocksRef.current.add(nextBlock.id)
    currentProcessingBlockRef.current = nextBlock.id
    
    // Build tx list for this block only
    const txsToProcess = nextBlock.txColors.map((color, idx) => ({
      blockId: nextBlock.id,
      txIndex: idx,
      color
    }))
    
    if (txsToProcess.length === 0) return
    
    // Emit at fixed interval (~80ms per tx)
    const emitInterval = 80
    let currentIndex = 0
    
    const emitParticle = () => {
      if (currentIndex >= txsToProcess.length) {
        // Done with this block - clear interval
        clearInterval(interval)
        return
      }
      
      const tx = txsToProcess[currentIndex]
      const key = `${tx.blockId}-${tx.txIndex}`
      
      // Mark as processed
      setProcessedTxIndices(prev => new Set([...prev, key]))
      
      const id = smokeIdRef.current++
      const x = Math.random() * 16 - 8
      setSmokeParticles(prev => [...prev, { id, color: tx.color, x }])
      
      // Remove particle after animation
      setTimeout(() => {
        setSmokeParticles(prev => prev.filter(p => p.id !== id))
      }, 1600)
      
      currentIndex++
    }
    
    // Start emitting - store interval in ref so it doesn't get cleared by effect cleanup
    emitParticle()
    const interval = setInterval(emitParticle, emitInterval)
    activeIntervalsRef.current.push(interval)
    
    // No cleanup - intervals self-terminate when done
  }, [isProcessing, executingBlocks, processedTxIndices])

  // Move blocks that reach end of belt into execution - they join whatever is already executing
  useEffect(() => {
    // Find blocks that are close to the end - get "sucked in" to execution (streaming feel)
    const readyBlocks = beltBlocks.filter(b => b.progress >= 0.80)
    
    if (readyBlocks.length === 0) return
    
    const idsToTake = new Set(readyBlocks.map(b => b.id))
    const blocksToAdd = readyBlocks.map(b => ({ id: b.id, txCount: b.txCount, txColors: b.txColors }))
    
    // Remove from belt and add to executing (joins any ongoing execution)
    setBeltBlocks(prev => prev.filter(b => !idsToTake.has(b.id)))
    setExecutingBlocks(prev => [...prev, ...blocksToAdd])
    
    // Start processing if not already
    if (!isProcessing) {
      setIsProcessing(true)
    }
  }, [beltBlocks, isProcessing])
  
  // Check if all txs are processed, then spit out all blocks together
  useEffect(() => {
    if (!isProcessing || executingBlocks.length === 0) return
    
    // Count total txs and processed txs
    const totalTxs = executingBlocks.reduce((sum, b) => sum + b.txColors.length, 0)
    let processedCount = 0
    executingBlocks.forEach(block => {
      block.txColors.forEach((_, idx) => {
        if (processedTxIndices.has(`${block.id}-${idx}`)) {
          processedCount++
        }
      })
    })
    
    // All txs processed - spit out all blocks
    if (processedCount >= totalTxs) {
      // Small delay for visual effect
      const timeout = setTimeout(() => {
        // Move all executing blocks to settled as one batch
        setSettledBatches(prevBatches => {
          const newBatch = {
            id: batchIdRef.current++,
            blocks: executingBlocks.map(b => ({ id: b.id, txCount: b.txCount, txColors: b.txColors })),
            progress: 0,
            addedAt: Date.now(),
          }
          return [...prevBatches, newBatch]
        })
        
        setExecutingBlocks([])
        setProcessedTxIndices(new Set())
        processingBlocksRef.current = new Set()
        // Clear any remaining intervals
        activeIntervalsRef.current.forEach(i => clearInterval(i))
        activeIntervalsRef.current = []
        setIsProcessing(false)
      }, 200)
      
      return () => clearTimeout(timeout)
    }
  }, [isProcessing, executingBlocks, processedTxIndices])

  return (
    <div className={`w-full py-2 md:py-8 ${colors.bg}`}>
      {/* Assembly Line - scales down on mobile */}
      <div className="flex items-center justify-center gap-1" style={{ minWidth: 900 }}>
        {/* Consensus Box */}
        <motion.div
          className={`relative ${colors.blockBg} flex items-center justify-center`}
          style={{ 
            width: 100, 
            height: 90, 
            minWidth: 100,
            border: incomingBlock?.phase === "accepted" ? "1.5px solid #22c55e" : `1px solid ${colors.stroke}30`,
          }}
          animate={incomingBlock?.phase === "accepted" 
            ? { x: 0, y: 0, rotate: 0 }
            : {
                x: [0, -1, 1, -0.5, 0.5, 0],
                y: [0, 0.5, -0.5, 0.3, -0.3, 0],
              }
          }
          transition={{
            duration: 0.25,
            repeat: incomingBlock?.phase === "accepted" ? 0 : Infinity,
            repeatType: "loop",
            ease: "easeInOut",
          }}
        >
          {/* Intake funnel on left */}
          <div className="absolute -left-[42px] top-1/2 -translate-y-1/2 z-10">
            {/* Bigger cone with small pipe */}
            <svg width="42" height="50" viewBox="0 0 42 50">
              {/* Wide cone opening */}
              <path 
                d="M0 0 L30 17 L30 33 L0 50 Z" 
                fill={colors.stroke + "08"} 
                stroke={colors.stroke + "25"} 
                strokeWidth="1"
              />
              {/* Small pipe connector */}
              <rect 
                x="30" 
                y="19" 
                width="12" 
                height="12" 
                fill={colors.stroke + "05"} 
                stroke={colors.stroke + "25"} 
                strokeWidth="1"
              />
              {/* Inner depth lines */}
              <line x1="5" y1="8" x2="28" y2="19" stroke={colors.stroke + "12"} strokeWidth="0.5" />
              <line x1="5" y1="42" x2="28" y2="31" stroke={colors.stroke + "12"} strokeWidth="0.5" />
            </svg>

            {/* Incoming transaction dots - suction effect toward cone center */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              // Spread dots vertically, they'll converge toward center (y=25)
              const startY = 5 + (i % 5) * 8
              const targetY = 25 - startY // How much to move toward center
              return (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    width: 4,
                    height: 4,
                    backgroundColor: TX_COLORS[i % TX_COLORS.length],
                    left: -40 - (i % 4) * 6,
                    top: startY,
                  }}
                  animate={{
                    x: [0, 8, 28],
                    y: [0, targetY * 0.3, targetY * 0.7],
                    opacity: [0, 0.9, 0.6, 0],
                    scale: [0.5, 1, 0.7, 0.2],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: [0.4, 0, 0.8, 1], // Accelerating ease
                    delay: i * 0.14,
                    times: [0, 0.2, 0.7, 1],
                  }}
                />
              )
            })}
            
            {/* Fast streaking dots for speed effect */}
            {[0, 1, 2, 3, 4].map((i) => {
              const startY = 10 + (i % 3) * 10
              return (
                <motion.div
                  key={`streak-${i}`}
                  className="absolute"
                  style={{
                    width: 6,
                    height: 3,
                    backgroundColor: TX_COLORS[(i + 3) % TX_COLORS.length],
                    borderRadius: "3px 1px 1px 3px",
                    left: -35,
                    top: startY,
                  }}
                  animate={{
                    x: [0, 30],
                    y: [0, (25 - startY) * 0.5],
                    opacity: [0, 0.7, 0],
                    scaleX: [0.5, 1.5, 0.3],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: [0.5, 0, 1, 1],
                    delay: 0.5 + i * 0.28,
                  }}
                />
              )
            })}
          </div>

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
                initial={{ x: -40, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ 
                  x: 60, 
                  opacity: 0, 
                  scale: 0.7,
                  transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Block colors={colors} txCount={incomingBlock.txCount} txColors={incomingBlock.txColors} size="md" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Output arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </motion.div>

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

          <div className="absolute top-[28%] -translate-y-1/2 left-2 right-2" style={{ height: blockSize }}>
            <AnimatePresence>
              {beltBlocks.map((block, index) => {
                const basePos = block.progress * beltWidth
                const indexFromRight = beltBlocks.length - 1 - index
                const stackOffset = indexFromRight * (blockSize + blockGap)
                const xPos = Math.min(basePos, beltWidth - blockSize - stackOffset)
                
                // Calculate scale based on position - shrink as blocks approach the right (execution box)
                const progressToEnd = xPos / beltWidth
                const scale = 1 - (progressToEnd * 0.4) // Scale from 1.0 down to 0.6 as it approaches end

                return (
                  <motion.div
                    key={block.id}
                    className="absolute"
                    style={{ 
                      left: xPos,
                      top: '50%',
                      transform: `translateY(-50%) scale(${scale})`,
                      transformOrigin: 'center right',
                    }}
                    initial={{ x: -blockSize, opacity: 0, scale: 1 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ 
                      x: 100, 
                      opacity: 0, 
                      scale: 0.3,
                      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } // Fast acceleration into execution
                    }}
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
          {/* Simple input arrow */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" strokeOpacity="0.5" />
            </svg>
          </div>

          <div
            className={`absolute top-1 left-0 right-0 text-center text-[8px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}
          >
            Execution
          </div>

          <div className="flex flex-wrap gap-0.5 items-center justify-center p-1">
            <AnimatePresence mode="popLayout">
              {executingBlocks.map((block) => (
                <motion.div
                  key={block.id}
                  initial={{ x: -30, opacity: 0, scale: 0.5 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, y: -15 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <ExecutingBlock 
                    colors={colors} 
                    blockId={block.id}
                    txCount={block.txCount} 
                    txColors={block.txColors} 
                    processedIndices={processedTxIndices}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>


          {/* Exhaust vent - top right */}
          <div className="absolute -top-1 right-3 z-20">
            {/* Vent opening */}
            <svg width="12" height="8" viewBox="0 0 12 8" className="relative z-10">
              <rect x="0" y="4" width="12" height="4" fill={colors.stroke + "30"} stroke={colors.stroke + "50"} strokeWidth="0.5" />
              <line x1="3" y1="4" x2="3" y2="8" stroke={colors.stroke + "40"} strokeWidth="0.5" />
              <line x1="6" y1="4" x2="6" y2="8" stroke={colors.stroke + "40"} strokeWidth="0.5" />
              <line x1="9" y1="4" x2="9" y2="8" stroke={colors.stroke + "40"} strokeWidth="0.5" />
            </svg>
            
            {/* Tx color particles */}
            <AnimatePresence>
              {smokeParticles.map((particle) => (
                <motion.div
                  key={particle.id}
                  className="absolute"
                  style={{
                    left: 6 + particle.x,
                    top: 0,
                  }}
                  initial={{ y: 0, opacity: 0.9, scale: 1 }}
                  animate={{ 
                    y: -30, 
                    opacity: 0, 
                    x: particle.x * 1.2,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ 
                    duration: 1.5, 
                    ease: "easeOut",
                  }}
                >
                  <div 
                    style={{
                      width: 4,
                      height: 4,
                      backgroundColor: particle.color,
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Output arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M0 8 L12 8 M8 4 L12 8 L8 12" stroke={colors.stroke} strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          {/* Logs and Fire below execution box - links to Firewood */}
          <a 
            href="https://www.avax.network/about/blog/introducing-firewood-a-next-generation-database-built-for-high-throughput-blockchains"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
            title="Learn about Firewood"
          >
            {/* Fire emoji style - bigger */}
            <div className="relative flex items-end justify-center" style={{ height: 32 }}>
              <motion.span
                className="text-3xl leading-none select-none"
                style={{ textShadow: "0 0 12px rgba(251,146,60,0.7)" }}
                animate={{
                  scale: [1, 1.12, 1.05, 1.15, 1],
                  rotate: [-2, 3, -2, 4, -2],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                🔥
              </motion.span>
            </div>
            
            {/* Bigger log stack */}
            <div className="relative flex flex-col items-center" style={{ marginTop: -4 }}>
              <div 
                style={{
                  width: 56,
                  height: 10,
                  background: "linear-gradient(180deg, #A0522D 0%, #8B4513 50%, #654321 100%)",
                  borderRadius: 5,
                }}
              />
              <div className="flex" style={{ marginTop: -2, gap: 4 }}>
                <div 
                  style={{
                    width: 28,
                    height: 8,
                    background: "linear-gradient(180deg, #8B4513 0%, #654321 100%)",
                    borderRadius: 4,
                  }}
                />
                <div 
                  style={{
                    width: 28,
                    height: 8,
                    background: "linear-gradient(180deg, #A0522D 0%, #8B4513 100%)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            
            {/* Firewood label */}
            <span 
              className="text-[8px] font-mono uppercase tracking-wider mt-1.5 opacity-60 hover:opacity-100"
              style={{ color: colors.stroke }}
            >
              Firewood
            </span>
          </a>
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
                  x: [0, settledLineSpacing],
                }}
                transition={{
                  duration: settledLineDuration,
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
                    className="absolute flex gap-1 top-0"
                    style={{
                      left: xPos,
                    }}
                    initial={{ x: -20, opacity: 0, scale: 0.8 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {batch.blocks.map((block) => (
                      <Block key={block.id} colors={colors} txCount={block.txCount} txColors={block.txColors} size="md" settled />
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
    <div className="py-2 md:py-12">
      {/* Header - matching main title style */}
      <div className="text-center mb-3 md:mb-6">
        <h2 className={`text-2xl sm:text-xl md:text-2xl font-medium ${colors.text} uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-1 md:mb-3 font-mono`}>
          Assembly Lines, but for Blockchains!
        </h2>
        <p className={`text-sm sm:text-xs ${colors.textMuted} font-mono uppercase tracking-[0.1em]`}>
          Blockchain go brrr!
        </p>
      </div>
      
      {/* Animation */}
      <AssemblyLineAnimation colors={colors} />
      
      {/* Description underneath */}
      <p className={`text-lg sm:text-xs md:text-[11px] ${colors.textMuted} mt-8 md:mt-10 font-mono uppercase tracking-wider text-center`}>
        Faster block acceptance • Saturated execution • Instant receipts
      </p>
    </div>
  )
}

export function LeanExecutionSection({ colors }: { colors: Colors }) {
  return (
    <div className={`border ${colors.border} p-3 md:p-8 ${colors.blockBg}`}>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3 md:mb-8">
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.2em] ${colors.textFaint} font-mono`}>LEAN EXECUTION</span>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-12">
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

