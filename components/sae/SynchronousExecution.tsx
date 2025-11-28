"use client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, Block, Transaction, SYNC_CONFIG, getRandomTxColor } from "./types"
import { FlowArrow } from "./shared"

function SyncBlockDisplay({
  block,
  colors,
  label,
  showCheckmark = false,
  isDotted = false,
  showSpinner = false,
  isProposing = false,
}: {
  block: Block | null
  colors: Colors
  label: string
  showCheckmark?: boolean
  isDotted?: boolean
  showSpinner?: boolean
  isProposing?: boolean
}) {
  const executionColor = "#ef4444" // red
  const [filledCells, setFilledCells] = useState(0)

  // Animate cells filling when proposing
  useEffect(() => {
    if (isProposing && block) {
      setFilledCells(0)
      const totalCells = block.txCount
      // Dynamic timing: total fill animation is ~3 seconds regardless of cell count
      // More cells = faster per-cell animation
      const totalFillTime = 3000 // 3 seconds total
      const fillInterval = Math.max(100, totalFillTime / totalCells) // At least 100ms per cell

      let currentCell = 0
      const interval = setInterval(() => {
        currentCell++
        setFilledCells(currentCell)
        if (currentCell >= totalCells) {
          clearInterval(interval)
        }
      }, fillInterval)

      return () => clearInterval(interval)
    } else if (!isProposing) {
      // When not proposing, show all cells immediately
      setFilledCells(block?.txCount || 0)
    }
  }, [isProposing, block])

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex items-center justify-center overflow-hidden`}
        style={{
          width: 64,
          height: 64,
          border: isDotted
            ? `2px dashed ${colors.stroke}30`
            : showSpinner && block
              ? `2px solid ${executionColor}`
              : `1px solid ${colors.stroke}20`,
          boxShadow: showSpinner && block ? `0 0 8px ${executionColor}50` : undefined,
        }}
      >
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={block.uid}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative"
            >
              <div
                className={`border ${colors.borderStrong} grid gap-0.5 p-1`}
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  width: 40,
                  height: 40,
                  backgroundColor: `${colors.stroke}05`,
                }}
              >
                {Array.from({ length: 16 }).map((_, i) => {
                  const shouldShow = isProposing ? i < filledCells : i < block.txCount
                  return (
                    <motion.div
                      key={i}
                      initial={isProposing && i < block.txCount ? { scale: 0, opacity: 0 } : false}
                      animate={shouldShow ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      style={{
                        aspectRatio: "1",
                        backgroundColor: shouldShow && i < block.txCount
                          ? (block.txColors[i] || `${colors.stroke}40`)
                          : `${colors.stroke}10`,
                      }}
                    />
                  )
                })}
              </div>
              {showCheckmark && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`absolute -top-1 -right-1 w-3.5 h-3.5 border ${colors.borderStrong} flex items-center justify-center z-10`}
                  style={{ backgroundColor: `${colors.stroke}10` }}
                >
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke={colors.stroke} strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              )}
              {showSpinner && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`absolute -top-1.5 -right-1.5 w-4 h-4 border ${colors.borderStrong} flex items-center justify-center z-10`}
                  style={{ backgroundColor: `${colors.stroke}15` }}
                >
                  <motion.svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <path
                      d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m11.31 0l-2.83-2.83M9.76 9.76L6.93 6.93"
                      stroke={colors.stroke}
                      strokeOpacity="0.7"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </motion.svg>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.span
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-[9px] ${colors.textFaint} uppercase tracking-widest`}
            >
              —
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>{label}</span>
    </div>
  )
}

function SyncSettledDisplay({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const visibleBlocks = blocks.slice(-8)

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`border ${colors.border} ${colors.blockBg} p-1.5 overflow-hidden relative`}
        style={{ width: 100, height: 80 }}
      >
        <div className="grid grid-cols-4 gap-1 h-full relative z-10">
          <AnimatePresence mode="popLayout">
            {visibleBlocks.map((block) => (
              <motion.div
                key={block.uid}
                layout
                initial={{ x: -40, opacity: 0, scale: 0.5 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`border ${colors.borderStrong} grid gap-px p-0.5 relative`}
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  width: 18,
                  height: 18,
                  backgroundColor: `${colors.stroke}05`,
                }}
              >
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      aspectRatio: "1",
                      backgroundColor: i < block.txCount
                        ? (block.txColors[i] || `${colors.stroke}40`)
                        : `${colors.stroke}10`,
                    }}
                  />
                ))}
                {/* Pulsing secure border */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ border: `1.5px solid #22c55e` }}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0.4, 0.8, 0.4],
                    boxShadow: [
                      '0 0 0px rgba(34, 197, 94, 0)',
                      '0 0 4px rgba(34, 197, 94, 0.5)',
                      '0 0 0px rgba(34, 197, 94, 0)',
                    ]
                  }}
                  transition={{ delay: 0.2, duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Settled</span>
    </div>
  )
}

