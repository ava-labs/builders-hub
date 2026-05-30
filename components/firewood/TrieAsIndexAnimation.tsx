"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS, NIBBLES } from "./types"
import { InfoTooltip } from "./shared"

// Tree layout in SVG viewBox coordinates (0,0 to 460,260)
const VB_W = 480, VB_H = 310

interface NodeDef {
  id: string
  type: "branch" | "leaf"
  offset: string
  cx: number
  cy: number
  value?: string
}

const NODES: Record<string, NodeDef> = {
  root: { id: "root", type: "branch", offset: "0x0000", cx: 250, cy: 40 },
  b3:   { id: "b3",   type: "branch", offset: "0x1A20", cx: 100, cy: 145 },
  b7:   { id: "b7",   type: "branch", offset: "0x3100", cx: 250, cy: 145 },
  bA:   { id: "bA",   type: "branch", offset: "0x5200", cx: 400, cy: 145 },
  l35:  { id: "l35",  type: "leaf",   offset: "0x2F40", cx: 60,  cy: 255, value: "1.5 AVAX" },
  l38:  { id: "l38",  type: "leaf",   offset: "0x3580", cx: 145, cy: 255 },
  l7C:  { id: "l7C",  type: "leaf",   offset: "0x4A80", cx: 250, cy: 255, value: "0xef..." },
  lA1:  { id: "lA1",  type: "leaf",   offset: "0x6B00", cx: 400, cy: 255, value: "42" },
}

const EDGES: [string, string][] = [
  ["root", "b3"], ["root", "b7"], ["root", "bA"],
  ["b3", "l35"], ["b3", "l38"], ["b7", "l7C"], ["bA", "lA1"],
]

const PATHS = [
  { nodes: ["root", "b3", "l35"], nibbles: [3, 5], label: "balance: 1.5 AVAX" },
  { nodes: ["root", "b7", "l7C"], nibbles: [7, 12], label: "code: 0xef..." },
  { nodes: ["root", "bA", "lA1"], nibbles: [10, 1], label: "storage: 42" },
]

// In LevelDB, each trie level requires: hash the node key, then do a full LSM lookup
// (memtable + L0-L6 SSTables with bloom filters and block index). This repeats per level.
const LEVELDB_STEPS = ["Hash node key", "Check memtable", "Query bloom filters", "Seek SSTable", "Read data block", "Repeat per trie level..."]
const CIRCLED = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465"]

// SVG sub-components rendered inside the viewBox

function SvgNibbleGrid({ cx, cy, activeNibble, stroke }: { cx: number; cy: number; activeNibble: number | null; stroke: string }) {
  const size = 5.5, gap = 2, cols = 4
  const gridW = cols * size + (cols - 1) * gap
  const startX = cx - gridW / 2
  const startY = cy - gridW / 2

  return (
    <g>
      {NIBBLES.map((_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return (
          <rect
            key={i}
            x={startX + col * (size + gap)}
            y={startY + row * (size + gap)}
            width={size}
            height={size}
            rx={0.5}
            fill={activeNibble === i ? FIREWOOD_COLORS.trie : `${stroke}20`}
            style={{ transition: "fill 0.2s" }}
          />
        )
      })}
    </g>
  )
}

function SvgBranchNode({ node, highlighted, activeNibble, stroke }: {
  node: NodeDef; highlighted: boolean; activeNibble: number | null; stroke: string
}) {
  const w = 48, h = 38
  const accent = FIREWOOD_COLORS.trie
  return (
    <g>
      <rect
        x={node.cx - w / 2} y={node.cy - h / 2}
        width={w} height={h} rx={2}
        fill={highlighted ? `${accent}15` : `${stroke}06`}
        stroke={highlighted ? accent : `${stroke}20`}
        strokeWidth={highlighted ? 1.5 : 0.8}
        style={{ transition: "all 0.25s" }}
      />
      {highlighted && (
        <rect
          x={node.cx - w / 2} y={node.cy - h / 2}
          width={w} height={h} rx={2}
          fill="none" stroke={accent} strokeWidth={1.5}
          opacity={0.5}
          style={{ filter: `drop-shadow(0 0 4px ${accent}60)` }}
        />
      )}
      <SvgNibbleGrid cx={node.cx} cy={node.cy} activeNibble={activeNibble} stroke={stroke} />
      <text x={node.cx} y={node.cy + h / 2 + 12} textAnchor="middle"
        fontSize={8} fontFamily="monospace" fill={`${stroke}40`}>
        @{node.offset}
      </text>
    </g>
  )
}

