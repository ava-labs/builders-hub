"use client"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, Block, MAX_TX } from "./types"

export function FlowArrow({ colors }: { colors: Colors }) {
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

export function BlockchainBlock({
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

export function QueueBlock({ colors, id, txCount = 16, txColors = [] }: { colors: Colors; id: number; txCount?: number; txColors?: string[] }) {
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