export function SynchronousExecution({ colors }: { colors: Colors }) {
  const [mempoolTxs, setMempoolTxs] = useState<Transaction[]>([])
  const [currentStage, setCurrentStage] = useState<'idle' | 'proposing' | 'accepted' | 'executing'>('idle')
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null)
  const [settledBlocks, setSettledBlocks] = useState<Block[]>([])

  const blockIdRef = useRef(1000)
  const txIdRef = useRef(10000)
  const isProcessingRef = useRef(false)

  // Add transactions to mempool
  useEffect(() => {
    const scheduleMempoolTx = () => {
      const delay = Math.random() * (SYNC_CONFIG.mempoolMaxDelay - SYNC_CONFIG.mempoolMinDelay) + SYNC_CONFIG.mempoolMinDelay
      const timeout = setTimeout(() => {
        setMempoolTxs((prev) => {
          const maxSlots = 12
          const usedSlots = new Set(prev.map(tx => tx.slot))
          const availableSlots = Array.from({ length: maxSlots }, (_, i) => i)
            .filter(s => !usedSlots.has(s))

          if (availableSlots.length === 0) return prev

          txIdRef.current += 1
          const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)]
          const newTx: Transaction = { id: txIdRef.current, color: getRandomTxColor(), slot }
          return [...prev, newTx].slice(0, maxSlots)
        })
        scheduleMempoolTx()
      }, delay)
      return timeout
    }
    const timeout = scheduleMempoolTx()
    return () => clearTimeout(timeout)
  }, [])

  // Synchronous execution - one block must fully settle before next is proposed
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []

    const clearAllTimeouts = () => {
      timeouts.forEach(t => clearTimeout(t))
      timeouts.length = 0
    }

    const tryStartNextBlock = () => {
      // Strict guard - only one block at a time
      if (isProcessingRef.current) {
        return
      }

      setMempoolTxs((currentMempool) => {
        if (currentMempool.length >= 4 && !isProcessingRef.current) {
          isProcessingRef.current = true

          blockIdRef.current += 1
          const txCount = Math.min(Math.floor(Math.random() * 8) + 4, currentMempool.length, 16)
          const txColors = currentMempool.slice(0, txCount).map(tx => tx.color)

          const newBlock: Block = {
            id: blockIdRef.current,
            uid: `sync-${blockIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            txCount,
            txColors,
            createdAt: Date.now(),
          }

          // Stage 1: Proposing (with cell filling animation)
          setCurrentBlock(newBlock)
          setCurrentStage('proposing')

          // Stage 2: Executing
          timeouts.push(setTimeout(() => {
            setCurrentStage('executing')
          }, SYNC_CONFIG.proposeTime))

          // Stage 3: Accepted
          timeouts.push(setTimeout(() => {
            setCurrentStage('accepted')
          }, SYNC_CONFIG.proposeTime + SYNC_CONFIG.executeTime))

          // Stage 4: Settled - then reset for next block
          timeouts.push(setTimeout(() => {
            setSettledBlocks((prev) => [...prev.slice(-7), newBlock])
            setCurrentBlock(null)
            setCurrentStage('idle')
            isProcessingRef.current = false

            // Schedule next block check
            timeouts.push(setTimeout(tryStartNextBlock, SYNC_CONFIG.settleDelay))
          }, SYNC_CONFIG.proposeTime + SYNC_CONFIG.executeTime + SYNC_CONFIG.acceptTime))

          return currentMempool.slice(txCount)
        }
        return currentMempool
      })
    }

    // Check periodically for enough transactions to start
    const checkInterval = setInterval(() => {
      if (!isProcessingRef.current) {
        tryStartNextBlock()
      }
    }, 500)

    // Initial start
    timeouts.push(setTimeout(tryStartNextBlock, 1000))

    return () => {
      clearInterval(checkInterval)
      clearAllTimeouts()
      isProcessingRef.current = false
    }
  }, [])

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  const tooltipContent: Record<string, { title: string; content: string }> = {
    mempool: {
      title: "Transaction Pool",
      content: "Transactions arrive via RPC and wait in the mempool. A validator selects transactions to include in the next block."
    },
    proposing: {
      title: "Block Proposing",
      content: "The validator creates a block by selecting transactions from the mempool. Watch the block fill with transactions before being sent to the network."
    },
    executing: {
      title: "Executing Transactions",
      content: "Each transaction is executed sequentially, computing state changes. The entire network must wait for execution to complete before the block can be accepted."
    },
    accepted: {
      title: "Consensus Reached",
      content: "After execution completes, validators vote on the block. Once enough validators agree, the block is accepted by consensus."
    },
    settled: {
      title: "Block Finalized",
      content: "State changes are committed and transaction receipts become available. Only now can the next block be proposed."
    }
  }

  const renderTooltip = (id: string) => (
    <AnimatePresence>
      {activeTooltip === id && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
          style={{ width: 240 }}
        >
          <div
            className="border p-4"
            style={{
              backdropFilter: 'blur(12px)',
              backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
              borderColor: `${colors.stroke}20`
            }}
          >
            <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
              {tooltipContent[id].title}
            </div>
            <div className="text-[9px] font-mono leading-relaxed" style={{ color: `${colors.stroke}90` }}>
              {tooltipContent[id].content}
            </div>
          </div>
          <div
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `6px solid ${colors.stroke}20`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Transaction Lifecycle
        </span>
        <span className={`text-[10px] ${colors.textFaint} font-mono`}>
          *simplified for illustration
        </span>
      </div>
      <div className={`border ${colors.border} p-2 sm:p-6 ${colors.blockBg}`}>
        {/* Single row flow - always horizontal, scaled via parent on mobile */}
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {/* Mempool */}
          <div
            className="flex flex-col items-center gap-2 relative cursor-help"
            onMouseEnter={() => setActiveTooltip('mempool')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <div
              className={`relative border ${colors.border} overflow-hidden`}
              style={{ width: 80, height: 50 }}
            >
              <div
                className="absolute inset-1.5 grid gap-1"
                style={{ gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const tx = mempoolTxs[i]
                  return (
                    <div
                      key={i}
                      className="transition-all duration-100"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: tx ? tx.color : `${colors.stroke}15`,
                        opacity: tx ? 1 : 0.3,
                      }}
                    />
                  )
                })}
              </div>
            </div>
            <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Mempool</span>
            {renderTooltip('mempool')}
          </div>

          <FlowArrow colors={colors} />

          {/* Proposing */}
          <div
            className="relative cursor-help"
            onMouseEnter={() => setActiveTooltip('proposing')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <SyncBlockDisplay
              block={currentStage === 'proposing' ? currentBlock : null}
              colors={colors}
              label="Proposing"
              isDotted
              isProposing={currentStage === 'proposing'}
            />
            {renderTooltip('proposing')}
          </div>

          <FlowArrow colors={colors} />

          {/* Executing */}
          <div
            className="relative cursor-help"
            onMouseEnter={() => setActiveTooltip('executing')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <SyncBlockDisplay
              block={currentStage === 'executing' ? currentBlock : null}
              colors={colors}
              label="Executing"
              showSpinner
            />
            {renderTooltip('executing')}
          </div>

          <FlowArrow colors={colors} />

          {/* Accepted */}
          <div
            className="relative cursor-help"
            onMouseEnter={() => setActiveTooltip('accepted')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <SyncBlockDisplay
              block={currentStage === 'accepted' ? currentBlock : null}
              colors={colors}
              label="Accepted"
              showCheckmark
            />
            {renderTooltip('accepted')}
          </div>

          <FlowArrow colors={colors} />

          {/* Settled */}
          <div
            className="relative cursor-help"
            onMouseEnter={() => setActiveTooltip('settled')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <SyncSettledDisplay blocks={settledBlocks} colors={colors} />
            {renderTooltip('settled')}
          </div>
        </div>
      </div>

      {/* Note - outside container */}
      <div className="mt-2 md:mt-4 space-y-2">
        <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} font-mono uppercase tracking-wider`}>
          Each block must fully execute before the next can be proposed
        </p>
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          Consensus waits for execution. Execution waits for consensus. Total block execution time gates throughput, forcing the system to accommodate worst-case blocks. Users must wait for the entire block to be published before learning if their transaction succeeded.
        </p>
      </div>
    </div>
  )
}

