"use client"
import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"
import {
  PRICE_PER_TB_USD,
  computeArchivalCosts,
  formatUsd,
} from "./archival-cost"

// Archival C-Chain node state footprint. Storage numbers confirmed by the
// Firewood engineering team; per-node cost figures derived from
// PRICE_PER_TB_USD in ./archival-cost (mid-tier NVMe Gen 4, April 2026).
const LEVELDB_TB = 16
const FIREWOOD_TB = 3
const RATIO = Math.round((LEVELDB_TB / FIREWOOD_TB) * 10) / 10

export function ArchivalFootprintCard({ colors }: { colors: Colors }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef, { amount: 0.25, once: false })
  const costs = computeArchivalCosts(LEVELDB_TB, FIREWOOD_TB)
  const firewoodWidth = `${(FIREWOOD_TB / LEVELDB_TB) * 100}%`
  const trackBg = `${colors.stroke}08`

  return (
    <div
      ref={containerRef}
      className={`p-6 h-full flex flex-col ${colors.blockBg} border ${colors.border}`}
    >
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3
            className={`text-sm sm:text-base font-mono font-bold ${colors.text} mb-1`}
          >
            Archival footprint.
          </h3>
          <p className={`text-xs ${colors.textMuted} font-mono`}>
            On-disk state for an archival C-Chain node. Same history, a fraction of the disk.
          </p>
        </div>
        <InfoTooltip
          colors={colors}
          text={`Archival nodes retain historical chain state, but Firewood does not need to materialize every intermediate trie on disk. With a commit interval of 4096, commits are first incorporated into in-memory revisions, and Firewood’s deferred persistence worker periodically flushes the latest committed trie as a checkpoint. Because that persisted trie includes the effects of the preceding commits, intermediate tries within the interval are not separately written to disk. This checkpointing, combined with Firewood’s direct Merkle-trie storage, is why the archival footprint is dramatically smaller — roughly 3 TB on Firewood versus ~16 TB on LevelDB for C-Chain. Cost figures assume mid-tier NVMe Gen 4 SSDs at ~$${PRICE_PER_TB_USD}/TB (April 2026 retail for drives like Samsung 990 Pro or WD Black SN850X at 2–4 TB capacity). Storage numbers sourced from the Firewood engineering team.`}
        />
      </div>

      {/* Comparison bars */}
      <div className="flex-1 flex flex-col justify-center gap-5 py-2">
        {/* LevelDB row */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.15em] ${colors.textMuted}`}
            >
              LevelDB
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="text-base sm:text-lg font-mono font-bold"
                style={{ color: FIREWOOD_COLORS.leveldb }}
              >
                ~16 TB
              </span>
              <span
                className={`text-[10px] font-mono ${colors.textMuted}`}
              >
                ~{formatUsd(costs.leveldb)} / node
              </span>
            </div>
          </div>
          <div
            className="h-7 relative overflow-hidden"
            style={{ backgroundColor: trackBg }}
          >
            <motion.div
              className="h-full"
              style={{ backgroundColor: `${FIREWOOD_COLORS.leveldb}70` }}
              initial={{ width: 0 }}
              animate={{ width: inView ? "100%" : 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Firewood row */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span
              className="text-[10px] font-mono uppercase tracking-[0.15em]"
              style={{ color: FIREWOOD_COLORS.firewood }}
            >
              Firewood
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="text-base sm:text-lg font-mono font-bold"
                style={{ color: FIREWOOD_COLORS.firewood }}
              >
                ~3 TB
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: `${FIREWOOD_COLORS.firewood}B0` }}
              >
                ~{formatUsd(costs.firewood)} / node
              </span>
            </div>
          </div>
          <div
            className="h-7 relative overflow-hidden"
            style={{ backgroundColor: trackBg }}
          >
            <motion.div
              className="h-full"
              style={{ backgroundColor: FIREWOOD_COLORS.firewood, opacity: 0.85 }}
              initial={{ width: 0 }}
              animate={{ width: inView ? firewoodWidth : 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.35 }}
            />
          </div>
        </div>
      </div>

      {/* Delta badge + source */}
      <div
        className="flex items-center justify-between gap-3 pt-4 mt-auto"
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <motion.div
          className="flex flex-col gap-1"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 4 }}
          transition={{ delay: 1.3, duration: 0.3 }}
        >
          <span
            className="text-xs font-mono font-bold px-2.5 py-1 self-start"
            style={{
              backgroundColor: `${FIREWOOD_COLORS.disk}20`,
              color: FIREWOOD_COLORS.disk,
              border: `1px solid ${FIREWOOD_COLORS.disk}40`,
            }}
          >
            ~{RATIO}× smaller
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: FIREWOOD_COLORS.disk }}
          >
            ~{formatUsd(costs.savings)} saved / node ({costs.savingsPct}%)
          </span>
        </motion.div>
        <span className={`text-[9px] sm:text-[10px] font-mono ${colors.textFaint} text-right`}>
          {`Source: Firewood engineering team · Commit Interval = 4096 · Cost: mid-tier NVMe Gen 4 at ~$${PRICE_PER_TB_USD}/TB`}
        </span>
      </div>
    </div>
  )
}