function SvgLeafNode({ node, highlighted, stroke }: {
  node: NodeDef; highlighted: boolean; stroke: string
}) {
  const w = 56, h = 28
  const accent = FIREWOOD_COLORS.disk
  return (
    <g>
      <rect
        x={node.cx - w / 2} y={node.cy - h / 2}
        width={w} height={h} rx={2}
        fill={highlighted ? `${accent}15` : `${stroke}06`}
        stroke={highlighted ? accent : `${stroke}20`}
        strokeWidth={highlighted ? 1.5 : 0.8}
        style={{ transition: "all 0.25s" }}
      />
      {highlighted && (
        <rect
          x={node.cx - w / 2} y={node.cy - h / 2}
          width={w} height={h} rx={2}
          fill="none" stroke={accent} strokeWidth={1.5}
          opacity={0.5}
          style={{ filter: `drop-shadow(0 0 4px ${accent}60)` }}
        />
      )}
      {node.value && (
        <text x={node.cx} y={node.cy + 4} textAnchor="middle"
          fontSize={9} fontFamily="monospace" fontWeight="bold"
          fill={highlighted ? accent : `${stroke}40`}
          style={{ transition: "fill 0.25s" }}>
          {node.value}
        </text>
      )}
      <text x={node.cx} y={node.cy + h / 2 + 12} textAnchor="middle"
        fontSize={8} fontFamily="monospace" fill={`${stroke}35`}>
        @{node.offset}
      </text>
    </g>
  )
}

