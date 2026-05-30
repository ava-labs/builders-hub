"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"

// Three-level Merkle Patricia fragment
//       root
//      /    \
//    iL      iR      (intermediate branch nodes)
//   /  \    /  \
//  L0  L1  L2  L3    (leaves)
//
// Per non-first revision: one modified path copies exactly 3 nodes
// (root + one intermediate + one leaf). The sibling intermediate and the
// sibling leaf under the new intermediate are SHARED — their pointers
// cross revision boundaries into the prior revision's nodes.

const REV_W = 150
const GAP = 40
const COL_OFFSET = REV_W + GAP
const TOTAL_W = REV_W * 3 + GAP * 2
const TOTAL_H = 140

const ROOT = { x: 75, y: 22 } as const
const INT_POS = [
  { x: 36, y: 68 },
  { x: 114, y: 68 },
] as const
const LEAF_POS = [
  { x: 14, y: 112 },
  { x: 58, y: 112 },
  { x: 92, y: 112 },
  { x: 136, y: 112 },
] as const

const NEW_COLOR = FIREWOOD_COLORS.cow

interface RevisionPath {
  int: 0 | 1
  leaf: 0 | 1
}

interface Revision {
  revId: number
  path: RevisionPath | null
}

function randomPath(): RevisionPath {
  return {
    int: (Math.random() > 0.5 ? 0 : 1) as 0 | 1,
    leaf: (Math.random() > 0.5 ? 0 : 1) as 0 | 1,
  }
}

type NodeStatus = "new" | "shared" | "hidden"

function computeStatus(rev: Revision) {
  if (rev.path === null) {
    return {
      intStatus: ["new", "new"] as NodeStatus[],
      leafStatus: ["new", "new", "new", "new"] as NodeStatus[],
    }
  }
  const { int, leaf } = rev.path
  const intStatus: NodeStatus[] = [
    int === 0 ? "new" : "shared",
    int === 1 ? "new" : "shared",
  ]
  const leafStatus: NodeStatus[] = [
    int === 0 ? (leaf === 0 ? "new" : "shared") : "hidden",
    int === 0 ? (leaf === 1 ? "new" : "shared") : "hidden",
    int === 1 ? (leaf === 0 ? "new" : "shared") : "hidden",
    int === 1 ? (leaf === 1 ? "new" : "shared") : "hidden",
  ]
  return { intStatus, leafStatus }
}

interface CrossArrow {
  fromCol: number
  toCol: number
  pos: { x: number; y: number }
}

function getCrossArrows(rev: Revision, colIndex: number): CrossArrow[] {
  if (rev.path === null || colIndex === 0) return []
  const sharedInt = rev.path.int === 0 ? 1 : 0
  const sharedLeafIdx =
    rev.path.int === 0
      ? rev.path.leaf === 0
        ? 1
        : 0
      : rev.path.leaf === 0
        ? 3
        : 2
  return [
    { fromCol: colIndex, toCol: colIndex - 1, pos: INT_POS[sharedInt] },
    { fromCol: colIndex, toCol: colIndex - 1, pos: LEAF_POS[sharedLeafIdx] },
  ]
}

