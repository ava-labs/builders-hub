"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"

export function TrieNodeBox({
  colors,
  type,
  offset,
  highlighted = false,
  activeNibble,
  label,
  size = "md",
}: {
  colors: Colors
  type: "branch" | "leaf"
  offset: string
  highlighted?: boolean
  activeNibble?: number
  label?: string
  size?: "sm" | "md"
}) {
  const dim = size === "sm" ? 32 : 44
  const nibbleSize = size === "sm" ? 6 : 8

  if (type === "leaf") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="flex items-center justify-center border transition-colors duration-300"
          style={{
            width: dim,
            height: dim * 0.7,
            backgroundColor: highlighted
              ? `${FIREWOOD_COLORS.trie}30`
              : `${colors.stroke}08`,
            borderColor: highlighted
              ? FIREWOOD_COLORS.trie
              : `${colors.stroke}30`,
          }}
        >
          {label && (
            <span
              className="text-[7px] font-mono font-bold"
              style={{ color: highlighted ? FIREWOOD_COLORS.trie : `${colors.stroke}60` }}
            >
              {label}
            </span>
          )}
        </div>
        <span className={`text-[6px] font-mono ${colors.textFaint}`}>
          @{offset}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="border grid grid-cols-4 gap-px p-0.5 transition-colors duration-300"
        style={{
          width: dim,
          height: dim,
          backgroundColor: highlighted
            ? `${FIREWOOD_COLORS.trie}15`
            : `${colors.stroke}05`,
          borderColor: highlighted
            ? FIREWOOD_COLORS.trie
            : `${colors.stroke}30`,
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: nibbleSize,
              height: nibbleSize,
              backgroundColor:
                activeNibble === i
                  ? FIREWOOD_COLORS.trie
                  : `${colors.stroke}15`,
              transition: "background-color 0.3s",
            }}
          />
        ))}
      </div>
      <span className={`text-[6px] font-mono ${colors.textFaint}`}>
        @{offset}
      </span>
    </div>
  )
}

export function LayerLabel({
  colors,
  label,
  sublabel,
  color,
  active = false,
  dotColor,
}: {
  colors: Colors
  label: string
  sublabel?: string
  color?: string
  active?: boolean
  dotColor?: string
}) {
  return (
    <div
      className="relative px-3 py-2 border text-center min-w-[100px] transition-all duration-300"
      style={{
        borderColor: active
          ? (color || FIREWOOD_COLORS.trie)
          : `${colors.stroke}20`,
        backgroundColor: active
          ? `${color || FIREWOOD_COLORS.trie}15`
          : `${colors.stroke}05`,
      }}
    >
      <div
        className="text-[10px] font-mono font-bold uppercase tracking-wider"
        style={{ color: color || (active ? FIREWOOD_COLORS.trie : `${colors.stroke}80`) }}
      >
        {label}
      </div>
      {sublabel && (
        <div className={`text-[8px] font-mono mt-0.5 ${colors.textMuted}`}>
          {sublabel}
        </div>
      )}
      {/* Animated dot indicator when this layer is active */}
      {active && dotColor && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 rounded-full z-10"
          style={{
            width: 10,
            height: 10,
            backgroundColor: dotColor,
            boxShadow: `0 0 8px ${dotColor}80`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      )}
    </div>
  )
}

export function VerticalFlowArrow({
  colors,
  height = 20,
  active = false,
  color,
}: {
  colors: Colors
  height?: number
  active?: boolean
  color?: string
}) {
  const strokeColor = color || colors.stroke
  return (
    <div className="flex justify-center">
      <svg width="16" height={height} viewBox={`0 0 16 ${height}`} fill="none">
        <line
          x1="8"
          y1="0"
          x2="8"
          y2={height - 4}
          stroke={strokeColor}
          strokeOpacity={active ? 0.8 : 0.3}
          strokeWidth="1.5"
        />
        <path
          d={`M4 ${height - 6}l4 5 4-5`}
          stroke={strokeColor}
          strokeOpacity={active ? 0.8 : 0.3}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function HorizontalFlowArrow({
  colors,
  width = 40,
  active = false,
  color,
}: {
  colors: Colors
  width?: number
  active?: boolean
  color?: string
}) {
  const strokeColor = color || colors.stroke
  return (
    <div className="flex items-center">
      <svg width={width} height="16" viewBox={`0 0 ${width} 16`} fill="none">
        <line
          x1="0"
          y1="8"
          x2={width - 6}
          y2="8"
          stroke={strokeColor}
          strokeOpacity={active ? 0.8 : 0.3}
          strokeWidth="1.5"
        />
        <path
          d={`M${width - 8} 4l5 4-5 4`}
          stroke={strokeColor}
          strokeOpacity={active ? 0.8 : 0.3}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function AnimatedDot({
  color,
  size = 8,
  delay = 0,
}: {
  color: string
  size?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay }}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
      }}
    />
  )
}

export function InfoTooltip({
  colors,
  text,
}: {
  colors: Colors
  text: string
}) {
  const [open, setOpen] = useState(false)
  const isDark = colors.stroke === "#ffffff"

  return (
    <div
      className="relative flex-shrink-0"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        aria-label="More information"
        aria-expanded={open}
        className="w-5 h-5 rounded-full flex items-center justify-center transition-all opacity-40 hover:opacity-100"
        style={{
          border: `1px solid ${open ? `${colors.stroke}40` : `${colors.stroke}20`}`,
          backgroundColor: open ? `${colors.stroke}10` : "transparent",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="4" r="1" fill={colors.stroke} />
          <rect x="7" y="6.5" width="2" height="6" rx="1" fill={colors.stroke} />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: 0.1 }}
            role="tooltip"
            className="absolute right-0 top-full mt-1.5 z-30 w-64 p-3"
            style={{
              backgroundColor: isDark ? "#1c1c1c" : "#f8f8f8",
              border: `1px solid ${isDark ? "#333" : "#ddd"}`,
              boxShadow: isDark
                ? "0 4px 16px rgba(0,0,0,0.4)"
                : "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <p className="text-[11px] leading-[1.6]" style={{ color: isDark ? "#999" : "#555" }}>
              {text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SectionDivider({ colors }: { colors: Colors }) {
  return (
    <div
      className="w-full h-px my-8 md:my-12"
      style={{ backgroundColor: `${colors.stroke}10` }}
    />
  )
}
