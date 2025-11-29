"use client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, Block, Transaction, SAE_CONFIG, MAX_TX, getRandomTxColor } from "./types"
import { FlowArrow, BlockchainBlock, QueueBlock } from "./shared"

function MempoolStage({ txs, colors }: { txs: Transaction[]; colors: Colors }) {
  const maxSlots = 18 // 6 columns x 3 rows
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex flex-col items-center gap-3 relative">
      <div 
        className={`relative w-36 h-24 border ${colors.border} cursor-help`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Background grid slots */}
        <div
          className="absolute inset-2 grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}
        >
          {Array.from({ length: maxSlots }).map((_, i) => (
            <div
              key={`slot-${i}`}
              style={{
                width: 10,
                height: 10,
                backgroundColor: `${colors.stroke}10`,
                opacity: 0.3,
              }}
            />
          ))}
        </div>
        
        {/* Animated transaction dots that fly out to the right when consumed */}
        <div className="absolute inset-2 overflow-visible">
          <AnimatePresence>
            {txs.slice(0, maxSlots).map((tx) => {
              // Use stable slot from transaction
              const row = Math.floor(tx.slot / 6)
              const col = tx.slot % 6
              return (
                <motion.div
                  key={tx.id}
                  className="absolute"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: tx.color,
                    left: col * 16, // 10px dot + ~6px gap
                    top: row * 16,
                  }}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ 
                    x: 100, 
                    opacity: 0, 
                    scale: 0.5,
                    transition: { duration: 0.35, ease: "easeOut" }
                  }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}
          </AnimatePresence>
        </div>

        <motion.div
          className="absolute inset-0 pointer-events-none border"
          style={{ borderColor: `${colors.stroke}20` }}
          animate={{
            borderColor: [`${colors.stroke}10`, `${colors.stroke}25`, `${colors.stroke}10`],
          }}
          transition={{
            duration: 2,
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
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
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
              <div className={`text-[9px] font-mono leading-relaxed`} style={{ color: `${colors.stroke}90` }}>
                <p>Incoming transactions arrive via RPC and are collected in the mempool.</p>
                <p className="mt-2">Block builders select transactions from this pool to create proposed blocks.</p>
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
  
  return (
    <div className="flex flex-col items-center gap-3 flex-1 justify-center relative">
      <div
        className={`relative flex items-center justify-center overflow-hidden pt-2 cursor-help`}
        style={{ border: `2px dashed ${colors.stroke}30`, width: 80, height: 80 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={block.uid}
              initial={{ scale: 0.3, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, x: 30 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 25,
                delay: 0.25 // Delay to sync with mempool exit animation
              }}
            >
              <BlockchainBlock colors={colors} txCount={block.txCount} txColors={block.txColors} id={block.id} showHash />
            </motion.div>
          ) : (
            <span className={`text-[10px] ${colors.textFaint} uppercase tracking-widest`}>Forming</span>
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
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
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
                <p>Block builders no longer execute transactions during block building.</p>
                <p>Instead, they apply worst-case bounds on execution of ancestor blocks prior to settlement.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Minimum sender balances enforced</p>
                <p style={{ color: `${colors.stroke}70` }}>• Maximum base fee verified</p>
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

function AcceptedStage({ block, colors }: { block: Block | null; colors: Colors }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="flex flex-col items-center gap-3 relative">
      <div
        className={`relative flex items-center justify-center overflow-hidden pt-2 cursor-help`}
        style={{ width: 80, height: 80 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Grey border always visible */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ border: `1px solid ${colors.stroke}20` }}
        />
        {/* Green pulsing border - only when block is present, delayed until proposed animation done */}
        {block && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-20"
            style={{ border: `2px solid #22c55e` }}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.5, 1, 0.5],
              boxShadow: [
                '0 0 0px rgba(34, 197, 94, 0)',
                '0 0 12px rgba(34, 197, 94, 0.5)',
                '0 0 0px rgba(34, 197, 94, 0)',
              ]
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0.5 // Delay to wait for proposed animation to finish
            }}
          />
        )}
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
              {/* Single validation checkmark */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
                className={`absolute -top-1.5 -right-1.5 w-4 h-4 border ${colors.borderStrong} flex items-center justify-center z-10`}
                style={{ backgroundColor: `${colors.stroke}10` }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                  <motion.path
                    d="M5 13l4 4L19 7"
                    stroke={colors.stroke}
                    strokeOpacity="0.8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.15, duration: 0.2 }}
                  />
                </svg>
              </motion.div>
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
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
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
              <div className={`text-[10px] font-mono uppercase tracking-wider ${colors.text} mb-2`}>
                Consensus Accepted
              </div>
              <div className={`text-[9px] font-mono leading-relaxed`} style={{ color: `${colors.stroke}90` }}>
                <p>Once a block is marked as accepted by consensus, it is placed in a FIFO execution queue.</p>
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
        {/* Clockwise border loading animation using pathLength for seamless loop */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <motion.rect
            x="1"
            y="1"
            rx="0"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray="15 85"
            strokeLinecap="round"
            animate={{ strokeDashoffset: [0, -100] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
        </svg>
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
              exit={{ scale: 0, x: -20, opacity: 0 }}
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
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
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
                FIFO Queue
              </div>
              <div className={`text-[9px] font-mono leading-relaxed`} style={{ color: `${colors.stroke}90` }}>
                <p>Accepted blocks wait in a first-in, first-out queue until the executor is ready to process them.</p>
                <p className="mt-2">This decouples consensus from execution, allowing both to run at maximum speed.</p>
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

function ExecutingBlock({ block, colors, totalTxCount, startIndex }: { 
  block: Block; 
  colors: Colors; 
  totalTxCount: number;
  startIndex: number;
}) {
  const [executedCount, setExecutedCount] = useState(0)
  const blockTxCount = block.txCount
  
  useEffect(() => {
    // Reset when block changes
    setExecutedCount(0)
    
    // Calculate interval: spread all transactions across 5 seconds
    // Leave 500ms buffer at start and end for visual smoothness
    const availableTime = SAE_CONFIG.executionTime - 800
    const interval = availableTime / totalTxCount
    
    // Start executing this block's transactions after previous blocks' transactions
    const startDelay = 400 + (startIndex * interval)
    
    const timers: NodeJS.Timeout[] = []
    
    for (let i = 0; i < blockTxCount; i++) {
      const timer = setTimeout(() => {
        setExecutedCount(prev => prev + 1)
      }, startDelay + (i * interval))
      timers.push(timer)
    }
    
    return () => {
      timers.forEach(t => clearTimeout(t))
    }
  }, [block.uid, blockTxCount, totalTxCount, startIndex])
  
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`border ${colors.borderStrong} grid gap-0.5 p-1 relative overflow-hidden`}
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          width: 40,
          height: 40,
          backgroundColor: `${colors.stroke}05`,
        }}
      >
        {Array.from({ length: MAX_TX }).map((_, i) => {
          const isTransaction = i < block.txCount
          const isExecuted = i < executedCount
          const txColor = block.txColors[i] || `${colors.stroke}40`
          
          return (
            <div key={i} className="relative" style={{ aspectRatio: "1" }}>
              {/* Background slot */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: `${colors.stroke}10`,
                }}
              />
              {/* Transaction dot that animates out when executed */}
              {isTransaction && (
                <motion.div
                  className="absolute inset-0"
                  style={{ backgroundColor: txColor }}
                  initial={{ scale: 1, opacity: 1 }}
                  animate={isExecuted ? {
                    scale: [1, 1.3, 0],
                    opacity: [1, 1, 0],
                    y: [0, -2, -8],
                  } : {
                    scale: 1,
                    opacity: 1,
                  }}
                  transition={isExecuted ? {
                    duration: 0.25,
                    ease: "easeOut",
                  } : {}}
                />
              )}
              {/* Executed checkmark flash */}
              {isTransaction && isExecuted && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.6] }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="#22c55e"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      <span className={`text-[6px] font-mono ${colors.textFaint}`}>
        #{block.id.toString().padStart(3, "0")}
      </span>
    </div>
  )
}

function ExecutedStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  // Calculate total transaction count across all blocks for timing
  const totalTxCount = blocks.reduce((sum, b) => sum + b.txCount, 0)
  
  // Calculate starting index for each block
  let runningIndex = 0
  const blockStartIndices = blocks.map(block => {
    const startIndex = runningIndex
    runningIndex += block.txCount
    return startIndex
  })
  
  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center gap-2 p-3 overflow-hidden cursor-help`}
        style={{
          width: 240,
          height: 80,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Red marching ants border */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
          <motion.rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="8 6"
            animate={{ strokeDashoffset: [0, -28] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </svg>
        <AnimatePresence mode="wait">
          {blocks.length > 0 ? (
            <motion.div
              key={blocks.map((b) => b.uid).join("-")}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              {blocks.map((block, idx) => (
                <ExecutingBlock 
                  key={block.uid} 
                  block={block} 
                  colors={colors}
                  totalTxCount={totalTxCount}
                  startIndex={blockStartIndices[idx]}
                />
              ))}
            </motion.div>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`text-[10px] uppercase tracking-widest ${colors.textFaint}`}
            >
              Idle
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Executing</span>
      
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
            style={{ width: 320 }}
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
                <p>Each client runs a block executor in parallel, constantly processing blocks from the FIFO queue.</p>
                <p>The executor provides deterministic timestamps for the beginning and end of each block&apos;s execution.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Block header timestamp used for ordering</p>
                <p style={{ color: `${colors.stroke}70` }}>• Gas charged tracks execution time</p>
                <p style={{ color: `${colors.stroke}70` }}>• Blocks execute on top of last executed state</p>
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

function SettledStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const visibleBlocks = blocks.slice(-16)
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex flex-col items-center gap-2 relative">
      <div
        className={`${colors.blockBg} p-1.5 overflow-hidden relative cursor-help`}
        style={{ width: 130, height: 110 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Pulsing secure border on container */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ border: `2px solid #22c55e` }}
          animate={{ 
            opacity: [0.3, 0.7, 0.3],
            boxShadow: [
              '0 0 0px rgba(34, 197, 94, 0)',
              '0 0 8px rgba(34, 197, 94, 0.4)',
              '0 0 0px rgba(34, 197, 94, 0)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
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
        <div className="grid grid-cols-4 gap-1 h-full relative z-10">
          <AnimatePresence mode="popLayout">
            {visibleBlocks.map((block, index) => (
              <motion.div
                key={block.uid}
                layout
                initial={{ x: -60, y: -20, opacity: 0, scale: 0.5 }}
                animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: index >= visibleBlocks.length - 4 ? (index - (visibleBlocks.length - 4)) * 0.08 : 0,
                }}
                className={`border ${colors.borderStrong} grid gap-px p-0.5 relative`}
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  width: 24,
                  height: 24,
                  backgroundColor: `${colors.stroke}05`,
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
            className="absolute z-50 top-full mt-4 left-1/2 -translate-x-1/2"
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
                <p>Executed blocks are settled once a following block that includes their results is accepted.</p>
                <p>Results are included by setting the state root to that of the last executed block and the receipt root to an MPT of all receipts since last settlement.</p>
                <p style={{ color: `${colors.stroke}70` }}>• Multiple blocks can be settled at once</p>
                <p style={{ color: `${colors.stroke}70` }}>• A constant delay amortizes sporadic executor slowdowns</p>
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
  const [executingBlocks, setExecutingBlocks] = useState<Block[]>([])
  const [settledBlocks, setSettledBlocks] = useState<Block[]>([])

  const blockIdRef = useRef(0)
  const txIdRef = useRef(0)
  const queueRef = useRef<Block[]>([])
  const executingRef = useRef<Block[]>([])

  useEffect(() => {
    queueRef.current = queuedBlocks
  }, [queuedBlocks])

  useEffect(() => {
    executingRef.current = executingBlocks
  }, [executingBlocks])

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
            // Cap queue at 5 to prevent it from getting too full
            if (q.length >= 5) {
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

      // Step 3: Form new block from mempool (synced with proposed block animation)
      setTimeout(() => {
        setMempoolTxs((currentMempool) => {
          if (currentMempool.length >= 4) {
            // Calculate everything deterministically based on current state
            const nextBlockId = blockIdRef.current + 1
            const now = Date.now()
            
            // Take 4-16 transactions (capped at MAX_TX for visual consistency)
            const takeAll = currentMempool.length <= 8 && Math.random() > 0.6
            const availableToTake = Math.min(currentMempool.length, MAX_TX)
            const txCount = takeAll 
              ? availableToTake 
              : Math.min(Math.floor(Math.random() * 9) + 4, availableToTake)
            
            // Shuffle indices and pick which transactions to include
            const shuffledIndices = Array.from({ length: currentMempool.length }, (_, i) => i)
              .sort(() => Math.random() - 0.5)
            const takenIndices = shuffledIndices.slice(0, txCount)
            const keepIndices = new Set(shuffledIndices.slice(txCount))
            
            // Capture colors from taken transactions
            const txColors = takenIndices.map(i => currentMempool[i].color)
            
            blockIdRef.current = nextBlockId
            
            const newBlock: Block = {
              id: nextBlockId,
              uid: `${nextBlockId}-${now}-${Math.random().toString(36).slice(2, 9)}`,
              txCount,
              txColors,
              createdAt: now,
            }
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

  useEffect(() => {
    const tryExecute = () => {
      if (executingRef.current.length === 0 && queueRef.current.length > 0) {
        setQueuedBlocks((prev) => {
          if (prev.length > 0) {
            // Randomly take 1-4 blocks, weighted by queue fullness
            const random = Math.random()
            let takeCount: number
            if (prev.length >= 4) {
              // Queue is full - take 2-4 blocks
              if (random > 0.7) takeCount = 4
              else if (random > 0.4) takeCount = 3
              else takeCount = 2
            } else if (prev.length >= 3) {
              // Queue has some blocks - take 1-3 blocks
              if (random > 0.7) takeCount = 3
              else if (random > 0.3) takeCount = 2
              else takeCount = 1
            } else if (prev.length >= 2) {
              // Queue is low - usually take 1, sometimes 2
              takeCount = random > 0.6 ? 2 : 1
            } else {
              takeCount = 1
            }
            takeCount = Math.min(takeCount, prev.length)

            const blocksToExecute = prev.slice(0, takeCount)
            const rest = prev.slice(takeCount)

            setExecutingBlocks(blocksToExecute)
            return rest
          }
          return prev
        })
      }
    }

    tryExecute()
    const interval = setInterval(tryExecute, SAE_CONFIG.queueCheckInterval)
    return () => clearInterval(interval)
  }, [queuedBlocks, executingBlocks])

  useEffect(() => {
    if (executingBlocks.length > 0) {
      const timeout = setTimeout(() => {
        setSettledBlocks((prev) => {
          // Filter out any blocks that are already settled (Strict Mode protection)
          const existingUids = new Set(prev.map((b) => b.uid))
          const newBlocks = executingBlocks.filter((b) => !existingUids.has(b.uid))
          if (newBlocks.length === 0) return prev
          return [...prev.slice(-(12 - newBlocks.length)), ...newBlocks]
        })
        setExecutingBlocks([])
      }, SAE_CONFIG.executionTime)
      return () => clearTimeout(timeout)
    }
  }, [executingBlocks])

  return (
    <>
      {/* Consensus Lane */}
      <div className="mb-1 md:mb-2">
        <div className="flex items-center gap-2 mb-2 md:mb-3 px-1">
          <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
            Consensus Stream (<a href="/docs/primary-network/avalanche-consensus" className="hover:underline cursor-pointer text-blue-500 hover:text-blue-400">Snowman</a>)
          </span>
        </div>

        <div className={`border ${colors.border} p-2 sm:p-6 ${colors.blockBg}`}>
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
              <AcceptedStage block={acceptedBlock} colors={colors} />
            </div>
          </div>
        </div>
        <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} mt-2 md:mt-4 font-mono uppercase tracking-wider`}>
          Rapidly accept blocks with lightweight consensus validation
        </p>
      </div>

      {/* Connection */}
      <div className="flex justify-end pr-24 py-0 md:py-1">
        <svg width="24" height="36" viewBox="0 0 24 36">
          <line
            x1="12"
            y1="0"
            x2="12"
            y2="28"
            stroke={colors.stroke}
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <path
            d="M7 24l5 8 5-8"
            stroke={colors.stroke}
            strokeOpacity="0.3"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Queue */}
      <div className="mb-1 md:mb-2">
        <div className="flex items-center gap-2 mb-2 md:mb-3 px-1">
          <span className={`text-sm sm:text-xs md:text-[11px] ${colors.text} uppercase tracking-widest font-semibold`}>FIFO Queue</span>
        </div>

        <div className={`border ${colors.border} p-2 md:p-4 ${colors.blockBg}`}>
          <QueueStage blocks={queuedBlocks} colors={colors} />
        </div>
        <p className={`text-sm sm:text-xs md:text-[11px] ${colors.textMuted} mt-2 md:mt-4 font-mono uppercase tracking-wider`}>
         Buffer blocks in a FIFO queue, decoupling the two streams
        </p>
      </div>

      {/* Connection */}
      <div className="flex justify-start pl-24 py-0 md:py-1">
        <svg width="24" height="36" viewBox="0 0 24 36">
          <line
            x1="12"
            y1="0"
            x2="12"
            y2="28"
            stroke={colors.stroke}
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <path
            d="M7 24l5 8 5-8"
            stroke={colors.stroke}
            strokeOpacity="0.3"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Execution Lane */}
      <div className="mt-0 md:mt-1">
        <div className="flex items-center gap-2 mb-2 md:mb-3 px-1">
          <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
            Execution Stream
          </span>
        </div>
        <div className={`border ${colors.border} ${colors.blockBg} p-2 sm:p-4`}>
          <div className="flex items-center justify-center gap-6">
            <div className="flex justify-center" style={{ minWidth: 140 }}>
              <ExecutedStage blocks={executingBlocks} colors={colors} />
            </div>
            <FlowArrow colors={colors} />
            <div className="flex justify-start">
              <SettledStage blocks={settledBlocks} colors={colors} />
            </div>
          </div>
        </div>
        <p className={`text-sm sm:text-xs md:text-[11px] text-red-500 mt-2 md:mt-4 font-mono uppercase tracking-wider`}>
          Stream the execution of blocks, get receipts instantly
        </p>
      </div>
    </>
  )
}

