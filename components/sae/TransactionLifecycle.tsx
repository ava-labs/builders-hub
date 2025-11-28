"use client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import Link from "next/link"
import { AvalancheLogo } from "@/components/navigation/avalanche-logo"
import { AssemblyLineCard } from "./AssemblyLineAnimation"

// C-Chain spec: tau = 5s
const SAE_CONFIG = {
  tau: 5000, // Duration between execution and settlement (ms) - C-Chain = 5s
  // Derived timings (can be overridden)
  get consensusInterval() {
    return 1500 // 1.5 second consensus rhythm
  },
  get executionTime() {
    return 5000 // 5 second execution time
  },
  get mempoolMinDelay() {
    return 120 // Calm minimum delay
  },
  get mempoolMaxDelay() {
    return 280 // Calm maximum delay
  },
  get mempoolBatchMin() {
    return 1 // 1 transaction per batch minimum
  },
  get mempoolBatchMax() {
    return 2 // Up to 2 transactions per batch
  },
  get queueCheckInterval() {
    return 100 // Short interval for queue check
  },
}

// Vibrant transaction colors
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

function getRandomTxColor() {
  return TX_COLORS[Math.floor(Math.random() * TX_COLORS.length)]
}

interface Block {
  id: number
  uid: string // Unique identifier for React keys
  txCount: number
  txColors: string[] // Colors of transactions in this block
  createdAt: number
  spanCount?: number // Number of consensus blocks this execution block spans
}

interface Transaction {
  id: number
  color: string
  slot: number // Stable slot position in mempool grid
}

interface Colors {
  bg: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  borderStrong: string
  blockBg: string
  blockBgStrong: string
  blockSolid: string
  blockFaint: string
  stroke: string
}

const MAX_TX = 16 // 4x4 grid = 16 transactions per block

function BlockchainBlock({
  colors,
  id,
  txCount = MAX_TX,
  txColors = [],
  showHash = true,
}: {
  colors: Colors
  id?: number
  txCount?: number
  txColors?: string[]
  showHash?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`border ${colors.borderStrong} grid gap-1 p-1.5`}
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          width: 48,
          height: 48,
          backgroundColor: `${colors.stroke}05`,
        }}
      >
          {[...Array(16)].map((_, i) => (
          <div
              key={i}
              style={{
              aspectRatio: "1",
              backgroundColor: i < txCount 
                ? (txColors[i] || `${colors.stroke}40`)
                : `${colors.stroke}10`,
              }}
            />
          ))}
      </div>

      {/* Block hash preview */}
      {showHash && id && (
        <span className={`text-[8px] font-mono ${colors.textFaint}`}>#{id.toString().padStart(3, "0")}</span>
      )}
    </div>
  )
}

function QueueBlock({ colors, id, txCount = 16, txColors = [] }: { colors: Colors; id: number; txCount?: number; txColors?: string[] }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
    <div
      className={`border ${colors.borderStrong} flex items-center justify-center`}
      style={{
        width: 32,
        height: 32,
        backgroundColor: `${colors.stroke}08`,
      }}
    >
      <div className="grid grid-cols-4 gap-0.5" style={{ padding: 3 }}>
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: 4,
                backgroundColor: i < txCount 
                  ? (txColors[i] || `${colors.stroke}35`)
                  : `${colors.stroke}10`,
            }}
          />
        ))}
      </div>
      </div>
      <span className={`text-[7px] font-mono ${colors.textFaint}`}>#{id.toString().padStart(3, "0")}</span>
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
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Proposed</span>
      
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

function ExecutedStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const [showTooltip, setShowTooltip] = useState(false)
  
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
        <motion.div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${colors.stroke}15 50%, transparent 100%)`,
            width: "30%",
            left: 0,
          }}
          animate={{ x: ["-100%", "400%"] }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
        <AnimatePresence mode="wait">
          {blocks.length > 0 ? (
            <motion.div
              key={blocks.map((b) => b.uid).join("-")}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              {blocks.map((block) => (
                <div key={block.uid} className="flex flex-col items-center gap-0.5">
                <div
                    className={`border ${colors.borderStrong} grid gap-0.5 p-1`}
                  style={{
                    gridTemplateColumns: "repeat(4, 1fr)",
                      width: 40,
                      height: 40,
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
                  </div>
                  <span className={`text-[6px] font-mono ${colors.textFaint}`}>
                    #{block.id.toString().padStart(3, "0")}
                  </span>
                </div>
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

function DecouplingDiagram({ colors }: { colors: Colors }) {
  const blockSize = 120
  const gap = 32
  const consensusY = 0
  const executionY = blockSize + 60 // increased gap for more arrow room

  const consensusBlocks = [0, 1, 2, 3, 4].map((i) => ({
    id: i,
    x: i * (blockSize + gap),
    y: consensusY,
    width: blockSize,
    height: blockSize,
  }))

  const executionBlocks = [
    {
      id: 0,
      x: 0, // under first consensus block
      width: blockSize * 0.6,
      height: blockSize * 1.2,
    },
    {
      id: 1,
      x: (blockSize + gap) * 1.2, // starts after first execution block
      width: (blockSize + gap) * 2.5,
      height: blockSize * 1.2,
      hasBrace: true,
    },
    {
      id: 2,
      x: (blockSize + gap) * 4, // under 5th consensus block
      width: blockSize * 1.2,
      height: blockSize * 1.2,
    },
  ]

  const arrows = [
    // 1st consensus -> 1st execution (straight down)
    { fromConsensus: 0, toExec: 0, targetX: executionBlocks[0].x + executionBlocks[0].width / 2, color: colors.stroke },
    // 2nd consensus -> left half of large middle (diagonal right)
    {
      fromConsensus: 1,
      toExec: 1,
      targetX: executionBlocks[1].x + executionBlocks[1].width * 0.25,
      color: colors.stroke,
    },
    // 3rd consensus -> center of large middle (straight down)
    { fromConsensus: 2, toExec: 1, targetX: executionBlocks[1].x + executionBlocks[1].width * 0.5, color: "#ef4444" },
    // 4th consensus -> right half of large middle (diagonal left)
    { fromConsensus: 3, toExec: 1, targetX: executionBlocks[1].x + executionBlocks[1].width * 0.75, color: "#ef4444" },
    // 5th consensus -> 3rd execution (straight down)
    { fromConsensus: 4, toExec: 2, targetX: executionBlocks[2].x + executionBlocks[2].width / 2, color: colors.stroke },
  ]

  const totalWidth = 5 * blockSize + 4 * gap + blockSize * 0.5
  const totalHeight = executionY + blockSize * 1.2 + 60

  const wideExec = executionBlocks.find((e) => e.hasBrace)!
  const braceStart = wideExec.x + wideExec.width * 0.3
  const braceEnd = wideExec.x + wideExec.width * 0.9
  const braceCenter = (braceStart + braceEnd) / 2
  const braceY = executionY + wideExec.height + 8

  return (
    <div className="mb-2 mt-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Block Relationship
        </span>
      </div>

      <div className={`border ${colors.border} p-6 sm:p-8 ${colors.blockBg} overflow-x-auto`}>
        {/* Legend */}
        <div className="flex items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4"
              style={{ backgroundColor: `${colors.stroke}25`, border: `1px solid ${colors.stroke}40` }}
            />
            <span className={`text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Consensus Stream</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: "#ef4444", border: `1px solid #ef4444` }} />
            <span className={`text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Execution Stream</span>
          </div>
        </div>

        <div className="relative mx-auto" style={{ width: "600px", height: "260px" }}>
          {/* SVG Layer */}
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <marker id="arrow-white" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill={colors.stroke} fillOpacity="0.6" />
              </marker>
              <marker id="arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Connections */}
            {/* C0 (64) -> E1 start (88) */}
            <line x1="64" y1="64" x2="88" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* E1 end (152) -> C2 (176) */}
            <line x1="152" y1="120" x2="176" y2="64" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />
            
            {/* C1 (152) -> E2 start (176) */}
            <line x1="152" y1="64" x2="176" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C2 (240) -> E2 mid (264) */}
            <line x1="240" y1="64" x2="264" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C3 (328) -> E2 mid (352) */}
            <line x1="328" y1="64" x2="352" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* E2 1st divider (264) -> C4 (352) */}
            <line x1="264" y1="120" x2="352" y2="64" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

            {/* C5 (416) -> E3 start (464) */}
            <line x1="416" y1="64" x2="464" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C6 (504) -> E3 divider (536) */}
            <line x1="504" y1="64" x2="536" y2="120" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />

            {/* Curly Bracket under E2 (From first divider to end: 264-416) */}
            <path 
              d="M 264 210 q 0 12 12 12 h 52 q 12 0 12 13 q 0 -13 12 -13 h 52 q 12 0 12 -12"
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="1.5" 
            />
            {/* Line from bracket to C5 bottom-left with rounded corner */}
            <path 
              d="M 340 235 L 418 235 Q 428 235 428 225 L 428 80 L 440 64" 
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="1.5" 
              markerEnd="url(#arrow-red)"
            />
          </svg>

          {/* Blocks Layer */}
          {/* Top Row: Consensus (6 blocks) */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute w-16 h-16 border"
              style={{
                left: `${i * 88}px`,
                top: 0,
                backgroundColor: `${colors.stroke}10`,
                borderColor: `${colors.stroke}30`,
              }}
            />
          ))}

          {/* Bottom Row: Execution (3 blocks) */}
          {/* E1: Matches C1 (88) */}
          <div
            className="absolute h-20 bg-red-500 border border-red-400"
            style={{ left: "88px", top: "120px", width: "64px" }}
          >
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
          
          {/* E2: Matches C2+C3+C4 (176) */}
          <div
            className="absolute h-20 bg-red-500 border border-red-400"
            style={{ left: "176px", top: "120px", width: "240px" }}
          >
             {/* Dividers at 88px and 176px */}
             <div className="absolute left-[88px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute left-[176px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
          
          {/* E3: Starts at 464, Wider (112px) */}
          <div
            className="absolute h-20 bg-red-500 border border-red-400"
            style={{ left: "464px", top: "120px", width: "112px" }}
          >
             {/* Divider towards end */}
             <div className="absolute left-[72px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
        </div>

      </div>
      <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider`}>
        Execution blocks can span multiple consensus blocks — consensus guarantees execution, <span className="italic normal-case">eventually</span>
      </p>

      {/* Pessimistic Fee Validation */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-6 px-1">
          <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
            Pessimistic Fee Validation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left - The Rule */}
          <div 
            className="p-6 flex flex-col justify-center"
            style={{ backgroundColor: '#ef4444' }}
          >
            <h3 className="text-xl md:text-2xl font-bold text-white leading-tight mb-4">
              Assume the worst.<br />
              Mallory can&apos;t afford that.
            </h3>
            <p className="text-white/80 text-sm font-medium uppercase tracking-wider">
              Pessimistic fee validation
            </p>
          </div>

          {/* Right - Details */}
          <div className={`border ${colors.border} p-6`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <h4 className={`text-sm font-medium ${colors.text} mb-4`}>
              Affordability ≠ Success
            </h4>
            <ul className={`text-[11px] ${colors.textMuted} space-y-2 mb-6`}>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: colors.stroke }} />
                Consensus only cares that you can pay
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: colors.stroke }} />
                Execution may still revert — that&apos;s expected behavior
              </li>
            </ul>

            <h5 className={`text-xs font-medium ${colors.text} mb-4 uppercase tracking-wider`}>
              Provable upper bound on gas price
            </h5>
            
            {/* Gas Price Graph */}
            <div className="relative h-40 border border-opacity-20" style={{ borderColor: `${colors.stroke}30`, backgroundColor: `${colors.stroke}05` }}>
              <svg className="w-full h-full" viewBox="0 0 240 100" preserveAspectRatio="xMidYMid meet">
                {/* Exponential curve */}
                <motion.path
                  d="M 10 88 C 40 85 70 80 100 72 C 130 62 155 48 175 32 C 195 16 210 6 225 2"
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeOut" }}
                />
                
                {/* Stair-step pattern: horizontal solid lines (amber) + vertical dotted lines (grey) */}
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  {/* Step 1 - bottom */}
                  <line x1="10" y1="88" x2="45" y2="88" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="45" y1="88" x2="45" y2="82" stroke={colors.stroke} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3,3" />
                  
                  {/* Step 2 */}
                  <line x1="45" y1="82" x2="85" y2="82" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="85" y1="82" x2="85" y2="72" stroke={colors.stroke} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3,3" />
                  
                  {/* Step 3 */}
                  <line x1="85" y1="72" x2="130" y2="72" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="130" y1="72" x2="130" y2="55" stroke={colors.stroke} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3,3" />
                  
                  {/* Step 4 */}
                  <line x1="130" y1="55" x2="175" y2="55" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="175" y1="55" x2="175" y2="32" stroke={colors.stroke} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3,3" />
                  
                  {/* Step 5 - top */}
                  <line x1="175" y1="32" x2="220" y2="32" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="220" y1="32" x2="220" y2="12" stroke={colors.stroke} strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3,3" />
                </motion.g>
              </svg>
            </div>
          </div>
        </div>

        <p className={`text-[11px] ${colors.textMuted} mt-4 leading-relaxed`}>
          The worst-case bound on gas price is calculated by following the block executor update rules using <span className="italic font-mono">g<sub>L</sub></span> (gas limit) rather than <span className="italic font-mono">g<sub>C</sub></span> (gas charged). Account balances are validated against the worst-case gas cost plus transaction value.
        </p>
      </div>

      {/* Technical Specification */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-6 px-1">
          <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
            Technical Specification
          </span>
        </div>
        
        {/* Configuration Parameters Table */}
        <div className="mb-8">
          <h4 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Configuration Parameters</h4>
          <div className={`border ${colors.border} overflow-hidden`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ backgroundColor: `${colors.stroke}08` }}>
                  <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>Parameter</th>
                  <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>Description</th>
                  <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>C-Chain</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                    <span className="italic text-amber-500">τ</span>
                  </td>
                  <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Duration between execution and settlement</td>
                  <td className={`p-3 font-mono font-medium ${colors.text} border-b ${colors.border}`}>5s</td>
                </tr>
                <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                    <span className="italic text-blue-500">λ</span>
                  </td>
                  <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Minimum conversion from gas limit to gas charged</td>
                  <td className={`p-3 font-mono font-medium ${colors.text} border-b ${colors.border}`}>2</td>
                </tr>
                <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                    <span className="italic text-green-500">T</span>
                  </td>
                  <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Target gas consumed per second</td>
                  <td className={`p-3 font-mono font-medium ${colors.textMuted} border-b ${colors.border}`}>Dynamic</td>
                </tr>
                <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                    <span className="italic text-purple-500">M</span>
                  </td>
                  <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Minimum gas price</td>
                  <td className={`p-3 font-mono font-medium ${colors.textMuted} border-b ${colors.border}`}>—</td>
                </tr>
                <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-mono ${colors.text}`}>
                    <span className="italic text-red-500">R</span> = 2·<span className="italic text-green-500">T</span>
                  </td>
                  <td className={`p-3 ${colors.textMuted}`}>Gas capacity added per second</td>
                  <td className={`p-3 font-mono font-medium ${colors.textMuted}`}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Formulas */}
        <h4 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Key Formulas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Gas Charged */}
          <motion.div 
            className={`border ${colors.border} p-4 relative overflow-hidden`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#22c55e50' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Gas Charged</span>
            </div>
            <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <span className="italic">g</span><sub>C</sub> := max(<span className="italic">g</span><sub>U</sub>, <span className="italic">g</span><sub>L</sub> / <span className="italic text-blue-500">λ</span>)
            </div>
            <p className={`text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
              <span className="italic font-mono">g<sub>L</sub></span> = gas limit, <span className="italic font-mono">g<sub>U</sub></span> = gas used
            </p>
          </motion.div>

          {/* Block Size */}
          <motion.div 
            className={`border ${colors.border} p-4 relative overflow-hidden`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#3b82f650' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Max Block Size</span>
            </div>
            <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <span className="italic">ω</span><sub>B</sub> := <span className="italic text-red-500">R</span> · <span className="italic text-amber-500">τ</span> · <span className="italic text-blue-500">λ</span>
            </div>
            <p className={`text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
              Blocks exceeding this are invalid
            </p>
          </motion.div>

          {/* Queue Size */}
          <motion.div 
            className={`border ${colors.border} p-4 relative overflow-hidden`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#f59e0b50' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#f59e0b' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Max Queue Size</span>
            </div>
            <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <span className="italic">ω</span><sub>Q</sub> := 2 · <span className="italic">ω</span><sub>B</sub>
            </div>
            <p className={`text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
              Queue limit before enqueueing
            </p>
          </motion.div>

          {/* Gas Price */}
          <motion.div 
            className={`border ${colors.border} p-4 relative overflow-hidden`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#a855f750' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#a855f7' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Gas Price</span>
            </div>
            <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <span className="italic text-purple-500">M</span> · exp(<span className="italic">x</span> / <span className="italic">K</span>)
            </div>
            <p className={`text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
              <span className="italic font-mono">x ≥ 0</span> excess, <span className="italic font-mono">K = 87·T</span>
            </p>
          </motion.div>
        </div>

        {/* Block Executor Updates */}
        <h4 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Block Executor Updates</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <motion.div 
            className={`border ${colors.border} p-4`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#3b82f650' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <motion.div 
                className="w-3 h-3 flex items-center justify-center"
                animate={{ rotate: [0, 180, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
              </motion.div>
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Before Execution</span>
            </div>
            <div className={`font-mono text-[11px] ${colors.textMuted} space-y-1 p-3 border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <div>Δ<span className="italic">t</span> := max(0, <span className="italic">t</span><sub>b</sub> − <span className="italic">t</span><sub>e</sub>)</div>
              <div><span className="italic">t</span><sub>e</sub> := <span className="italic">t</span><sub>e</sub> + Δ<span className="italic">t</span></div>
              <div><span className="italic">x</span> := max(<span className="italic">x</span> − <span className="italic text-green-500">T</span>·Δ<span className="italic">t</span>, 0)</div>
            </div>
          </motion.div>

          <motion.div 
            className={`border ${colors.border} p-4`}
            style={{ backgroundColor: `${colors.stroke}03` }}
            whileHover={{ borderColor: '#22c55e50' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <motion.div 
                className="w-3 h-3 flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <div className="w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
              </motion.div>
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>After Execution</span>
            </div>
            <div className={`font-mono text-[11px] ${colors.textMuted} space-y-1 p-3 border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
              <div>Δ<span className="italic">t</span> := <span className="italic">g</span><sub>C</sub> / <span className="italic text-red-500">R</span></div>
              <div><span className="italic">t</span><sub>e</sub> := <span className="italic">t</span><sub>e</sub> + Δ<span className="italic">t</span></div>
              <div><span className="italic">x</span> := <span className="italic">x</span> + Δ<span className="italic">t</span>·(<span className="italic text-red-500">R</span> − <span className="italic text-green-500">T</span>)</div>
            </div>
          </motion.div>
        </div>

        {/* Block Settlement */}
        <h4 className={`text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Settlement Condition</h4>
        <motion.div 
          className={`border ${colors.border} p-5 relative overflow-hidden`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `linear-gradient(135deg, #22c55e08 0%, transparent 50%)` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className={`font-mono text-lg ${colors.text} p-4 text-center border ${colors.border} mb-4 relative`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <span className="italic">t</span><sub>e</sub> ≤ <span className="italic">t</span><sub>b</sub> − <span className="italic text-amber-500">τ</span>
          </div>
          <p className={`text-[11px] ${colors.textMuted} leading-relaxed text-center relative`}>
            Ancestors whose execution timestamp satisfies this condition are settled. The proposed block includes the stateRoot from the most recently settled block.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function LeanExecutionSection({ colors }: { colors: Colors }) {
  return (
    <div className="mt-4">
      {/* Performance Improvements */}
      <div className={`border ${colors.border} ${colors.blockBg} p-6 sm:p-8`}>
        <div className="mb-6">
          <h2 className={`text-lg md:text-xl font-medium ${colors.text} uppercase tracking-[0.1em] font-mono mb-2`}>
            Performance Improvements
          </h2>
          <p className={`text-[11px] ${colors.textMuted}`}>
            Concurrent execution eliminates bottlenecks and unlocks new paradigms
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`border ${colors.border} p-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Zero Context Switching</span>
            </div>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              Concurrent consensus and execution streams eliminate node context switching. VM time aligns with wall time—increasing gas per second without hardware changes.
            </p>
          </div>

          <div className={`border ${colors.border} p-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Lean Execution Clients</span>
            </div>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              Execution-only clients skip expensive Merkle structures and rapidly process the consensus queue. End users see expedited but identical results.
            </p>
          </div>

          <div className={`border ${colors.border} p-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#f59e0b' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Amortized Overhead</span>
            </div>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              Irregular stop-the-world events like database compaction are spread across multiple blocks, smoothing out latency spikes.
            </p>
          </div>

          <div className={`border ${colors.border} p-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2" style={{ backgroundColor: '#ef4444' }} />
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Bursty Throughput</span>
            </div>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              Eagerly accept transactions during traffic spikes without compromising security. Third-party accounting can occur before execution.
            </p>
          </div>
        </div>
      </div>

      {/* User Stories */}
      <div className={`border ${colors.border} ${colors.blockBg} p-6 sm:p-8 mt-4`}>
        <div className="mb-6">
          <h2 className={`text-lg md:text-xl font-medium ${colors.text} uppercase tracking-[0.1em] font-mono mb-2`}>
            User Stories
          </h2>
          <p className={`text-[11px] ${colors.textMuted}`}>
            Real-world applications enabled by asynchronous execution
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`border ${colors.border} p-4`} style={{ borderLeftWidth: '3px', borderLeftColor: '#8b5cf6' }}>
            <span className={`text-[10px] uppercase tracking-wider ${colors.textMuted} block mb-2 font-medium`}>DeFi Trader</span>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              A sophisticated DeFi trader runs a highly optimised execution client, locally clearing the transaction queue well in advance of the network—setting the stage for HFT DeFi.
            </p>
          </div>
          <div className={`border ${colors.border} p-4`} style={{ borderLeftWidth: '3px', borderLeftColor: '#ec4899' }}>
            <span className={`text-[10px] uppercase tracking-wider ${colors.textMuted} block mb-2 font-medium`}>Custodial Platform</span>
            <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
              A custodial platform filters the queue for only those transactions sent to one of their EOAs, immediately crediting user balances.
            </p>
          </div>
        </div>
      </div>

      {/* Future Capabilities */}
      <div className={`border ${colors.border} ${colors.blockBg} p-6 sm:p-8 mt-4`}>
        <div className="mb-6">
          <h2 className={`text-lg md:text-xl font-medium ${colors.text} uppercase tracking-[0.1em] font-mono mb-2`}>
            Future Capabilities
          </h2>
          <p className={`text-[11px] ${colors.textMuted}`}>
            Asynchronous execution unlocks powerful new features
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`border ${colors.border} p-4 flex items-start gap-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div 
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#a855f715', border: '1px solid #a855f730' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider block mb-2`}>Real-time VRF</span>
              <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
                Expose a verifiable random function during execution for provably fair on-chain randomness.
              </p>
            </div>
          </div>

          <div className={`border ${colors.border} p-4 flex items-start gap-4`} style={{ backgroundColor: `${colors.stroke}03` }}>
            <div 
              className="w-10 h-10 flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#06b6d415', border: '1px solid #06b6d430' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <span className={`text-[10px] font-medium ${colors.text} uppercase tracking-wider block mb-2`}>Encrypted Mempool</span>
              <p className={`text-[11px] ${colors.textMuted} leading-relaxed`}>
                Use an encrypted mempool to reduce front-running and MEV extraction.
              </p>
            </div>
          </div>
        </div>

        <p className={`text-[10px] ${colors.textFaint} mt-6 font-mono uppercase tracking-wider`}>
          Note: This ACP does not introduce these features, but asynchronous execution is required to implement them.
        </p>
      </div>
    </div>
  )
}

function FlowArrow({ colors }: { colors: Colors }) {
  return (
    <div className="flex items-center justify-center sm:-mt-4">
      <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
        <line x1="0" y1="8" x2="34" y2="8" stroke={colors.stroke} strokeOpacity="0.35" strokeWidth="2" />
        <path
          d="M26 3l8 5-8 5"
          stroke={colors.stroke}
          strokeOpacity="0.4"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

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

// Synchronous Execution Configuration - much slower, must wait for full settlement
const SYNC_CONFIG = {
  proposeTime: 1000, // Time in proposed state
  acceptTime: 1000, // Time in accepted state
  executeTime: 3500, // Time in executing state (this is the bottleneck!)
  settleDelay: 600, // Brief pause after settling before next block
  mempoolMinDelay: 150,
  mempoolMaxDelay: 350,
}

function SyncBlockDisplay({ 
  block, 
  colors, 
  label,
  showCheckmark = false,
  isDotted = false,
  showSpinner = false,
}: { 
  block: Block | null
  colors: Colors
  label: string
  showCheckmark?: boolean
  isDotted?: boolean
  showSpinner?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex items-center justify-center overflow-hidden`}
                    style={{
          width: 64, 
          height: 64,
          border: isDotted ? `2px dashed ${colors.stroke}30` : `1px solid ${colors.stroke}20`,
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

function SynchronousExecution({ colors }: { colors: Colors }) {
  const [mempoolTxs, setMempoolTxs] = useState<Transaction[]>([])
  const [currentStage, setCurrentStage] = useState<'idle' | 'proposed' | 'accepted' | 'executing'>('idle')
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
          
          // Stage 1: Proposed
          setCurrentBlock(newBlock)
          setCurrentStage('proposed')
          
          // Stage 2: Accepted
          timeouts.push(setTimeout(() => {
            setCurrentStage('accepted')
          }, SYNC_CONFIG.proposeTime))
          
          // Stage 3: Executing
          timeouts.push(setTimeout(() => {
            setCurrentStage('executing')
          }, SYNC_CONFIG.proposeTime + SYNC_CONFIG.acceptTime))
          
          // Stage 4: Settled - then reset for next block
          timeouts.push(setTimeout(() => {
            setSettledBlocks((prev) => [...prev.slice(-7), newBlock])
            setCurrentBlock(null)
            setCurrentStage('idle')
            isProcessingRef.current = false
            
            // Schedule next block check
            timeouts.push(setTimeout(tryStartNextBlock, SYNC_CONFIG.settleDelay))
          }, SYNC_CONFIG.proposeTime + SYNC_CONFIG.acceptTime + SYNC_CONFIG.executeTime))
          
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
    proposed: {
      title: "Block Proposed",
      content: "The validator creates a block and broadcasts it to the network. Other validators receive the proposal and begin verification."
    },
    accepted: {
      title: "Consensus Reached",
      content: "Validators vote on the proposed block. Once enough validators agree, the block is accepted by consensus and ready for execution."
    },
    executing: {
      title: "Executing Transactions",
      content: "Each transaction is executed sequentially, computing state changes. The entire network must wait for execution to complete before proposing the next block."
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
      <div className={`border ${colors.border} p-4 sm:p-6 ${colors.blockBg}`}>
        {/* Single row flow */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
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

          <div className="rotate-90 sm:rotate-0"><FlowArrow colors={colors} /></div>
          
          {/* Proposed */}
          <div 
            className="relative cursor-help"
            onMouseEnter={() => setActiveTooltip('proposed')}
            onMouseLeave={() => setActiveTooltip(null)}
          >
            <SyncBlockDisplay 
              block={currentStage === 'proposed' ? currentBlock : null} 
              colors={colors} 
              label="Proposed" 
              isDotted
            />
            {renderTooltip('proposed')}
          </div>
          
          <div className="rotate-90 sm:rotate-0"><FlowArrow colors={colors} /></div>
          
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
          
          <div className="rotate-90 sm:rotate-0"><FlowArrow colors={colors} /></div>
          
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
          
          <div className="rotate-90 sm:rotate-0"><FlowArrow colors={colors} /></div>
          
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
      <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider`}>
        Consensus must wait for block to settle before proposing next • Execution blocks consensus
      </p>
    </div>
  )
}

export function TransactionLifecycle() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Wait for theme to be resolved on client
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Default to dark until mounted and theme is resolved
  const isDark = !mounted || resolvedTheme === "dark" || resolvedTheme === undefined
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

  const colors: Colors = {
    bg: isDark ? "bg-[#0a0a0a]" : "bg-[#fafafa]",
    text: isDark ? "text-white" : "text-black",
    textMuted: isDark ? "text-white/50" : "text-black/50",
    textFaint: isDark ? "text-white/20" : "text-black/20",
    border: isDark ? "border-white/10" : "border-black/10",
    borderStrong: isDark ? "border-white/30" : "border-black/30",
    blockBg: isDark ? "bg-white/5" : "bg-black/5",
    blockBgStrong: isDark ? "bg-white/10" : "bg-black/10",
    blockSolid: isDark ? "bg-white" : "bg-black",
    blockFaint: isDark ? "bg-white/20" : "bg-black/20",
    stroke: isDark ? "#ffffff" : "#000000",
  }

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
    <div
      className={`relative w-full min-h-screen ${colors.bg} flex flex-col items-center justify-center p-4 md:p-12 overflow-hidden`}
    >
      {/* Header */}
      <div className="text-center mb-8 md:mb-16 max-w-5xl w-full mx-auto px-2">
        <div className="mb-4">
          <AvalancheLogo className="w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
        </div>
        <h1
          className={`text-base sm:text-xl md:text-3xl font-medium ${colors.text} uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-4 md:mb-6 font-mono`}
        >
          Streaming Asynchronous Execution
        </h1>
        <p className={`text-[10px] sm:text-xs md:text-sm ${colors.textMuted} font-mono uppercase tracking-[0.1em] mb-6`}>
          <Link 
            href="/docs/acps/194-streaming-asynchronous-execution" 
            className="underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            ACP-194
          </Link>
          {" "}: Decoupling Consensus and Execution
        </p>
        
      </div>

      <div className="w-full max-w-5xl">
        {/* Problem statement hook */}
        <div className="mt-4 mb-10">
          <p className={`text-sm md:text-base ${colors.textMuted} leading-relaxed`}>
            Traditional blockchains have a bottleneck: consensus waits for execution, execution waits for consensus.
          </p>
          <p className={`text-sm md:text-base ${colors.text} mt-3 font-medium`}>
            What if they could run in parallel?
          </p>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: THE PROBLEM - Synchronous Execution */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>01</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Bottleneck</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          <SynchronousExecution colors={colors} />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: THE SOLUTION - SAE Visualization */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>02</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Solution</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>

          {/* Consensus Lane */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
                Consensus Stream (Snowman)
              </span>
            </div>

            <div className={`border ${colors.border} p-3 sm:p-6 ${colors.blockBg}`}>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-0">
                <div className="flex-1 flex justify-center">
                  <MempoolStage txs={mempoolTxs} colors={colors} />
                </div>
                <div className="rotate-90 sm:rotate-0">
                  <FlowArrow colors={colors} />
                </div>
                <div className="flex-1 flex justify-center">
                  <ProposedStage block={proposedBlock} colors={colors} />
                </div>
                <div className="rotate-90 sm:rotate-0">
                  <FlowArrow colors={colors} />
                </div>
                <div className="flex-1 flex justify-center">
                  <AcceptedStage block={acceptedBlock} colors={colors} />
                </div>
              </div>
            </div>
            <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider`}>
              Rapidly sequence blocks without waiting for execution results
            </p>
          </div>

          {/* Connection */}
          <div className="flex justify-center sm:justify-end sm:pr-24 py-1">
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
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`text-[11px] ${colors.text} uppercase tracking-widest font-semibold`}>FIFO Queue</span>
            </div>

            <div className={`border ${colors.border} p-4 ${colors.blockBg}`}>
              <QueueStage blocks={queuedBlocks} colors={colors} />
            </div>
            <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider`}>
              Accepted blocks buffer in a FIFO queue, decoupling the two streams
            </p>
          </div>

          {/* Connection */}
          <div className="flex justify-center sm:justify-start sm:pl-24 py-1">
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
          <div className="mt-1">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
                Execution Stream
              </span>
            </div>
            <div className={`border ${colors.border} ${colors.blockBg} p-3 sm:p-4`}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                <div className="flex justify-center" style={{ minWidth: 140 }}>
                  <ExecutedStage blocks={executingBlocks} colors={colors} />
                </div>
                <div className="rotate-90 sm:rotate-0">
                  <FlowArrow colors={colors} />
                </div>
                <div className="flex justify-center sm:justify-start">
                  <SettledStage blocks={settledBlocks} colors={colors} />
                </div>
              </div>
            </div>
            <p className={`text-[11px] ${colors.textMuted} mt-4 font-mono uppercase tracking-wider`}>
              Execute blocks in parallel, settle results continuously
            </p>
          </div>
        </div>

        {/* Assembly Line - simplified view, part of the solution */}
        <div className="hidden md:block mt-8 mb-16">
          <AssemblyLineCard colors={colors} />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: TECHNICAL DEEP DIVE - Block Relationship */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:block mb-16">
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>03</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>Under the Hood</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          <DecouplingDiagram colors={colors} />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: BENEFITS - Results & Future */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="hidden md:block">
          <div className="flex items-center gap-4 mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>04</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Payoff</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          <LeanExecutionSection colors={colors} />
        </div>

      </div>
    </div>
  )
}

