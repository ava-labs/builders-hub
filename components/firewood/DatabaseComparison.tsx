"use client"
import { motion } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"

interface ComparisonRow {
  metric: string
  leveldb: string
  pebble: string
  firewood: string
  advantage: boolean
}

const ROWS: ComparisonRow[] = [
  {
    metric: "Type",
    leveldb: "Generic KV (LSM)",
    pebble: "Generic KV (LSM)",
    firewood: "Purpose-built trie",
    advantage: true,
  },
  {
    metric: "Status",
    leveldb: "Default",
    pebble: "Stable alt",
    firewood: "Experimental",
    advantage: false,
  },
  {
    metric: "Trie Storage",
    leveldb: "Flattened to KV",
    pebble: "Flattened to KV",
    firewood: "Native on disk",
    advantage: true,
  },
  {
    metric: "Compaction",
    leveldb: "Required",
    pebble: "Required (better)",
    firewood: "None (FDL)",
    advantage: true,
  },
  {
    metric: "Write Amplification",
    leveldb: "High",
    pebble: "Medium",
    firewood: "Low",
    advantage: true,
  },
  {
    metric: "Parallel Merkle",
    leveldb: "No",
    pebble: "No",
    firewood: "Yes (16 threads)",
    advantage: true,
  },
  {
    metric: "Proof Generation",
    leveldb: "Rebuild from KV",
    pebble: "Rebuild from KV",
    firewood: "Native",
    advantage: true,
  },
]

const HEADERS = ["Metric", "LevelDB", "PebbleDB", "Firewood"]

function HeaderCell({
  label,
  index,
  colors,
}: {
  label: string
  index: number
  colors: Colors
}) {
  const isFirewood = index === 3

  return (
    <div
      className="relative px-3 py-2.5 overflow-hidden"
      style={{
        backgroundColor: isFirewood
          ? `${FIREWOOD_COLORS.firewood}15`
          : `${colors.stroke}08`,
        borderBottom: `1px solid ${colors.stroke}20`,
      }}
    >
      {isFirewood && (
        <motion.div
          className="absolute inset-0"
          style={{ backgroundColor: FIREWOOD_COLORS.firewood }}
          animate={{ opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span
        className="relative text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider"
        style={{
          color: isFirewood
            ? FIREWOOD_COLORS.firewood
            : `${colors.stroke}80`,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function DataCell({
  value,
  isFirewood,
  advantage,
  colors,
}: {
  value: string
  isFirewood: boolean
  advantage: boolean
  colors: Colors
}) {
  const bgColor =
    isFirewood && advantage
      ? `${FIREWOOD_COLORS.disk}10`
      : "transparent"

  return (
    <div
      className="px-3 py-2"
      style={{
        backgroundColor: bgColor,
        borderBottom: `1px solid ${colors.stroke}08`,
      }}
    >
      <span
        className="text-[10px] sm:text-xs font-mono"
        style={{
          color: isFirewood && advantage
            ? FIREWOOD_COLORS.disk
            : `${colors.stroke}70`,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function DatabaseComparison({ colors }: { colors: Colors }) {
  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg} border ${colors.border}`}>
      <h3
        className={`text-sm sm:text-base font-mono font-bold ${colors.text} mb-1`}
      >
        Choose your database.
      </h3>
      <p className={`text-xs ${colors.textMuted} font-mono mb-5`}>
        AvalancheGo currently supports LevelDB and PebbleDB. Firewood is an experimental backend under active development.
      </p>

      <div
        className="border overflow-hidden"
        style={{ borderColor: `${colors.stroke}15` }}
      >
        {/* Header row */}
        <div className="grid grid-cols-4">
          {HEADERS.map((header, i) => (
            <HeaderCell key={header} label={header} index={i} colors={colors} />
          ))}
        </div>

        {/* Data rows */}
        {ROWS.map((row, rowIndex) => (
          <motion.div
            key={row.metric}
            className="grid grid-cols-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rowIndex * 0.1, duration: 0.3 }}
          >
            <div
              className="px-3 py-2"
              style={{
                backgroundColor: `${colors.stroke}05`,
                borderBottom: `1px solid ${colors.stroke}08`,
              }}
            >
              <span
                className="text-[10px] sm:text-xs font-mono font-medium"
                style={{ color: `${colors.stroke}90` }}
              >
                {row.metric}
              </span>
            </div>
            <DataCell
              value={row.leveldb}
              isFirewood={false}
              advantage={false}
              colors={colors}
            />
            <DataCell
              value={row.pebble}
              isFirewood={false}
              advantage={false}
              colors={colors}
            />
            <DataCell
              value={row.firewood}
              isFirewood={true}
              advantage={row.advantage}
              colors={colors}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
