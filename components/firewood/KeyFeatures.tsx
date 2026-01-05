"use client"
import { motion } from "framer-motion"
import { Colors, FIREWOOD_PALETTE } from "./types"

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
  color: string
  colors: Colors
  stats?: { label: string; value: string }[]
}

function FeatureCard({ title, description, icon, color, colors, stats }: FeatureCardProps) {
  return (
    <motion.div
      className={`border ${colors.border} ${colors.blockBg} p-5 h-full flex flex-col rounded-sm`}
      whileHover={{ borderColor: color + '60' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-sm"
          style={{ backgroundColor: color + '15', border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <div>
          <h3 className={`text-sm font-bold ${colors.text} uppercase tracking-wider mb-1`}>
            {title}
          </h3>
        </div>
      </div>

      <p className={`text-sm ${colors.textMuted} leading-relaxed flex-1`}>
        {description}
      </p>

      {stats && (
        <div className="mt-4 pt-3 flex gap-4" style={{ borderTop: `1px solid ${colors.stroke}15` }}>
          {stats.map((stat, i) => (
            <div key={i} className="flex-1">
              <div className="text-lg font-bold font-mono" style={{ color }}>
                {stat.value}
              </div>
              <div className={`text-[9px] ${colors.textFaint} uppercase tracking-wider`}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function KeyFeatures({ colors }: { colors: Colors }) {
  const features = [
    {
      title: "Compaction-Free",
      description: "No background compaction threads stealing CPU. Freed space is tracked in a free list and reused immediately. Predictable latency without GC pauses.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.moss} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.moss,
      stats: [
        { label: "CPU Overhead", value: "0%" },
        { label: "Write Amplification", value: "1x" }
      ]
    },
    {
      title: "Trie-Native Index",
      description: "The Merkle trie structure is the index on disk. No flattening into a generic KV store. Branch nodes point directly to child addresses.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.oak} strokeWidth="2">
          <circle cx="12" cy="5" r="3" />
          <circle cx="6" cy="17" r="3" />
          <circle cx="18" cy="17" r="3" />
          <line x1="12" y1="8" x2="6" y2="14" />
          <line x1="12" y1="8" x2="18" y2="14" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.oak
    },
    {
      title: "Address-Based Lookup",
      description: "Node location equals disk offset. No hash table lookups, no content-addressing overhead. O(1) access to any node.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.maple} strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.maple
    },
    {
      title: "Copy-on-Write Revisions",
      description: "Each state update creates a new revision with shared unchanged nodes. Support for historical state access with configurable retention.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.sage} strokeWidth="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.sage,
      stats: [
        { label: "Revisions", value: "128+" },
        { label: "Sharing", value: "CoW" }
      ]
    },
    {
      title: "Merkle Proofs Built-In",
      description: "Single-key proofs, range proofs, and change proofs are native operations. Perfect for state sync and light client verification.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.fern} strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.fern
    },
    {
      title: "EVM Optimized",
      description: "Built specifically for blockchain state. Support for Keccak256 (Ethereum) and SHA256 (Avalanche). Account-aware with RLP encoding.",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FIREWOOD_PALETTE.ember} strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      color: FIREWOOD_PALETTE.ember
    }
  ]

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, i) => (
          <FeatureCard key={i} {...feature} colors={colors} />
        ))}
      </div>
    </div>
  )
}

// Comparison table component
export function ComparisonTable({ colors }: { colors: Colors }) {
  const comparisons = [
    { aspect: "Indexing Strategy", leveldb: "LSM-tree on flat KV pairs", firewood: "Merkle trie IS the index" },
    { aspect: "Compaction", leveldb: "Continuous background merging", firewood: "None needed" },
    { aspect: "Node Addressing", leveldb: "Content-addressed (hash → value)", firewood: "Address-based (offset → value)" },
    { aspect: "Write Amplification", leveldb: "10-30x typical", firewood: "1x (direct write)" },
    { aspect: "Trie Structure", leveldb: "Emulated via KV pairs", firewood: "Native on-disk representation" },
    { aspect: "Space Reclamation", leveldb: "Compaction GC", firewood: "Free list (instant reuse)" },
    { aspect: "Historical State", leveldb: "Keep all (archival)", firewood: "Configurable retention" },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-xs uppercase tracking-widest ${colors.text} font-semibold`}>
          Side-by-Side Comparison
        </span>
      </div>

      <div
        className="p-2 sm:p-3 rounded-sm"
        style={{
          backgroundColor: colors.wood + '08',
          border: `1px solid ${colors.wood}20`,
        }}
      >
        <div className={`border ${colors.border} overflow-hidden rounded-sm`} style={{ backgroundColor: colors.stroke + '03' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.stroke + '08' }}>
                <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>Aspect</th>
                <th className={`text-left p-3 font-mono border-b ${colors.border}`} style={{ color: FIREWOOD_PALETTE.ember }}>LevelDB/RocksDB</th>
                <th className={`text-left p-3 font-mono border-b ${colors.border}`} style={{ color: FIREWOOD_PALETTE.moss }}>Firewood</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, i) => (
                <tr key={i} className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                  <td className={`p-3 font-medium ${colors.text} border-b ${colors.border}`}>{row.aspect}</td>
                  <td className={`p-3 ${colors.textMuted} border-b ${colors.border} text-[13px]`}>{row.leveldb}</td>
                  <td className={`p-3 border-b ${colors.border} text-[13px]`} style={{ color: FIREWOOD_PALETTE.moss }}>{row.firewood}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
