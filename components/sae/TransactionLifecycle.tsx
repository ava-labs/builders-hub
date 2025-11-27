"use client"
import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import Link from "next/link"
import { AvalancheLogo } from "@/components/navigation/avalanche-logo"

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

interface Block {
  id: number
  uid: string // Unique identifier for React keys
  txCount: number
  createdAt: number
  spanCount?: number // Number of consensus blocks this execution block spans
}

interface Transaction {
  id: number
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
  showHash = true,
}: {
  colors: Colors
  id?: number
  txCount?: number
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
              backgroundColor: i < txCount ? `${colors.stroke}40` : `${colors.stroke}10`,
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

function QueueBlock({ colors, id, txCount = 16 }: { colors: Colors; id: number; txCount?: number }) {
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
                backgroundColor: i < txCount ? `${colors.stroke}35` : `${colors.stroke}10`,
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
  return (
    <div className="flex flex-col items-center gap-3 flex-1 justify-center">
      <div
        className={`relative border ${colors.border} flex items-center justify-center overflow-hidden`}
        style={{ borderStyle: "dashed", width: 80, height: 80 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3"
            style={{
              top: i < 2 ? 4 : "auto",
              bottom: i >= 2 ? 4 : "auto",
              left: i % 2 === 0 ? 4 : "auto",
              right: i % 2 === 1 ? 4 : "auto",
              borderColor: `${colors.stroke}30`,
              borderTopWidth: i < 2 ? 1 : 0,
              borderBottomWidth: i >= 2 ? 1 : 0,
              borderLeftWidth: i % 2 === 0 ? 1 : 0,
              borderRightWidth: i % 2 === 1 ? 1 : 0,
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: i * 0.3 }}
          />
        ))}
        <AnimatePresence mode="wait">
          {block ? (
            <motion.div
              key={block.uid}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <BlockchainBlock colors={colors} txCount={block.txCount} id={block.id} showHash />
            </motion.div>
          ) : (
            <span className={`text-[10px] ${colors.textFaint} uppercase tracking-widest`}>Forming</span>
          )}
        </AnimatePresence>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Proposed</span>
    </div>
  )
}

function AcceptedStage({ block, colors }: { block: Block | null; colors: Colors }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative border ${colors.border} flex items-center justify-center overflow-hidden`}
        style={{ width: 80, height: 80 }}
      >
        {/* Subtle pulsing border glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ 
            border: `1px solid ${colors.stroke}`,
          }}
          animate={{ 
            opacity: [0.1, 0.25, 0.1],
          }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
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
              <BlockchainBlock colors={colors} txCount={block.txCount} id={block.id} showHash />
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
    </div>
  )
}

function QueueStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex items-center justify-center w-full gap-2 sm:gap-4">
      <span className={`text-[8px] sm:text-[10px] ${colors.textFaint} uppercase tracking-widest`}>Out</span>

      <div
        className={`relative h-12 sm:h-14 flex-1 max-w-md border ${colors.border} flex items-center justify-start gap-2 sm:gap-3 px-2 sm:px-4 overflow-hidden`}
      >
        <motion.div
          className="absolute bottom-0 left-0 h-px"
          style={{ backgroundColor: `${colors.stroke}40`, width: "30%" }}
          animate={{ x: ["0%", "250%"] }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
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
              <QueueBlock colors={colors} id={block.id} txCount={block.txCount} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <span className={`text-[8px] sm:text-[10px] ${colors.textFaint} uppercase tracking-widest`}>In</span>
    </div>
  )
}

function ExecutedStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative border ${colors.border} ${colors.blockBg} flex items-center justify-center gap-3 p-4 overflow-hidden`}
        style={{
          minWidth: 110,
          minHeight: 85,
        }}
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
              className="flex items-center gap-3"
            >
              {blocks.map((block) => (
                <div key={block.uid} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`border ${colors.borderStrong} grid gap-1 p-1.5`}
                    style={{
                      gridTemplateColumns: "repeat(4, 1fr)",
                      width: 48,
                      height: 48,
                      backgroundColor: `${colors.stroke}05`,
                    }}
                  >
                    {Array.from({ length: MAX_TX }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          aspectRatio: "1",
                          backgroundColor: i < block.txCount ? `${colors.stroke}40` : `${colors.stroke}10`,
                        }}
                      />
                    ))}
                  </div>
                  <span className={`text-[7px] font-mono ${colors.textFaint}`}>
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
      <span className={`text-[10px] ${colors.textFaint} uppercase tracking-widest font-medium`}>Executing</span>
    </div>
  )
}

