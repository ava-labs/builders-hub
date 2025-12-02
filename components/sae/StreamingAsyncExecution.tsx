"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, Block, Transaction, SAE_CONFIG, MAX_TX, getRandomTxColor } from "./types"
import { FlowArrow, BlockchainBlock, QueueBlock } from "./shared"

function MempoolStage({ txs, colors }: { txs: Transaction[]; colors: Colors }) {
  const maxSlots = 18 // 6 columns x 3 rows
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3 relative">
      <div 
        className={`relative w-36 h-24 border ${colors.border} cursor-help overflow-hidden`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Grid container */}
        <div
          className="absolute inset-2 grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}
        >
          {Array.from({ length: maxSlots }).map((_, i) => {
            const tx = txs.find(t => t.slot === i)
            return (
              <div key={`slot-${i}`} className="relative" style={{ width: 10, height: 10 }}>
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
                        scale: 0.2,
                        opacity: 0,
                        x: 100,
                        transition: { duration: 0.12, ease: "easeIn" }
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
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 240 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Transaction Pool
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>Incoming transactions arrive via RPC and collect here before being included in blocks.</p>
                <p>Block builders validate transactions can pay for worst-case gas costs — ensuring every accepted transaction will eventually settle.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Signatures and nonces verified</p>
                <p style={{ color: `${colors.stroke}70` }}>• No execution or state computation yet</p>
              </div>
            </div>
            {/* Arrow pointing up */}
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
    </div>
  )
}

function ProposedStage({ block, colors }: { block: Block | null; colors: Colors }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [filledCells, setFilledCells] = useState(0)
  const prevBlockUid = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Animate cells filling when new block arrives
  useEffect(() => {
    if (block && block.uid !== prevBlockUid.current) {
      prevBlockUid.current = block.uid
      setFilledCells(0)
      
      const totalCells = block.txCount
      // Fill animation over ~600ms - visible building effect
      const totalFillTime = 600
      const fillInterval = Math.max(30, totalFillTime / totalCells)
      
      let currentCell = 0
      
      // Small delay before starting fill to ensure empty state renders
      const startDelay = setTimeout(() => {
        const interval = setInterval(() => {
          currentCell++
          setFilledCells(currentCell)
          if (currentCell >= totalCells) {
            clearInterval(interval)
          }
        }, fillInterval)
        
        // Store interval for cleanup
        intervalRef.current = interval
      }, 50)
      
      return () => {
        clearTimeout(startDelay)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else if (!block) {
      prevBlockUid.current = null
      setFilledCells(0)
    }
  }, [block])
  
  return (
    <div className="flex flex-col items-center gap-3 flex-1 justify-center relative">
      <div
        className={`relative flex items-center justify-center overflow-visible cursor-help`}
        style={{ border: `1px solid ${colors.stroke}20`, width: 80, height: 80 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Solid grey pulsing border */}
        <motion.div
          className="absolute -inset-[2px] pointer-events-none z-20 border-2"
          style={{ width: 84, height: 84 }}
          animate={{
            borderColor: ["#9ca3af", "#9ca3af60", "#9ca3af"],
          }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        />
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={block.uid}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, x: 30 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25,
              }}
              className="flex flex-col items-center gap-0.5"
            >
              {/* Block with filling animation */}
              <div
                className="border grid gap-0.5 p-1"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  width: 48,
                  height: 48,
                  backgroundColor: `${colors.stroke}05`,
                  borderColor: `${colors.stroke}30`,
                }}
              >
                {Array.from({ length: 16 }).map((_, i) => {
                  const shouldShow = i < filledCells
                  const txColor = block.txColors[i] || `${colors.stroke}40`
                  return (
                    <motion.div
                      key={i}
                      initial={i < block.txCount ? { scale: 0, opacity: 0 } : false}
                      animate={shouldShow ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      style={{
                        aspectRatio: "1",
                        backgroundColor: shouldShow && i < block.txCount
                          ? txColor
                          : `${colors.stroke}10`,
                      }}
                    />
                  )
                })}
              </div>
              {/* Block ID */}
              <span className={`text-[7px] font-mono font-bold ${colors.textFaint}`}>
                #{block.id.toString().padStart(3, "0")}
              </span>
            </motion.div>
          ) : (
            <motion.span
              key="forming"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={`text-[10px] ${colors.textFaint} uppercase tracking-widest`}
            >
              Forming
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Proposing</span>
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 280 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Block Proposal
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>Consensus validates that transactions <em>can</em> be executed — not executing them yet.</p>
                <p>Lightweight validation only:</p>
                <p style={{ color: `${colors.stroke}70` }}>• Verify signatures and nonces</p>
                <p style={{ color: `${colors.stroke}70` }}>• Enforce worst-case gas bounds</p>
                <p style={{ color: `${colors.stroke}70` }}>• Confirm senders can pay max possible cost</p>
                <p className="mt-1">No state changes computed — validators aren&apos;t bottlenecked by VM time.</p>
              </div>
            </div>
            {/* Arrow pointing up */}
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
    </div>
  )
}

function AcceptedStage({ block, colors, isSettling }: { block: Block | null; colors: Colors; isSettling?: boolean }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="flex flex-col items-center gap-3 relative">
      <div
        className={`relative flex items-center justify-center overflow-visible pt-2 cursor-help`}
        style={{ width: 80, height: 80 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Grey border always visible */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ border: `1px solid ${colors.stroke}20` }}
        />
        {/* Solid grey pulsing border - turns green when triggering settlement */}
        <AnimatePresence>
        {block && (
            <motion.div
              className="absolute -inset-[2px] pointer-events-none z-20 border-2"
              style={{ width: 84, height: 84 }}
              initial={{ borderColor: "#9ca3af" }}
              animate={{
                borderColor: isSettling 
                  ? "#22c55e" 
                  : ["#9ca3af", "#9ca3af60", "#9ca3af"],
              }}
              transition={isSettling 
                ? { duration: 0.2, ease: "easeOut" }
                : { duration: 1, repeat: Infinity, ease: "easeInOut" }
              }
            />
          )}
        </AnimatePresence>
        {/* Green flash border - only when this block triggers settlement (executed -> settled) */}
        <AnimatePresence>
          {isSettling && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-30"
            style={{ border: `3px solid #22c55e` }}
            initial={{ opacity: 0 }}
            animate={{ 
                opacity: [0, 1, 0.8, 0],
              boxShadow: [
                '0 0 0px rgba(34, 197, 94, 0)',
                  '0 0 16px rgba(34, 197, 94, 0.7)',
                  '0 0 8px rgba(34, 197, 94, 0.4)',
                '0 0 0px rgba(34, 197, 94, 0)',
              ]
            }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={block.uid}
              initial={{ scale: 0.8, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative"
            >
              <BlockchainBlock colors={colors} txCount={block.txCount} txColors={block.txColors} id={block.id} showHash />
            </motion.div>
          ) : (
            <span className={`text-[10px] ${colors.textFaint} uppercase tracking-widest`}>Validating</span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Accepted</span>
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 280 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Consensus Accepted
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>Block is accepted into the canonical chain — transaction order is now final.</p>
                <p>Consensus responsibilities complete:</p>
                <p style={{ color: `${colors.stroke}70` }}>• Block added to FIFO execution queue</p>
                <p style={{ color: `${colors.stroke}70` }}>• Queue size limits enforced (DoS protection)</p>
                <p style={{ color: '#22c55e' }}>• May include settlement data for previously executed blocks</p>
                <p className="mt-1">Consensus continues accepting new blocks without waiting for execution.</p>
              </div>
            </div>
            {/* Arrow pointing up */}
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
    </div>
  )
}

function QueueStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="flex items-center justify-center w-full gap-2 sm:gap-4 relative">
      <span className={`text-[8px] sm:text-[10px] ${colors.textFaint} uppercase tracking-widest`}>Out</span>

      <div
        className={`relative h-12 sm:h-14 flex-1 max-w-md border ${colors.border} flex items-center justify-start gap-2 sm:gap-3 px-2 sm:px-4 overflow-hidden cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <AnimatePresence mode="popLayout">
          {blocks.length === 0 && (
            <span
              className={`text-[10px] ${colors.textFaint} uppercase tracking-widest absolute left-1/2 -translate-x-1/2`}
            >
              Empty
            </span>
          )}
          {blocks.map((block) => (
            <motion.div
              key={block.uid}
              layout
              initial={{ scale: 0, x: 20, opacity: 0 }}
              animate={{ scale: 1, x: 0, opacity: 1 }}
              exit={{ 
                scale: 0.2, 
                x: -60,
                opacity: 0,
                transition: { duration: 0.05, ease: [0.4, 0, 1, 1] }
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <QueueBlock colors={colors} id={block.id} txCount={block.txCount} txColors={block.txColors} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <span className={`text-[8px] sm:text-[10px] ${colors.textFaint} uppercase tracking-widest`}>In</span>
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 260 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[11px] font-mono uppercase tracking-wider ${colors.text} font-semibold mb-2`}>
                FIFO Execution Queue
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>The bridge between consensus and execution — blocks wait here after acceptance.</p>
                <p>Key properties:</p>
                <p style={{ color: `${colors.stroke}70` }}>• First-in, first-out ordering preserved</p>
                <p style={{ color: `${colors.stroke}70` }}>• Queue size bounded to prevent DoS</p>
                <p style={{ color: `${colors.stroke}70` }}>• Consensus runs ahead while queue drains</p>
                <p className="mt-1">This decoupling eliminates context switching — consensus and execution run simultaneously.</p>
              </div>
            </div>
            {/* Arrow pointing up */}
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
    </div>
  )
}

// Single block being executed - shows gas-based progress
function ExecutingBlock({ block, colors, onComplete }: { 
  block: Block; 
  colors: Colors; 
  onComplete?: () => void;
}) {
  const [executedCount, setExecutedCount] = useState(0)
  const blockTxCount = block.txCount
  
  // Determine which transactions will fail (about 15% chance, stored on block)
  // Generate once and store on block so Executed stage can use same data
  useEffect(() => {
    if (!block.failedTxs) {
      const failed = new Set<number>()
      for (let i = 0; i < block.txCount; i++) {
        if (Math.random() < 0.15) {
          failed.add(i)
        }
      }
      block.failedTxs = failed
    }
  }, [block, block.txCount])
  
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
    
    // Signal completion after last tx animation finishes (wait for check/x to appear)
    const completeTimer = setTimeout(() => {
      onComplete?.()
    }, blockTxCount * txTime + 300)
    timers.push(completeTimer)
    
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [block.uid, blockTxCount, onComplete])
  
  return (
    <div className="flex flex-col items-center gap-1">
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
          const isFailed = block.failedTxs?.has(i) ?? false
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
      <span className={`text-[7px] font-mono font-bold ${colors.textFaint}`}>
        #{block.id.toString().padStart(3, "0")}
      </span>
    </div>
  )
}

// Shows the currently executing block (one at a time per spec)
function ExecutingStage({ block, colors, onBlockComplete }: { 
  block: Block | null; 
  colors: Colors;
  onBlockComplete: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center p-3 overflow-hidden cursor-help`}
        style={{ width: 90, height: 100 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Solid red pulsing border */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-20 border-2"
          animate={{
            borderColor: ["#ef4444", "#ef444460", "#ef4444"],
          }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        />
        <AnimatePresence mode="popLayout">
          {block ? (
            <motion.div
                  key={block.uid}
                  layout
              initial={{ scale: 0.4, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.6, opacity: 0, x: 30, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 800, damping: 35 }}
            >
              <ExecutingBlock block={block} colors={colors} onComplete={onBlockComplete} />
            </motion.div>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`text-[10px] uppercase tracking-widest ${colors.textFaint}`}
            >
              Waiting
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Executing</span>
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 300 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Block Execution
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>As soon as a block is available, the execution stream starts processing it on top of the last executed state.</p>
                <p>The execution stream provides deterministic timestamps based on block header and gas usage.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Execution timestamps are sub-second granular</p>
                <p style={{ color: `${colors.stroke}70` }}>• Gas usage advances the execution stream&apos;s timestamp</p>
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
    </div>
  )
}
// Blocks that finished executing, waiting for settlement
function ExecutedStage({ blocks, colors, isSettling }: { blocks: Block[]; colors: Colors; isSettling?: boolean }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const visibleBlocks = blocks.slice(-9) // Show up to 9 blocks in 3x3 grid
  
  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center overflow-hidden cursor-help`}
        style={{ width: 140, height: 130, padding: 6 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Green flash when settlement happens */}
        <AnimatePresence>
          {isSettling && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-20"
              style={{ border: `2px solid #22c55e` }}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0, 1, 0.8, 0],
                boxShadow: [
                  '0 0 0px rgba(34, 197, 94, 0)',
                  '0 0 16px rgba(34, 197, 94, 0.7)',
                  '0 0 8px rgba(34, 197, 94, 0.4)',
                  '0 0 0px rgba(34, 197, 94, 0)',
                ]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
        {/* Red waiting indicator - execution complete, awaiting settlement */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ border: `2px solid #ef4444` }}
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <AnimatePresence mode="popLayout">
          {visibleBlocks.length > 0 ? (
            <div 
              className="grid"
              style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}
            >
              {visibleBlocks.map((block) => {
                return (
                  <motion.div
                    key={block.uid}
                    layout
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="flex flex-col items-center"
                  >
                    <div
                      className="border grid"
                      style={{
                        gridTemplateColumns: 'repeat(4, 7px)',
                        gridTemplateRows: 'repeat(4, 7px)',
                        gap: 0,
                        backgroundColor: `${colors.stroke}05`,
                        borderColor: '#ef444450',
                      }}
                    >
                      {Array.from({ length: MAX_TX }).map((_, i) => {
                        const isTransaction = i < block.txCount
                        const isFailed = block.failedTxs?.has(i) ?? false
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-center"
                            style={{ backgroundColor: `${colors.stroke}08` }}
                          >
                            {isTransaction && (
                              isFailed ? (
                                <svg width="5" height="5" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 6l12 12M18 6l-12 12" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
                                </svg>
                              ) : (
                                <svg width="5" height="5" viewBox="0 0 24 24" fill="none">
                                  <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" />
                                </svg>
                              )
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <span className={`text-[6px] font-mono font-bold ${colors.textFaint} leading-none mt-0.5`}>
                      #{block.id}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.span
              key="empty"
              className={`text-[9px] uppercase tracking-widest ${colors.textFaint}`}
            >
              Empty
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Executed</span>
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 280 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Awaiting Settlement
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>After execution, blocks wait here until a following accepted block includes their results.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Settlement when: block timestamp ≥ execution time + constant delay</p>
                <p style={{ color: `${colors.stroke}70` }}>• Multiple blocks can settle at once</p>
                <p style={{ color: `${colors.stroke}70` }}>• Delay amortizes sporadic executor slowdowns</p>
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
    </div>
  )
}

function SettledStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const visibleBlocks = blocks.slice(-12) // 4x3 grid
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        className={`border ${colors.border} ${colors.blockBg} p-2 overflow-hidden relative cursor-help flex items-center justify-center`}
        style={{ width: 150, height: 110 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 40%, ${colors.stroke}06 50%, transparent 60%)`,
          }}
          animate={{
            backgroundPosition: ["200% 200%", "-100% -100%"],
          }}
          transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
        <div className="grid grid-cols-4 gap-1.5 relative z-10">
          <AnimatePresence mode="popLayout">
            {visibleBlocks.map((block, index) => (
              <motion.div
                key={block.uid}
                layout
                initial={{ x: -20, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  delay: index >= visibleBlocks.length - 4 ? (index - (visibleBlocks.length - 4)) * 0.05 : 0,
                }}
                className="grid gap-px p-0.5"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  width: 28,
                  height: 28,
                  backgroundColor: `rgba(34, 197, 94, 0.15)`,
                  border: `1px solid #22c55e`,
                }}
              >
                {Array.from({ length: MAX_TX }).map((_, i) => (
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Settled</span>
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 340 }}
          >
            <div 
              className={`border p-4`}
              style={{ 
                backdropFilter: 'blur(12px)',
                backgroundColor: colors.stroke === '#ffffff' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(250, 250, 250, 0.95)',
                borderColor: `${colors.stroke}20`
              }}
            >
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Block Settlement
              </div>
              <div className={`text-[9px] font-mono leading-relaxed space-y-2`} style={{ color: `${colors.stroke}90` }}>
                <p>Blocks are settled when a following accepted block includes their results.</p>
                <p>Results are included via state root (last executed) and receipt root (MPT of all receipts since last settlement).</p>
                <p style={{ color: `${colors.stroke}70` }}>• Multiple blocks can be settled at once</p>
                <p style={{ color: `${colors.stroke}70` }}>• State is now final and queryable</p>
              </div>
            </div>
            {/* Arrow pointing up */}
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
    </div>
  )
}


export function StreamingAsyncExecution({ colors }: { colors: Colors }) {
  const [mempoolTxs, setMempoolTxs] = useState<Transaction[]>([])
  const [proposedBlock, setProposedBlock] = useState<Block | null>(null)
  const [acceptedBlock, setAcceptedBlock] = useState<Block | null>(null)
  const [queuedBlocks, setQueuedBlocks] = useState<Block[]>([])
  const [executingBlock, setExecutingBlock] = useState<Block | null>(null) // Single block executing
  const [executedBlocks, setExecutedBlocks] = useState<Block[]>([]) // Awaiting settlement
  const [settledBlocks, setSettledBlocks] = useState<Block[]>([])
  const [isSettling, setIsSettling] = useState(false)

  const blockIdRef = useRef(0)
  const lastBlockCreationTime = useRef(0)
  const txIdRef = useRef(0)
  const queueRef = useRef<Block[]>([])
  const executingRef = useRef<Block | null>(null)
  const executedRef = useRef<Block[]>([])

  useEffect(() => {
    queueRef.current = queuedBlocks
  }, [queuedBlocks])

  useEffect(() => {
    executingRef.current = executingBlock
  }, [executingBlock])

  useEffect(() => {
    executedRef.current = executedBlocks
  }, [executedBlocks])

  useEffect(() => {
    const scheduleMempoolTx = () => {
      const delay =
        Math.random() * (SAE_CONFIG.mempoolMaxDelay - SAE_CONFIG.mempoolMinDelay) + SAE_CONFIG.mempoolMinDelay
      const timeout = setTimeout(() => {
        const batchSize =
          Math.floor(Math.random() * (SAE_CONFIG.mempoolBatchMax - SAE_CONFIG.mempoolBatchMin + 1)) +
          SAE_CONFIG.mempoolBatchMin
        
        // Cap mempool at 16 to keep visual breathing room (18 slots total)
        setMempoolTxs((prev) => {
          const maxMempool = 16
          const maxSlots = 18
          
          // Find which slots are taken
          const usedSlots = new Set(prev.map(tx => tx.slot))
          const availableSlots = Array.from({ length: maxSlots }, (_, i) => i)
            .filter(s => !usedSlots.has(s))
            .sort(() => Math.random() - 0.5) // Shuffle available slots
          
          // Create new transactions with assigned slots
          const newTxs: Transaction[] = []
          for (let i = 0; i < batchSize && newTxs.length < availableSlots.length; i++) {
            txIdRef.current += 1
            newTxs.push({ 
              id: txIdRef.current, 
              color: getRandomTxColor(),
              slot: availableSlots[i]
            })
          }
          
          return [...prev, ...newTxs].slice(0, maxMempool)
        })
        scheduleMempoolTx()
      }, delay)
      return timeout
    }
    const timeout = scheduleMempoolTx()
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const consensusTick = () => {
      // Step 1: Move accepted block to queue
      setAcceptedBlock((currentAccepted) => {
        if (currentAccepted) {
          setQueuedBlocks((q) => {
            // Prevent duplicates (can happen in React Strict Mode)
            if (q.some((b) => b.uid === currentAccepted.uid)) {
              return q
            }
            // Cap queue at 8 to prevent it from getting too full visually
            if (q.length >= 8) {
              return q
            }
            return [...q, currentAccepted]
          })
        }
        return null
      })

      // Step 2: Move proposed -> accepted (staggered for visual flow)
      setTimeout(() => {
        setProposedBlock((currentProposed) => {
          if (currentProposed) {
            setAcceptedBlock(currentProposed)
          }
          return null
        })
      }, SAE_CONFIG.consensusInterval * 0.3)

      // Step 3: Form new block from mempool (clear mempool first, then show block)
      setTimeout(() => {
        const now = Date.now()
        
        // Guard against React StrictMode double-execution
        if (now - lastBlockCreationTime.current < 200) {
          return
        }
        lastBlockCreationTime.current = now
        
        // Increment block ID ONCE, outside the state updater
        const nextBlockId = ++blockIdRef.current
        
        // Pre-generate random values outside state updater to avoid multiple calls
        const takeAllRandom = Math.random()
        const txCountRandom = Math.floor(Math.random() * 9) + 4
        
        setMempoolTxs((currentMempool) => {
          if (currentMempool.length >= 4) {
            // Take 4-16 transactions (capped at MAX_TX for visual consistency)
            const takeAll = currentMempool.length <= 8 && takeAllRandom > 0.6
            const availableToTake = Math.min(currentMempool.length, MAX_TX)
            const txCount = takeAll 
              ? availableToTake 
              : Math.min(txCountRandom, availableToTake)
            
            // Shuffle indices and pick which transactions to include
            const shuffledIndices = Array.from({ length: currentMempool.length }, (_, i) => i)
              .sort(() => Math.random() - 0.5)
            const takenIndices = shuffledIndices.slice(0, txCount)
            const keepIndices = new Set(shuffledIndices.slice(txCount))
            
            // Capture colors from taken transactions
            const txColors = takenIndices.map(i => currentMempool[i].color)
            
            const newBlock: Block = {
              id: nextBlockId,
              uid: `${nextBlockId}-${now}-${Math.random().toString(36).slice(2, 9)}`,
              txCount,
              txColors,
              createdAt: now,
            }
            
            // Set proposed block immediately (animations handle the visual timing)
            setProposedBlock(newBlock)
            return currentMempool.filter((_, i) => keepIndices.has(i))
          }
          return currentMempool
        })
      }, SAE_CONFIG.consensusInterval * 0.5)
    }

    const interval = setInterval(consensusTick, SAE_CONFIG.consensusInterval)
    return () => clearInterval(interval)
  }, [])

  // Start executing next block from queue when executor is idle
  // Per spec: "As soon as there is a block available in the execution queue, the block executor starts processing"
  useEffect(() => {
    if (executingBlock === null && queuedBlocks.length > 0) {
      const [blockToExecute, ...rest] = queuedBlocks
      setExecutingBlock(blockToExecute)
      setQueuedBlocks(rest)
    }
  }, [queuedBlocks, executingBlock])

  // Track when first block entered executed queue (for 5s delay)
  const executedQueueStartTimeRef = useRef<number | null>(null)
  const lastSettlementBlockIdRef = useRef<number | null>(null)
  
  // Handler for when a block finishes execution - move to executed (awaiting settlement)
  const handleBlockExecutionComplete = useCallback(() => {
    if (executingBlock) {
      setExecutedBlocks((prev) => {
        // Prevent duplicates
        if (prev.some(b => b.uid === executingBlock.uid)) return prev
        // Track when first block enters the executed queue
        if (prev.length === 0) {
          executedQueueStartTimeRef.current = Date.now()
        }
        return [...prev, executingBlock]
      })
      setExecutingBlock(null)
    }
  }, [executingBlock])
  
  // Settlement triggered after τ delay when next accepted block arrives
  // Per spec: τ = 5s delay between execution and settlement
  useEffect(() => {
    if (acceptedBlock && 
        acceptedBlock.id !== lastSettlementBlockIdRef.current && 
        executedBlocks.length > 0 &&
        executedQueueStartTimeRef.current !== null) {
      
      const timeInQueue = Date.now() - executedQueueStartTimeRef.current
      
      // Only settle if 5 seconds have passed since first block entered executed queue
      if (timeInQueue >= 5000) {
        lastSettlementBlockIdRef.current = acceptedBlock.id
        
        // Settle in middle of accepted animation
        const timer = setTimeout(() => {
          // Flash the accepted block green to show it includes results
          setIsSettling(true)
          setTimeout(() => setIsSettling(false), 800)
          
          setExecutedBlocks(prev => {
            if (prev.length === 0) return prev
            const blocksToSettle = [...prev]
            setSettledBlocks(settled => {
              const existingUids = new Set(settled.map(b => b.uid))
              const newBlocks = blocksToSettle.filter(b => !existingUids.has(b.uid))
              if (newBlocks.length === 0) return settled
              return [...settled.slice(-(16 - newBlocks.length)), ...newBlocks]
            })
            // Reset the queue start time
            executedQueueStartTimeRef.current = null
            return []
          })
        }, SAE_CONFIG.consensusInterval * 0.3)
        
        return () => clearTimeout(timer)
      }
    }
  }, [acceptedBlock, executedBlocks])

  return (
    <div>
      {/* Title */}
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
        </div>

        {/* Middle layer */}
        <div 
          className={`p-2 sm:p-3 space-y-3 border ${colors.border} ${colors.blockBg}`}
        >
          {/* Consensus Lane Shelf */}
          <div>
            <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} mb-2 font-mono tracking-wider`}>
              <span className="font-semibold uppercase" style={{ color: `${colors.stroke}60` }}>Consensus Stream</span>
            </p>
            <div 
              className="p-4 sm:p-6"
              style={{
                backgroundColor: 'rgba(156, 163, 175, 0.05)',
                boxShadow: `
                  inset 0 2px 8px 0 rgba(156, 163, 175, 0.25),
                  inset 0 1px 2px 0 rgba(156, 163, 175, 0.2)
                `,
                border: '1px solid rgba(156, 163, 175, 0.3)',
              }}
            >
            <div className="flex items-center gap-0">
              <div className="flex-1 flex justify-center">
                <MempoolStage txs={mempoolTxs} colors={colors} />
              </div>
              <FlowArrow colors={colors} />
              <div className="flex-1 flex justify-center">
                <ProposedStage block={proposedBlock} colors={colors} />
              </div>
              <FlowArrow colors={colors} />
              <div className="flex-1 flex justify-center">
                <AcceptedStage block={acceptedBlock} colors={colors} isSettling={isSettling} />
              </div>
            </div>
          </div>
        </div>

          {/* Connection to Queue */}
          <div className="flex justify-end pr-24">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <line x1="12" y1="0" x2="12" y2="16" stroke={colors.stroke} strokeOpacity="0.6" strokeWidth="1.5" />
              <path d="M7 12l5 8 5-8" stroke={colors.stroke} strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Queue Shelf */}
          <div>
            <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} mb-2 font-mono tracking-wider`}>
              <span className="font-semibold uppercase" style={{ color: '#3b82f6' }}>FIFO Queue</span>
            </p>
            <div 
              className="p-3 sm:p-4"
              style={{
                backgroundColor: 'rgba(156, 163, 175, 0.05)',
                boxShadow: `
                  inset 0 2px 8px 0 rgba(156, 163, 175, 0.25),
                  inset 0 1px 2px 0 rgba(156, 163, 175, 0.2)
                `,
                border: '1px solid rgba(156, 163, 175, 0.3)',
              }}
            >
              <QueueStage blocks={queuedBlocks} colors={colors} />
            </div>
          </div>

          {/* Connection to Execution */}
          <div className="flex justify-start pl-24">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <line x1="12" y1="0" x2="12" y2="16" stroke={colors.stroke} strokeOpacity="0.6" strokeWidth="1.5" />
              <path d="M7 12l5 8 5-8" stroke={colors.stroke} strokeOpacity="0.7" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Execution Lane Shelf */}
          <div>
            <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} mb-2 font-mono tracking-wider`}>
              <span className="font-semibold uppercase" style={{ color: '#ef4444' }}>Execution Stream</span>
            </p>
            <div 
              className="p-4 sm:p-6 overflow-visible"
              style={{
                backgroundColor: 'rgba(156, 163, 175, 0.05)',
                boxShadow: `
                  inset 0 2px 8px 0 rgba(156, 163, 175, 0.25),
                  inset 0 1px 2px 0 rgba(156, 163, 175, 0.2)
                `,
              border: '1px solid rgba(156, 163, 175, 0.3)',
            }}
          >
              <div className="flex items-center justify-center gap-3 sm:gap-4 overflow-visible">
                <ExecutingStage 
                  block={executingBlock} 
                  colors={colors} 
                  onBlockComplete={handleBlockExecutionComplete}
                />
                <FlowArrow colors={colors} />
                <ExecutedStage blocks={executedBlocks} colors={colors} isSettling={isSettling} />
                <FlowArrow colors={colors} />
                <SettledStage blocks={settledBlocks} colors={colors} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explainer paragraph */}
      <div className="mt-4 md:mt-6">
        <p className={`text-base sm:text-base ${colors.text} leading-relaxed`}>
          Consensus orders transactions and validates gas payment without running the VM. The queue buffers accepted blocks while execution drains them. Results stream to clients immediately. Settlement follows 5 seconds later.
        </p>
      </div>
    </div>
  )
}

