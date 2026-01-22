"use client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, Block, Transaction, SYNC_CONFIG, getRandomTxColor } from "./types"
import { FlowArrow } from "./shared"

const MAX_TX = 16

// Block display that shows check/x animation during execution
function SyncExecutingBlock({ 
  block, 
  colors,
  onComplete 
}: { 
  block: Block; 
  colors: Colors;
  onComplete?: () => void;
}) {
  const [executedCount, setExecutedCount] = useState(0)
  const failedTxs = useRef<Set<number>>(new Set())
  const blockTxCount = Math.min(block.txCount, MAX_TX)
  
  // Determine which txs fail (10% chance each)
  useEffect(() => {
    failedTxs.current = new Set()
    for (let i = 0; i < blockTxCount; i++) {
      if (Math.random() < 0.1) failedTxs.current.add(i)
    }
  }, [block.uid, blockTxCount])
  
  useEffect(() => {
    setExecutedCount(0)
    
    // Each tx takes ~150ms
    const txTime = 150
    const timers: NodeJS.Timeout[] = []
    
    for (let i = 0; i < blockTxCount; i++) {
      const timer = setTimeout(() => {
        setExecutedCount(i + 1)
      }, (i + 1) * txTime)
      timers.push(timer)
    }
    
    // Signal completion after last tx animation finishes
    const completeTimer = setTimeout(() => {
      onComplete?.()
    }, blockTxCount * txTime + 300)
    timers.push(completeTimer)
    
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [block.uid, blockTxCount, onComplete])
  
  return (
    <div
      className="border grid gap-0.5 p-1 relative overflow-hidden"
      style={{
        gridTemplateColumns: "repeat(4, 1fr)",
        width: 48,
        height: 48,
        backgroundColor: `${colors.stroke}05`,
        borderColor: `${colors.stroke}30`,
      }}
    >
      {Array.from({ length: MAX_TX }).map((_, i) => {
        const isTransaction = i < block.txCount
        const isExecuted = i < executedCount
        const isFailed = failedTxs.current.has(i)
        const txColor = block.txColors[i] || `${colors.stroke}40`
        
        return (
          <div key={i} className="relative" style={{ aspectRatio: "1" }}>
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `${colors.stroke}10` }}
            />
            {isTransaction && (
              <motion.div
                className="absolute inset-0"
                style={{ backgroundColor: txColor }}
                initial={{ scale: 1, opacity: 1 }}
                animate={isExecuted ? {
                  scale: [1, 1.2, 0],
                  opacity: [1, 1, 0],
                } : { scale: 1, opacity: 1 }}
                transition={isExecuted ? { duration: 0.1, ease: "easeOut" } : {}}
              />
            )}
            {isTransaction && isExecuted && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                transition={{ duration: 0.08 }}
              >
                {isFailed ? (
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6l-12 12" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                )}
              </motion.div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SyncBlockDisplay({
  block,
  colors,
  label,
  showCheckmark = false,
  isDotted = false,
  isExecuting = false,
  isProposing = false,
  onExecutionComplete,
}: {
  block: Block | null
  colors: Colors
  label: string
  showCheckmark?: boolean
  isDotted?: boolean
  isExecuting?: boolean
  isProposing?: boolean
  onExecutionComplete?: () => void
}) {
  const executionColor = "#ef4444" // red
  const [proposingPhase, setProposingPhase] = useState<'executing' | 'consensus' | 'idle'>('idle')
  const [checkmarkVisible, setCheckmarkVisible] = useState(false)

  // Delay checkmark visibility to match animation
  useEffect(() => {
    if (showCheckmark && block) {
      const timer = setTimeout(() => {
        setCheckmarkVisible(true)
      }, 1200) // Match checkmark delay
      return () => {
        clearTimeout(timer)
        setCheckmarkVisible(false)
      }
    } else {
      setCheckmarkVisible(false)
    }
  }, [showCheckmark, block])

  // Simple phase switching for proposing: red (executing) → grey (consensus)
  useEffect(() => {
    if (isProposing && block) {
      setProposingPhase('executing')
      
      // Switch to consensus phase halfway through
      const timer = setTimeout(() => {
        setProposingPhase('consensus')
      }, 1100)

      return () => {
        clearTimeout(timer)
        setProposingPhase('idle')
      }
    } else {
      setProposingPhase('idle')
    }
  }, [isProposing, block])

  const showProposingPulse = isProposing && block && (proposingPhase === 'executing' || proposingPhase === 'consensus')
  const showAcceptedPulse = showCheckmark && block

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex items-center justify-center overflow-visible`}
        style={{
          width: 64,
          height: 64,
          border: `1px solid ${colors.stroke}20`,
        }}
      >
        {/* Grey loading border for accepted state - fills around the box then turns green */}
        {showAcceptedPulse && (
          <svg
            className="absolute pointer-events-none z-20"
            style={{ 
              width: 52, 
              height: 52,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            viewBox="0 0 52 52"
          >
            <motion.rect
              x="1"
              y="1"
              width="50"
              height="50"
              fill="none"
              strokeWidth="2"
              strokeDasharray="200"
              initial={{ strokeDashoffset: 200, stroke: "#9ca3af" }}
              animate={{ strokeDashoffset: 0, stroke: "#22c55e" }}
              transition={{ 
                strokeDashoffset: { duration: 1.2, ease: "linear" },
                stroke: { duration: 0.3, delay: 1.2, ease: "easeOut" }
              }}
            />
          </svg>
        )}
        {/* Solid pulsing border - red (executing) then grey (consensus) */}
        {showProposingPulse && (
          <motion.div
            className="absolute pointer-events-none z-20 border-2"
            style={{ 
              width: 52, 
              height: 52,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              borderColor: proposingPhase === 'executing' 
                ? [executionColor, `${executionColor}60`, executionColor]
                : ["#9ca3af", "#9ca3af60", "#9ca3af"],
            }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Solid red pulsing border for executing */}
        {isExecuting && block && (
          <motion.div
            className="absolute pointer-events-none z-20 border-2"
            style={{ 
              width: 52, 
              height: 52,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              borderColor: ["#ef4444", "#ef444460", "#ef4444"],
            }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Pulsing glow during consensus phase */}
        {showProposingPulse && proposingPhase === 'consensus' && (
          <motion.div
            className="absolute pointer-events-none z-10"
            style={{ 
              width: 52, 
              height: 52,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            animate={{ 
              boxShadow: [
                `0 0 0px rgba(156, 163, 175, 0)`,
                `0 0 12px rgba(156, 163, 175, 0.5)`,
                `0 0 0px rgba(156, 163, 175, 0)`,
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
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
              {isExecuting ? (
                <SyncExecutingBlock 
                  block={block} 
                  colors={colors} 
                  onComplete={onExecutionComplete}
                />
              ) : (
                <div
                  className="border grid gap-0.5 p-1"
                  style={{
                    gridTemplateColumns: "repeat(4, 1fr)",
                    width: 48,
                    height: 48,
                    backgroundColor: `${colors.stroke}05`,
                    borderColor: checkmarkVisible ? "#22c55e" : `${colors.stroke}30`,
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
                </div>
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


export function SynchronousExecution({ colors }: { colors: Colors }) {
  const [mempoolTxs, setMempoolTxs] = useState<Transaction[]>([])
  const [currentStage, setCurrentStage] = useState<'idle' | 'proposing' | 'accepted' | 'executing'>('idle')
  const [currentBlock, setCurrentBlock] = useState<Block | null>(null)

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

          // Stage 4: Reset for next block
          timeouts.push(setTimeout(() => {
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
      content: "Transactions arrive via RPC and wait here. Users have no visibility into when their transaction will be included or executed — they must wait for the entire pipeline to complete."
    },
    proposing: {
      title: "Block Building — The First Bottleneck",
      content: "The proposer must execute every transaction BEFORE proposing. This pre-execution runs the full VM, computing state changes. Other validators sit idle waiting for this single node to finish."
    },
    executing: {
      title: "Network-Wide Execution — The Second Bottleneck",
      content: "Every validator must independently re-execute the same transactions to verify correctness. The network is blocked — no new blocks can be proposed until all validators complete execution."
    },
    accepted: {
      title: "Consensus Voting",
      content: "Only after execution completes can validators vote. The block waits in limbo while votes are collected. Any slow validator delays the entire network. Only NOW can the next block begin."
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
          *all animations are simplified for illustrative purposes
        </span>
      </div>
      {/* Outer container */}
      <div 
        className={`border p-2 sm:p-3 relative`}
        style={{
          borderColor: 'rgba(156, 163, 175, 0.5)',
          backgroundColor: 'rgba(156, 163, 175, 0.01)',
        }}
      >
        {/* Legend */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap px-1 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2" style={{ backgroundColor: '#f59e0b' }} />
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Transaction</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 grid grid-cols-2 gap-px p-0.5"
              style={{ backgroundColor: `${colors.stroke}05`, border: `1px solid ${colors.stroke}30` }}
            >
              {[0,1,2,3].map(i => (
                <div key={i} style={{ backgroundColor: i < 3 ? '#f59e0b' : `${colors.stroke}10` }} />
              ))}
            </div>
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Block</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: '#ef4444' }} />
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Execution</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: `${colors.stroke}25`, border: `1px solid ${colors.stroke}40` }} />
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Consensus</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <line x1="0" y1="8" x2="16" y2="8" stroke={colors.stroke} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="6 4" />
            </svg>
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Context Switching</span>
          </div>
        </div>

        {/* Middle layer */}
        <div 
          className={`p-2 sm:p-3 border ${colors.border} ${colors.blockBg}`}
        >
          {/* Inner inset container */}
          <div 
            className="p-3 sm:p-6"
            style={{
              backgroundColor: 'rgba(156, 163, 175, 0.05)',
              boxShadow: `
                inset 0 2px 8px 0 rgba(156, 163, 175, 0.25),
                inset 0 1px 2px 0 rgba(156, 163, 175, 0.2)
              `,
              border: '1px solid rgba(156, 163, 175, 0.3)',
            }}
          >
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
              {/* Grid container */}
              <div
                className="absolute inset-1.5 grid gap-1"
                style={{ gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const tx = mempoolTxs.find(t => t.slot === i)
                  return (
                    <div key={`slot-${i}`} className="relative" style={{ width: 8, height: 8 }}>
                      {/* Empty slot indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: `${colors.stroke}10`,
                          opacity: 0.4,
                        }}
                      />
                      {/* Transaction dot with smooth entry */}
                      <AnimatePresence mode="popLayout">
                        {tx && (
                          <motion.div
                            key={tx.id}
                            className="absolute inset-0"
                            style={{ backgroundColor: tx.color }}
                            initial={{ scale: 0, opacity: 0, rotate: -90 }}
                            animate={{ 
                              scale: 1, 
                              opacity: 1, 
                              rotate: 0,
                            }}
                            exit={{ 
                              scale: 0.3,
                              opacity: 0,
                              x: 50,
                              transition: { duration: 0.35, ease: "easeOut" }
                            }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 500, 
                              damping: 25,
                            }}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>

              {/* Pulsing border */}
              <motion.div
                className="absolute inset-0 pointer-events-none border"
                style={{ borderColor: `${colors.stroke}20` }}
                animate={{
                  borderColor: [`${colors.stroke}15`, `${colors.stroke}30`, `${colors.stroke}15`],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
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
              label="Block Building"
              isDotted
              isProposing={currentStage === 'proposing'}
            />
            {renderTooltip('proposing')}
          </div>

          <FlowArrow colors={colors} dotted />

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
              isExecuting
            />
            {renderTooltip('executing')}
          </div>

          <FlowArrow colors={colors} dotted />

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
        </div>
        </div>
        </div>
      </div>

      {/* Note - outside container */}
      <div className="mt-4 md:mt-6">
        <p className={`text-base sm:text-base ${colors.text} leading-relaxed`}>
          Execution blocks everything. The proposer executes before proposing. Every validator re-executes to verify. Consensus pauses for the VM, the VM pauses for consensus. Block N+1 cannot start until Block N fully settles.
        </p>
      </div>
    </div>
  )
}