function SettledStage({ blocks, colors }: { blocks: Block[]; colors: Colors }) {
  const visibleBlocks = blocks.slice(-16)

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`border ${colors.border} ${colors.blockBg} p-1.5 overflow-hidden relative`}
        style={{ width: 130, height: 110 }}
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
                      backgroundColor: i < block.txCount ? `${colors.stroke}40` : `${colors.stroke}10`,
                    }}
                  />
                ))}
                <motion.svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.3, duration: 0.2 }}
                >
                  <motion.path
                    d="M6 12l4 4 8-8"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
                  />
                </motion.svg>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <span className={`text-xs uppercase tracking-[0.2em] ${colors.textMuted}`}>Settled</span>
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
    <div className="w-full max-w-5xl mt-16">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-6 px-1">
        <div className={`w-2 h-2 ${colors.blockFaint}`} />
        <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.textFaint} font-medium`}>
          Block Relationship
        </span>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      <div className={`border ${colors.border} p-8 ${colors.blockBg} overflow-x-auto`}>
        {/* Legend */}
        <div className="flex items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4"
              style={{ backgroundColor: `${colors.stroke}25`, border: `1px solid ${colors.stroke}40` }}
            />
            <span className={`text-[10px] uppercase tracking-widest ${colors.textMuted}`}>Snowman Consensus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: "#ef4444", border: `1px solid #ef4444` }} />
            <span className={`text-[10px] uppercase tracking-widest ${colors.textMuted}`}>Execution Stream</span>
          </div>
        </div>

        <div className="relative mx-auto" style={{ width: totalWidth, height: totalHeight }}>
          {/* SVG for arrows */}
          <svg className="absolute inset-0" style={{ width: totalWidth, height: totalHeight }}>
            {arrows.map((arrow, i) => {
              const fromBlock = consensusBlocks[arrow.fromConsensus]
              const fromX = fromBlock.x + fromBlock.width / 2
              const fromY = fromBlock.y + fromBlock.height
              const toX = arrow.targetX
              const toY = executionY

              return (
                <g key={i}>
                  <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY - 6}
                    stroke={arrow.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${toX},${toY} ${toX - 4},${toY - 8} ${toX + 4},${toY - 8}`}
                    fill={arrow.color}
                    fillOpacity={0.7}
                  />
                </g>
              )
            })}

            {/* Curly brace under wide execution block */}
            <path
              d={`M ${braceStart} ${braceY} 
                  Q ${braceStart} ${braceY + 12}, ${braceCenter - 8} ${braceY + 12}
                  L ${braceCenter - 4} ${braceY + 12}
                  Q ${braceCenter} ${braceY + 12}, ${braceCenter} ${braceY + 20}
                  Q ${braceCenter} ${braceY + 12}, ${braceCenter + 4} ${braceY + 12}
                  L ${braceCenter + 8} ${braceY + 12}
                  Q ${braceEnd} ${braceY + 12}, ${braceEnd} ${braceY}`}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
            />
          </svg>

          {/* Consensus row (top) - grey blocks */}
          {consensusBlocks.map((block) => (
            <div
              key={block.id}
              className="absolute"
              style={{
                left: block.x,
                top: block.y,
                width: block.width,
                height: block.height,
                backgroundColor: `${colors.stroke}20`,
                border: `1px solid ${colors.stroke}40`,
              }}
            />
          ))}

          {/* Execution row (bottom) - red blocks */}
          {executionBlocks.map((block) => (
            <div
              key={`exec-${block.id}`}
              className="absolute"
              style={{
                left: block.x,
                top: executionY,
                width: block.width,
                height: block.height,
                backgroundColor: "#ef4444",
                border: `1px solid #ef4444`,
              }}
            />
          ))}
        </div>

        {/* Description */}
        <p className={`text-center text-xs ${colors.textMuted} mt-12 font-mono uppercase tracking-wider`}>
          Execution blocks can span multiple consensus blocks
        </p>
      </div>
    </div>
  )
}