function Tree({
  rev,
  colIndex,
  stroke,
  expiring,
}: {
  rev: Revision
  colIndex: number
  stroke: string
  expiring: boolean
}) {
  const status = computeStatus(rev)
  const dx = colIndex * COL_OFFSET
  const opacity = expiring ? 0.35 : 1
  const sharedColor = `${stroke}55`

  const branchNode = (cx: number, cy: number, r: number, kind: NodeStatus, delay: number) => {
    if (kind === "hidden") return null
    const isNew = kind === "new"
    return (
      <motion.circle
        cx={dx + cx}
        cy={cy}
        r={r}
        fill={isNew ? `${NEW_COLOR}22` : "transparent"}
        stroke={isNew ? NEW_COLOR : sharedColor}
        strokeWidth={1.5}
        strokeDasharray={isNew ? undefined : "2 2"}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 22, delay }}
      />
    )
  }

  const leafNode = (cx: number, cy: number, kind: NodeStatus, delay: number) => {
    if (kind === "hidden") return null
    const isNew = kind === "new"
    const size = 8
    return (
      <motion.rect
        x={dx + cx - size / 2}
        y={cy - size / 2}
        width={size}
        height={size}
        fill={isNew ? `${NEW_COLOR}22` : "transparent"}
        stroke={isNew ? NEW_COLOR : sharedColor}
        strokeWidth={1.25}
        strokeDasharray={isNew ? undefined : "2 2"}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 22, delay }}
      />
    )
  }

  const edge = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    kind: NodeStatus,
    delay: number,
    key: string,
  ) => {
    if (kind === "hidden") return null
    const isNew = kind === "new"
    return (
      <motion.line
        key={key}
        x1={dx + from.x}
        y1={from.y}
        x2={dx + to.x}
        y2={to.y}
        stroke={isNew ? NEW_COLOR : sharedColor}
        strokeWidth={1}
        strokeDasharray={isNew ? undefined : "2 2"}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: (isNew ? 0.7 : 0.45) * (expiring ? 0.4 : 1),
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, delay }}
      />
    )
  }

  return (
    <g>
      {/* Revision label */}
      <motion.text
        x={dx + REV_W / 2}
        y={10}
        textAnchor="middle"
        fontSize="9"
        fontFamily="monospace"
        fill={`${stroke}80`}
        initial={{ opacity: 0 }}
        animate={{ opacity: opacity * 0.8 }}
        exit={{ opacity: 0 }}
      >
        rev {rev.revId}
      </motion.text>

      {/* Level 0 → Level 1 edges */}
      {edge(ROOT, INT_POS[0], status.intStatus[0], 0.15, "e-r-iL")}
      {edge(ROOT, INT_POS[1], status.intStatus[1], 0.15, "e-r-iR")}

      {/* Level 1 → Level 2 edges (only under NEW intermediates) */}
      {status.intStatus[0] === "new" &&
        edge(INT_POS[0], LEAF_POS[0], status.leafStatus[0], 0.3, "e-iL-L0")}
      {status.intStatus[0] === "new" &&
        edge(INT_POS[0], LEAF_POS[1], status.leafStatus[1], 0.3, "e-iL-L1")}
      {status.intStatus[1] === "new" &&
        edge(INT_POS[1], LEAF_POS[2], status.leafStatus[2], 0.3, "e-iR-L2")}
      {status.intStatus[1] === "new" &&
        edge(INT_POS[1], LEAF_POS[3], status.leafStatus[3], 0.3, "e-iR-L3")}

      {/* Leaves */}
      {leafNode(LEAF_POS[0].x, LEAF_POS[0].y, status.leafStatus[0], 0.45)}
      {leafNode(LEAF_POS[1].x, LEAF_POS[1].y, status.leafStatus[1], 0.45)}
      {leafNode(LEAF_POS[2].x, LEAF_POS[2].y, status.leafStatus[2], 0.45)}
      {leafNode(LEAF_POS[3].x, LEAF_POS[3].y, status.leafStatus[3], 0.45)}

      {/* Intermediates */}
      {branchNode(INT_POS[0].x, INT_POS[0].y, 6, status.intStatus[0], 0.25)}
      {branchNode(INT_POS[1].x, INT_POS[1].y, 6, status.intStatus[1], 0.25)}

      {/* Root (always new) */}
      {branchNode(ROOT.x, ROOT.y, 7, "new", 0)}
    </g>
  )
}

function CrossArrow({
  arrow,
  expiring,
}: {
  arrow: CrossArrow
  expiring: boolean
}) {
  const fx = arrow.fromCol * COL_OFFSET + arrow.pos.x
  const tx = arrow.toCol * COL_OFFSET + arrow.pos.x
  const y = arrow.pos.y
  // Arc UP over the gap between columns for visual clarity
  const arcHeight = 16
  const cpx = (fx + tx) / 2
  const cpy = y - arcHeight
  const d = `M ${fx} ${y} Q ${cpx} ${cpy} ${tx} ${y}`
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={NEW_COLOR}
      strokeWidth={1}
      strokeDasharray="3 2.5"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: expiring ? 0.3 : 0.75 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
    />
  )
}

