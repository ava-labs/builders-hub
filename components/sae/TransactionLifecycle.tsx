"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Block {
  id: number
  createdAt: number
}

export function TransactionLifecycle() {
  const [mempoolTxs, setMempoolTxs] = useState<Block[]>([])
  const [proposedBlocks, setProposedBlocks] = useState<Block[]>([])
  const [acceptedBlocks, setAcceptedBlocks] = useState<Block[]>([])
  const [queuedBlocks, setQueuedBlocks] = useState<Block[]>([])
  const [executingBlock, setExecutingBlock] = useState<Block | null>(null)
  const [settledBlocks, setSettledBlocks] = useState<Block[]>([])

  const blockIdRef = useRef(0)

  const colors = {
    text: "text-foreground",
    textMuted: "text-muted-foreground",
    textFaint: "text-muted-foreground/50",
    textSubtle: "text-muted-foreground/60",
    border: "border-border",
    borderStrong: "border-border",
    borderFaint: "border-border/50",
    cardBg: "bg-muted/30",
    blockBg: "bg-muted",
    blockBgStrong: "bg-muted",
    blockSolid: "bg-foreground/60",
    blockMuted: "bg-foreground/40",
    blockFaint: "bg-foreground/50",
    stroke: "currentColor",
  }

  useEffect(() => {
    const scheduleMempoolTx = () => {
      // Random interval between 100ms and 500ms for organic feel
      const delay = Math.random() * 400 + 100

      const timeout = setTimeout(() => {
        blockIdRef.current += 1
        setMempoolTxs((prev) => [...prev.slice(-8), { id: blockIdRef.current, createdAt: Date.now() }])
        scheduleMempoolTx()
      }, delay)

      return timeout
    }

    const timeout = scheduleMempoolTx()
    return () => clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const proposeInterval = setInterval(() => {
      setMempoolTxs((prev) => {
        if (prev.length >= 3) {
          blockIdRef.current += 1
          const newBlock = { id: blockIdRef.current, createdAt: Date.now() }
          
          // Step 1: Show in Proposed (replace any existing)
          setProposedBlocks([newBlock])
          
          // Step 2: After delay, remove from Proposed and show in Accepted
          setTimeout(() => {
            setProposedBlocks([])
            setAcceptedBlocks([newBlock])
            
            // Step 3: After another delay, remove from Accepted and add to Queue
            setTimeout(() => {
              setAcceptedBlocks([])
              setQueuedBlocks((q) => {
                if (q.some(b => b.id === newBlock.id)) return q
                return [...q.slice(-4), newBlock]
              })
            }, 600)
            
          }, 500)
          
          return prev.slice(3)
        }
        return prev
      })
    }, 1400) // Increased to ensure no overlap (500 + 600 + buffer)

    return () => clearInterval(proposeInterval)
  }, [])

  useEffect(() => {
    const executeInterval = setInterval(() => {
      if (!executingBlock) {
        setQueuedBlocks((prev) => {
          if (prev.length > 1) { // Only execute when there's more than 1 in queue
            const [toExecute, ...rest] = prev
            setExecutingBlock(toExecute)
            return rest
          }
          return prev
        })
      }
    }, 800)

    return () => clearInterval(executeInterval)
  }, [executingBlock])

  useEffect(() => {
    if (executingBlock) {
      const executionTime = 700 + Math.random() * 200 // 700-900ms
      const timeout = setTimeout(() => {
        setSettledBlocks((prev) => {
          // Prevent duplicates
          if (prev.some(b => b.id === executingBlock.id)) return prev
          return [...prev.slice(-11), executingBlock]
        })
        setExecutingBlock(null)
      }, executionTime)
      return () => clearTimeout(timeout)
    }
  }, [executingBlock])

  return (
    <div
      className="relative w-full min-h-screen flex flex-col items-center justify-center p-8 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(currentColor 1px, transparent 1px),
                           linear-gradient(90deg, currentColor 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 relative z-10"
      >
        <h1 className={`text-4xl md:text-5xl font-extralight ${colors.text} mb-3 tracking-tight`}>
          Streaming Async Execution
        </h1>
        <p className={`${colors.textFaint} text-sm font-light tracking-widest uppercase`}>
          Consensus & Execution Decoupled
        </p>
      </motion.div>

      <div className="w-full max-w-6xl space-y-8">
        <div className="relative">
          <div
            className={`absolute -left-4 top-1/2 -translate-y-1/2 text-[10px] ${colors.textFaint} uppercase tracking-widest writing-mode-vertical rotate-180`}
            style={{ writingMode: "vertical-rl" }}
          >
            Consensus
          </div>

          <div className="flex items-center gap-4 pl-8">
            <MempoolStage txs={mempoolTxs} colors={colors} />
            <Arrow colors={colors} />
            <ProposedStage blocks={proposedBlocks} colors={colors} />
            <Arrow colors={colors} />
            <AcceptedStage blocks={acceptedBlocks} colors={colors} />
            <DownArrow colors={colors} />
          </div>
        </div>

        <div className="flex justify-center">
          <QueueStage blocks={queuedBlocks} colors={colors} />
        </div>

        <div className="relative">
          <div
            className={`absolute -left-4 top-1/2 -translate-y-1/2 text-[10px] ${colors.textFaint} uppercase tracking-widest`}
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Execution
          </div>

          <div className="flex items-center gap-4 pl-8 justify-end pr-8">
            <UpArrow colors={colors} />
            <ExecutedStage block={executingBlock} colors={colors} />
            <Arrow colors={colors} />
            <SettledStage blocks={settledBlocks} colors={colors} />
          </div>
        </div>
      </div>
    </div>
  )
}

interface Colors {
  text: string
  textMuted: string
  textFaint: string
  textSubtle: string
  border: string
  borderStrong: string
  borderFaint: string
  cardBg: string
  blockBg: string
  blockBgStrong: string
  blockSolid: string
  blockMuted: string
  blockFaint: string
  stroke: string
}

function MempoolStage({ txs, colors }: { txs: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-32 h-24 rounded-xl border ${colors.border} ${colors.cardBg} overflow-hidden`}>
        <div className="absolute inset-2 flex flex-wrap gap-1 content-start">
          <AnimatePresence mode="popLayout">
            {txs.slice(-12).map((tx) => (
              <motion.div
                key={`mempool-${tx.id}`}
                layout
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                exit={{ scale: 0, x: 20 }}
                className={`w-2 h-2 rounded-sm ${colors.blockSolid}`}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
      <span className={`mt-2 text-xs ${colors.textMuted}`}>Mempool</span>
    </div>
  )
}

function ProposedStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative w-28 h-24 rounded-xl border ${colors.border} ${colors.cardBg} flex items-center justify-center`}
      >
        <AnimatePresence mode="wait">
          {blocks.length > 0 && (
            <motion.div
              key={`proposed-${blocks[blocks.length - 1]?.id}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, x: 30 }}
              className={`w-12 h-12 rounded-lg border-2 ${colors.borderStrong} ${colors.blockBg} flex items-center justify-center`}
            >
              <div className="grid grid-cols-2 gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-sm ${colors.blockFaint}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={`absolute inset-0 rounded-xl border ${colors.borderFaint}`}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
        />
      </div>
      <span className={`mt-2 text-xs ${colors.textMuted}`}>Proposed</span>
    </div>
  )
}

function AcceptedStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative w-28 h-24 rounded-xl border ${colors.border} ${colors.cardBg} flex items-center justify-center`}
      >
        <AnimatePresence mode="wait">
          {blocks.length > 0 && (
            <motion.div
              key={`accepted-${blocks[blocks.length - 1]?.id}`}
              initial={{ scale: 0.8, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              className="relative"
            >
              <div className={`w-10 h-10 rounded-lg border ${colors.borderStrong} ${colors.blockBg}`} />
              <div className="absolute -right-2 -top-2 flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.svg
                    key={i}
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                  >
                    <path d="M5 13l4 4L19 7" stroke={colors.stroke} strokeWidth="3" strokeLinecap="round" />
                  </motion.svg>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={`absolute w-20 h-20 rounded-full border border-dashed ${colors.borderFaint}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      </div>
      <span className={`mt-2 text-xs ${colors.textMuted}`}>Accepted</span>
    </div>
  )
}

function QueueStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`mb-2 text-[10px] ${colors.textSubtle} uppercase tracking-widest`}>Execution Queue (FIFO)</span>
      <div
        className={`relative h-14 min-w-[240px] max-w-[320px] rounded-xl border ${colors.borderStrong} ${colors.cardBg} flex items-center px-3 gap-2 overflow-hidden`}
      >
        <AnimatePresence mode="popLayout">
          {blocks.map((block, i) => (
            <motion.div
              key={`queue-${block.id}`}
              layout
              initial={{ scale: 0, x: -30 }}
              animate={{ scale: 1, x: 0 }}
              exit={{ scale: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`w-7 h-7 rounded-lg border ${colors.borderStrong} ${colors.blockBg} flex-shrink-0 flex items-center justify-center`}
            >
              <span className={`text-[8px] ${colors.textSubtle}`}>{i + 1}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {blocks.length === 0 && <span className={`${colors.textFaint} text-xs`}>Empty</span>}
      </div>
    </div>
  )
}

function ExecutedStage({ block, colors }: { block: Block | null; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative w-28 h-24 rounded-xl border ${colors.border} ${colors.cardBg} flex items-center justify-center`}
      >
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={`executing-${block.id}`}
              initial={{ scale: 0.5, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0, x: 30 }}
              className="relative"
            >
              <motion.div
                className="absolute -inset-3 rounded-full"
                style={{
                  border: `2px solid transparent`,
                  borderTopColor: `${colors.stroke}80`,
                  borderRightColor: `${colors.stroke}4D`,
                  borderBottomColor: `${colors.stroke}1A`,
                  borderLeftColor: `${colors.stroke}1A`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              />
              <div
                className={`w-10 h-10 rounded-lg border ${colors.borderStrong} ${colors.blockBgStrong} flex items-center justify-center`}
              >
                <motion.div
                  className={`w-3 h-3 rounded ${colors.blockSolid}`}
                  animate={{ scale: [1, 0.8, 1] }}
                  transition={{ duration: 0.3, repeat: Number.POSITIVE_INFINITY }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} className={`text-xs ${colors.textFaint}`}>
              Waiting...
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <span className={`mt-2 text-xs ${colors.textMuted}`}>Executing</span>
    </div>
  )
}

function SettledStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`relative w-32 h-24 rounded-xl border ${colors.border} ${colors.cardBg} overflow-hidden`}>
        <div className="absolute inset-2 flex flex-wrap gap-1 content-start">
          <AnimatePresence mode="popLayout">
            {blocks.slice(-30).map((block) => (
              <motion.div
                key={`settled-${block.id}`}
                layout
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                className={`w-3 h-3 rounded ${colors.blockMuted}`}
              />
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          className={`absolute bottom-1 right-1 ${colors.textSubtle}`}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </motion.div>
      </div>
      <span className={`mt-2 text-xs ${colors.textMuted}`}>Settled</span>
    </div>
  )
}

function Arrow({ colors }: { colors: Colors }) {
  return (
    <div className="flex items-center px-2">
      <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
        <path
          d="M2 6h18M18 2l4 4-4 4"
          stroke={colors.stroke}
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function DownArrow({ colors }: { colors: Colors }) {
  return (
    <div className="flex flex-col items-center ml-4">
      <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
        <path
          d="M8 4v16M8 20l-4-4M8 20l4-4"
          stroke={colors.stroke}
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function UpArrow({ colors }: { colors: Colors }) {
  return (
    <div className="flex flex-col items-center mr-4">
      <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
        <path
          d="M8 20V4M8 4l-4 4M8 4l4 4"
          stroke={colors.stroke}
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default TransactionLifecycle

