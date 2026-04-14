"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_COLORS } from "./types"
import { InfoTooltip } from "./shared"

interface RevisionNode {
  id: string
  isNew: boolean
  isShared: boolean
  sharedFrom: number | null
}

interface RevisionSnapshot {
  revId: number
  root: RevisionNode
  left: RevisionNode
  right: RevisionNode
}

function createRevision(revId: number, prevRevId: number | null): RevisionSnapshot {
  const isFirst = prevRevId === null
  // One child is new, the other is shared from previous revision
  const leftIsNew = Math.random() > 0.5
  return {
    revId,
    root: {
      id: `r${revId}-root`,
      isNew: true,
      isShared: false,
      sharedFrom: null,
    },
    left: {
      id: `r${revId}-left`,
      isNew: isFirst || leftIsNew,
      isShared: !isFirst && !leftIsNew,
      sharedFrom: !isFirst && !leftIsNew ? prevRevId : null,
    },
    right: {
      id: `r${revId}-right`,
      isNew: isFirst || !leftIsNew,
      isShared: !isFirst && leftIsNew,
      sharedFrom: !isFirst && leftIsNew ? prevRevId : null,
    },
  }
}

export function CopyOnWriteCard({ colors }: { colors: Colors }) {
  const [revisions, setRevisions] = useState<RevisionSnapshot[]>([])
  const [freedRev, setFreedRev] = useState<number | null>(null)
  const revIdRef = useRef(0)
  const isMountedRef = useRef(true)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(t => clearTimeout(t))
    timeoutsRef.current = []
  }, [])

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timeoutsRef.current = [...timeoutsRef.current, t]
    return t
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    const runCycle = () => {
      if (!isMountedRef.current) return

      setFreedRev(null)

      // Step 1: Show revision N
      revIdRef.current++
      const rev1 = createRevision(revIdRef.current, null)
      setRevisions([rev1])

      // Step 2: Add revision N+1 (shares from N)
      addTimeout(() => {
        if (!isMountedRef.current) return
        revIdRef.current++
        const rev2 = createRevision(revIdRef.current, revIdRef.current - 1)
        setRevisions(prev => [...prev, rev2])
      }, 1200)

      // Step 3: Add revision N+2 (shares from N+1)
      addTimeout(() => {
        if (!isMountedRef.current) return
        revIdRef.current++
        const rev3 = createRevision(revIdRef.current, revIdRef.current - 1)
        setRevisions(prev => [...prev, rev3])
      }, 2400)

      // Step 4: Fade out oldest (expired)
      addTimeout(() => {
        if (!isMountedRef.current) return
        setRevisions(prev => prev.slice(1))
        setFreedRev(revIdRef.current - 2)
      }, 3800)

      // Step 5: Reset cycle
      addTimeout(() => {
        if (!isMountedRef.current) return
        setRevisions([])
        setFreedRev(null)
        addTimeout(runCycle, 400)
      }, 5000)
    }

    addTimeout(runCycle, 300)

    return () => {
      isMountedRef.current = false
      clearAllTimeouts()
    }
  }, [addTimeout, clearAllTimeouts])

  const renderNode = (node: RevisionNode, position: "root" | "left" | "right") => {
    const size = position === "root" ? "w-6 h-6" : "w-5 h-5"
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`${size} rounded-full flex items-center justify-center`}
        style={{
          backgroundColor: node.isShared
            ? "transparent"
            : `${FIREWOOD_COLORS.cow}30`,
          border: node.isShared
            ? `1.5px dashed ${FIREWOOD_COLORS.cow}40`
            : `1.5px solid ${FIREWOOD_COLORS.cow}70`,
        }}
      >
        {node.isNew && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: FIREWOOD_COLORS.cow }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          />
        )}
      </motion.div>
    )
  }

  const renderRevision = (rev: RevisionSnapshot, isOldest: boolean) => (
    <motion.div
      key={`rev-${rev.revId}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: isOldest ? 0.5 : 1,
        x: 0,
      }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="flex flex-col items-center gap-1"
    >
      <span
        className="text-[8px] font-mono mb-1"
        style={{ color: `${FIREWOOD_COLORS.cow}90` }}
      >
        rev {rev.revId}
      </span>
      {renderNode(rev.root, "root")}
      {/* Lines from root to children */}
      <svg width="48" height="12" viewBox="0 0 48 12" className="opacity-40">
        <line x1="24" y1="0" x2="10" y2="12" stroke={FIREWOOD_COLORS.cow} strokeWidth="1" />
        <line x1="24" y1="0" x2="38" y2="12" stroke={FIREWOOD_COLORS.cow} strokeWidth="1" />
      </svg>
      <div className="flex items-center gap-3">
        {renderNode(rev.left, "left")}
        {renderNode(rev.right, "right")}
      </div>
    </motion.div>
  )

  return (
    <div className={`p-6 h-full flex flex-col ${colors.blockBg}`}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
            Copy-on-write revisions.
          </h3>
          <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
            New roots share unchanged nodes. Only modified paths are copied.
          </p>
        </div>
        <InfoTooltip colors={colors} text="Instead of copying the whole trie, Firewood creates a new root that points to mostly the same nodes — only the modified paths get new nodes. The default retention is 128 revisions (max_revisions in config), accessible for consensus and API queries. When a revision expires, its unique nodes are returned to the free lists." />
      </div>

      {/* Revision timeline */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-end gap-6 relative">
          <AnimatePresence mode="popLayout">
            {revisions.map((rev, i) =>
              renderRevision(rev, i === 0 && revisions.length === 3)
            )}
          </AnimatePresence>

          {/* Freed label */}
          <AnimatePresence>
            {freedRev !== null && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -left-2 top-0 text-[9px] font-mono"
                style={{ color: FIREWOOD_COLORS.disk }}
              >
                freed
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mechanism description — no fabricated numbers */}
      <motion.div
        className={`flex items-center justify-center gap-3 text-[10px] font-mono pt-3 mt-auto`}
        style={{ borderTop: `1px solid ${colors.stroke}10` }}
      >
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: FIREWOOD_COLORS.cow }} />
          <span style={{ color: FIREWOOD_COLORS.cow }}>new node</span>
        </span>
        <span className={colors.textMuted}>|</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full inline-block" style={{ border: `1.5px dashed ${FIREWOOD_COLORS.cow}40` }} />
          <span className={colors.textMuted}>shared from prior rev</span>
        </span>
        <span className={colors.textMuted}>|</span>
        <span className={colors.textMuted}>
          retention: 128 revs
        </span>
      </motion.div>
    </div>
  )
}