function LeanExecutionSection({ colors }: { colors: Colors }) {
  return (
    <div className="w-full max-w-5xl mt-16">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-6 px-1">
        <div className={`w-2 h-2 ${colors.blockFaint}`} />
        <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.textFaint} font-mono`}>
          Lean Execution Clients
        </span>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      <div className={`border ${colors.border} ${colors.blockBg}`}>
        <div
          className="grid md:grid-cols-2 divide-x divide-y md:divide-y-0"
          style={{ borderColor: colors.stroke + "15" }}
        >
          {/* Left column - Big headline */}
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <h2
              className={`text-2xl md:text-3xl font-bold ${colors.text} tracking-tight mb-4 font-mono uppercase tracking-tight`}
            >
              Results without
              <br />
              the baggage.
            </h2>
            <p className={`text-sm md:text-base ${colors.textMuted} leading-relaxed`}>Lean execution clients</p>
          </div>

          {/* Right column - Merkle section */}
          <div className="p-8 md:p-12">
            <h3 className={`text-base md:text-lg font-bold ${colors.text} mb-6 font-mono uppercase tracking-wide`}>
              Leafing Merkle behind
            </h3>
            <ul className={`space-y-3 ${colors.text} font-mono text-xs md:text-sm`}>
              <li className="flex items-start gap-3">
                <span className={`w-1.5 h-1.5 mt-1.5 flex-shrink-0`} style={{ backgroundColor: colors.stroke }} />
                <span>Merkle trees are great for consensus and verification</span>
              </li>
              <li className="flex items-start gap-3">
                <span className={`w-1.5 h-1.5 mt-1.5 flex-shrink-0`} style={{ backgroundColor: colors.stroke }} />
                <span>But if you don't need the root, don't grow the tree!</span>
              </li>
              <li className="flex items-start gap-3">
                <span className={`w-1.5 h-1.5 mt-1.5 flex-shrink-0`} style={{ backgroundColor: colors.stroke }} />
                <span>
                  Trust the node? See the future:
                  <ul className="mt-2 ml-4 space-y-2">
                    <li className="flex items-center gap-3">
                      <span
                        className={`w-1 h-1 flex-shrink-0`}
                        style={{ backgroundColor: colors.stroke, opacity: 0.5 }}
                      />
                      <span>Explorers</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span
                        className={`w-1 h-1 flex-shrink-0`}
                        style={{ backgroundColor: colors.stroke, opacity: 0.5 }}
                      />
                      <span>Custodians</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <span
                        className={`w-1 h-1 flex-shrink-0`}
                        style={{ backgroundColor: colors.stroke, opacity: 0.5 }}
                      />
                      <span>High Frequency Traders</span>
                    </li>
                  </ul>
                </span>
              </li>
            </ul>
          </div>
        </div>
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
  
  // Create a stable mapping of transaction IDs to random slot positions
  const filledSlots = new Set<number>()
  txs.slice(0, maxSlots).forEach((tx) => {
    // Use transaction ID to deterministically pick a slot
    const slot = tx.id % maxSlots
    // If slot taken, find next available
    let actualSlot = slot
    while (filledSlots.has(actualSlot) && filledSlots.size < maxSlots) {
      actualSlot = (actualSlot + 1) % maxSlots
    }
    filledSlots.add(actualSlot)
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative w-36 h-24 border ${colors.border} overflow-hidden`}>
        <div
          className="absolute inset-2 grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(6, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}
        >
          {Array.from({ length: maxSlots }).map((_, i) => (
            <div
              key={i}
              className="transition-opacity duration-100"
              style={{
                width: 10,
                height: 10,
                backgroundColor: `${colors.stroke}35`,
                opacity: filledSlots.has(i) ? 1 : 0.1,
              }}
            />
          ))}
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
    </div>
  )
}