export function TrieAsIndexAnimation({ colors }: { colors: Colors }) {
  const [pathIndex, setPathIndex] = useState(0)
  const [step, setStep] = useState(-1)
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set())
  const [activeNibbles, setActiveNibbles] = useState<Map<string, number>>(new Map())
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set())
  const [caption, setCaption] = useState("")

  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const clearAll = useCallback(() => { timeoutsRef.current.forEach(clearTimeout); timeoutsRef.current = [] }, [])
  const after = useCallback((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timeoutsRef.current = [...timeoutsRef.current, t] }, [])

  const currentPath = PATHS[pathIndex]

  const fwSteps = currentPath.nodes.map((nid, i) => {
    const n = NODES[nid]
    return i === 0 ? `Read root @${n.offset}` : `Follow \u2192 @${n.offset}`
  })
  const fwVisible = Math.min(Math.max(0, Math.floor((step + 1) / 2) + 1), fwSteps.length)
  const ldbVisible = Math.min(Math.max(0, Math.ceil((step + 1) * (LEVELDB_STEPS.length / 6))), LEVELDB_STEPS.length)

  useEffect(() => {
    isMountedRef.current = true
    const ok = () => isMountedRef.current

    const run = (pi: number) => {
      if (!ok()) return
      clearAll()
      const p = PATHS[pi]
      const [n0, n1, n2] = p.nodes
      const [nib0, nib1] = p.nibbles

      setPathIndex(pi)
      setStep(-1)
      setHighlightedNodes(new Set())
      setActiveNibbles(new Map())
      setActiveEdges(new Set())
      setCaption("")

      // Highlight root
      after(() => { if (ok()) { setStep(0); setHighlightedNodes(new Set([n0])) } }, 300)
      // Nibble in root + edge
      after(() => { if (ok()) { setStep(1); setActiveNibbles(new Map([[n0, nib0]])); setActiveEdges(new Set([`${n0}-${n1}`])) } }, 1100)
      // Highlight branch
      after(() => { if (ok()) { setStep(2); setHighlightedNodes(new Set([n0, n1])) } }, 1900)
      // Nibble in branch + edge to leaf
      after(() => { if (ok()) { setStep(3); setActiveNibbles(new Map([[n0, nib0], [n1, nib1]])); setActiveEdges(new Set([`${n0}-${n1}`, `${n1}-${n2}`])) } }, 2700)
      // Highlight leaf
      after(() => { if (ok()) { setStep(4); setHighlightedNodes(new Set([n0, n1, n2])) } }, 3500)
      // Caption
      const offsets = p.nodes.map((id) => NODES[id].offset)
      after(() => { if (ok()) { setStep(5); setCaption(`${offsets.length} pread() calls: @${offsets.join(" \u2192 @")}`) } }, 4200)
      // Next
      after(() => { if (ok()) run((pi + 1) % PATHS.length) }, 6000)
    }

    run(0)
    return () => { isMountedRef.current = false; clearAll() }
  }, [after, clearAll])

  return (
    <div className={`p-4 sm:p-6 border ${colors.border} ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-1`}>Trie-as-Index</h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            Firewood stores trie nodes at byte offsets on disk. The trie IS the index — no hash lookups needed.
          </p>
        </div>
        <InfoTooltip colors={colors} text="Reading an account balance or storage slot means walking the trie: start at root, pick the nibble (0-F) matching the key, follow the pointer to the next node. Each pointer is a byte offset in the file — one pread() at that offset. In LevelDB, each trie level requires a hash lookup followed by a full LSM-tree traversal (memtable, bloom filters, SSTables)." />
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Left: SVG Trie */}
        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full">
            {/* Edges */}
            {EDGES.map(([pid, cid]) => {
              const p = NODES[pid], c = NODES[cid]
              const on = activeEdges.has(`${pid}-${cid}`)
              const bh = p.type === "branch" ? 19 : 14
              const ch = c.type === "branch" ? 19 : 14
              return (
                <line
                  key={`${pid}-${cid}`}
                  x1={p.cx} y1={p.cy + bh}
                  x2={c.cx} y2={c.cy - ch}
                  stroke={on ? FIREWOOD_COLORS.trie : `${colors.stroke}12`}
                  strokeWidth={on ? 1.5 : 0.8}
                  strokeDasharray={on ? "none" : "3 2"}
                  style={{ transition: "all 0.3s" }}
                />
              )
            })}

            {/* Nodes */}
            {Object.values(NODES).map((node) =>
              node.type === "branch" ? (
                <SvgBranchNode
                  key={node.id}
                  node={node}
                  highlighted={highlightedNodes.has(node.id)}
                  activeNibble={activeNibbles.get(node.id) ?? null}
                  stroke={colors.stroke}
                />
              ) : (
                <SvgLeafNode
                  key={node.id}
                  node={node}
                  highlighted={highlightedNodes.has(node.id)}
                  stroke={colors.stroke}
                />
              )
            )}

            {/* "root" label */}
            <text x={NODES.root.cx} y={NODES.root.cy - 26} textAnchor="middle"
              fontSize={9} fontFamily="monospace" fill={`${colors.stroke}30`}>
              root
            </text>
          </svg>

          {/* Caption */}
          <div className="h-4 text-center mt-1">
            <AnimatePresence mode="wait">
              {caption && (
                <motion.span key={`c-${pathIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[10px] font-mono" style={{ color: FIREWOOD_COLORS.trie }}>
                  {caption}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Step counters */}
        <div className="flex-shrink-0 md:w-[190px]">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2" style={{ backgroundColor: FIREWOOD_COLORS.leveldb }} />
              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${colors.text}`}>LevelDB</span>
            </div>
            {LEVELDB_STEPS.map((s, i) => (
              <motion.div key={s} animate={{ opacity: i < ldbVisible ? 1 : 0.2 }} className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px]" style={{ color: i < ldbVisible ? FIREWOOD_COLORS.leveldb : `${colors.stroke}20` }}>{CIRCLED[i]}</span>
                <span className="text-[10px] font-mono" style={{ color: i < ldbVisible ? `${colors.stroke}70` : `${colors.stroke}20` }}>{s}</span>
              </motion.div>
            ))}
            <div className="text-[11px] font-mono font-bold mt-1.5" style={{ color: FIREWOOD_COLORS.leveldb, opacity: ldbVisible >= LEVELDB_STEPS.length ? 1 : 0.3 }}>
              {"\u2192"} per trie level
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2" style={{ backgroundColor: FIREWOOD_COLORS.trie }} />
              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${colors.text}`}>Firewood</span>
            </div>
            {fwSteps.map((s, i) => (
              <motion.div key={`${pathIndex}-${i}`} animate={{ opacity: i < fwVisible ? 1 : 0.2 }} className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px]" style={{ color: i < fwVisible ? FIREWOOD_COLORS.trie : `${colors.stroke}20` }}>{CIRCLED[i]}</span>
                <span className="text-[10px] font-mono" style={{ color: i < fwVisible ? `${colors.stroke}70` : `${colors.stroke}20` }}>{s}</span>
              </motion.div>
            ))}
            <div className="text-[11px] font-mono font-bold mt-1.5" style={{ color: FIREWOOD_COLORS.trie, opacity: fwVisible >= fwSteps.length ? 1 : 0.3 }}>
              {"\u2192"} 1 pread() each
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