export function CopyOnWriteCard({ colors }: { colors: Colors }) {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const revIdRef = useRef(0)
  const mountedRef = useRef(true)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current = [...timersRef.current, t]
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const cycle = () => {
      if (!mountedRef.current) return

      // rev 1 — first revision, all new
      revIdRef.current = revIdRef.current + 1
      setRevisions([{ revId: revIdRef.current, path: null }])

      // rev 2 — shares from rev 1 along all unmodified subtrees
      schedule(() => {
        if (!mountedRef.current) return
        revIdRef.current = revIdRef.current + 1
        setRevisions((prev) => [
          ...prev,
          { revId: revIdRef.current, path: randomPath() },
        ])
      }, 1700)

      // rev 3 — shares from rev 2
      schedule(() => {
        if (!mountedRef.current) return
        revIdRef.current = revIdRef.current + 1
        setRevisions((prev) => [
          ...prev,
          { revId: revIdRef.current, path: randomPath() },
        ])
      }, 3400)

      // Expire the oldest (fade), then reset
      schedule(() => {
        if (!mountedRef.current) return
        setRevisions((prev) => prev.slice(1))
      }, 5100)

      schedule(() => {
        if (!mountedRef.current) return
        setRevisions([])
        schedule(cycle, 500)
      }, 6200)
    }

    schedule(cycle, 300)

    return () => {
      mountedRef.current = false
      clearTimers()
    }
  }, [schedule, clearTimers])

  const crossArrows: CrossArrow[] = revisions.flatMap((rev, i) =>
    getCrossArrows(rev, i),
  )

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Copy-on-write revisions.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            A new root copies the modified path only. Untouched subtrees stay shared by pointer across revisions.
          </p>
        </div>
        <InfoTooltip
          colors={colors}
          text="Each commit writes a new root, but only the nodes on the modified path are copied — root, the intermediate branch above the changed leaf, and the leaf itself. Every untouched subtree is referenced by disk offset from the prior revision, so three copied nodes stand in for an entire shared history. Retention is 128 revisions (max_revisions); when one expires, its unique nodes return to the free list."
        />
      </div>

      {/* Trie timeline */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <svg
          viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ maxHeight: 170 }}
        >
          {/* Subtle column dividers between revisions */}
          {[1, 2].map((i) => (
            <line
              key={`div-${i}`}
              x1={i * COL_OFFSET - GAP / 2}
              y1={0}
              x2={i * COL_OFFSET - GAP / 2}
              y2={TOTAL_H}
              stroke={`${colors.stroke}10`}
              strokeDasharray="2 4"
              strokeWidth={0.5}
            />
          ))}

          <AnimatePresence mode="popLayout">
            {revisions.map((rev, i) => (
              <Tree
                key={`rev-${rev.revId}`}
                rev={rev}
                colIndex={i}
                stroke={colors.stroke}
                expiring={i === 0 && revisions.length === 3}
              />
            ))}
          </AnimatePresence>

          {/* Cross-revision pointer arrows */}
          <AnimatePresence>
            {crossArrows.map((arrow, i) => (
              <CrossArrow
                key={`arrow-${revisions[arrow.fromCol]?.revId}-${i}`}
                arrow={arrow}
                expiring={
                  revisions[0] && arrow.toCol === 0 && revisions.length === 3
                }
              />
            ))}
          </AnimatePresence>
        </svg>
      </div>

      {/* Legend */}
      <div
        className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[10px] font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 inline-block rounded-full"
            style={{
              backgroundColor: `${NEW_COLOR}22`,
              border: `1.5px solid ${NEW_COLOR}`,
            }}
          />
          <span style={{ color: NEW_COLOR }}>copied</span>
        </span>
        <span className={colors.textFaint}>|</span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 inline-block rounded-full"
            style={{ border: `1.5px dashed ${colors.stroke}55` }}
          />
          <span className={colors.textMuted}>shared by pointer</span>
        </span>
        <span className={colors.textFaint}>|</span>
        <span className={colors.textMuted}>retention: 128 revs</span>
      </div>
    </div>
  )
}