export function TransactionLifecycle() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
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
        const newTxs: Transaction[] = []
        for (let i = 0; i < batchSize; i++) {
          txIdRef.current += 1
          newTxs.push({ id: txIdRef.current })
        }
        // Cap mempool at 16 to keep visual breathing room (18 slots total)
        setMempoolTxs((prev) => {
          const maxMempool = 16
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
        // Increment block ID once outside state setter to avoid React Strict Mode double-increment
        const nextBlockId = blockIdRef.current + 1
        const now = Date.now()
        const uid = `${nextBlockId}-${now}-${Math.random().toString(36).slice(2, 9)}`
        let blockCreated = false
        
        setMempoolTxs((currentMempool) => {
          if (currentMempool.length >= 4 && !blockCreated) {
            blockCreated = true
            blockIdRef.current = nextBlockId
            // Take 4-16 transactions (capped at MAX_TX for visual consistency)
            const takeAll = Math.random() > 0.7 // 30% chance to take all available (up to 16)
            const availableToTake = Math.min(currentMempool.length, MAX_TX)
            const txCount = takeAll 
              ? availableToTake 
              : Math.min(Math.floor(Math.random() * 9) + 4, availableToTake)
            const newBlock: Block = {
              id: nextBlockId,
              uid,
              txCount,
              createdAt: now,
            }
            setProposedBlock(newBlock)
            // Remove random transactions, not just from the start
            const indices = Array.from({ length: currentMempool.length }, (_, i) => i)
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [indices[i], indices[j]] = [indices[j], indices[i]]
            }
            const keepIndices = new Set(indices.slice(txCount))
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
            // Take more blocks when queue is fuller to prevent overflow
            let takeCount: number
            if (prev.length >= 4) {
              takeCount = Math.min(prev.length, 3) // Take 3 when queue is full
            } else if (prev.length >= 3) {
              takeCount = 2
            } else {
              takeCount = 1
            }

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
      <div className="text-center mb-6 md:mb-12 max-w-5xl w-full mx-auto px-2">
        <div className="mb-4">
          <AvalancheLogo className="w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
        </div>
        <h1
          className={`text-base sm:text-xl md:text-3xl font-medium ${colors.text} uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-4 md:mb-6 font-mono`}
        >
          Streaming Asynchronous Execution
        </h1>
        <p className={`text-[10px] sm:text-xs md:text-sm ${colors.textMuted} font-mono uppercase tracking-[0.1em]`}>
          <Link 
            href="/docs/acps/194-streaming-asynchronous-execution" 
            className="underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            ACP-194
          </Link>
          {" "}: Decoupling Consensus and Execution
        </p>
      </div>

      {/* Main visualization */}
      <div className="w-full max-w-5xl">
        {/* Consensus Lane */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2 h-2 ${colors.blockFaint}`} />
            <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.textFaint} font-medium`}>
              Snowman Consensus
            </span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
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
            <div className="w-2 h-2" style={{ backgroundColor: "#3b82f6" }} />
            <span className={`text-[10px] ${colors.textFaint} uppercase tracking-widest`}>FIFO Queue</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>

          <div className={`border ${colors.border} p-4 ${colors.blockBg}`}>
            <QueueStage blocks={queuedBlocks} colors={colors} />
          </div>
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
            <div className="w-2 h-2" style={{ backgroundColor: "#ef4444" }} />
            <span className={`text-[11px] uppercase tracking-[0.15em] ${colors.textFaint} font-medium`}>
              Execution Stream
            </span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
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
        </div>
      </div>

      {/* Decoupling Diagram - hidden on mobile */}
      <div className="hidden md:block">
        <DecouplingDiagram colors={colors} />
      </div>

      {/* Lean Execution Section - hidden on mobile */}
      <div className="hidden md:block">
        <LeanExecutionSection colors={colors} />
      </div>
    </div>
  )
}
