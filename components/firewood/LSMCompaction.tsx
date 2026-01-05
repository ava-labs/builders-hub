"use client"
import { Colors, FIREWOOD_PALETTE } from "./types"

// Simplified synchronous diagram showing the problem
export function LSMProblemDiagram({ colors }: { colors: Colors }) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-xs uppercase tracking-widest ${colors.text} font-semibold`}>
          The Flattening Problem
        </span>
      </div>

      {/* Diagram */}
      <div
        className="p-2 sm:p-3 rounded-sm"
        style={{
          backgroundColor: colors.wood + '08',
          border: `1px solid ${colors.wood}20`,
        }}
      >
        <div className={`p-2 sm:p-3 border ${colors.border} ${colors.blockBg} rounded-sm`}>
          <div
            className="p-6 sm:p-8 rounded-sm"
            style={{
              backgroundColor: colors.wood + '05',
              boxShadow: `inset 0 2px 8px 0 ${colors.wood}15`,
              border: `1px solid ${colors.wood}20`,
            }}
          >
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
              {/* Merkle Trie (logical structure) */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: colors.wood }}>
                  EVM State Trie
                </span>
                <div className="relative w-32 h-24">
                  {/* Root */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.ember, top: 0 }}
                  />
                  {/* Level 1 */}
                  <div
                    className="absolute w-5 h-5 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.oak, top: 28, left: 20 }}
                  />
                  <div
                    className="absolute w-5 h-5 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.oak, top: 28, right: 20 }}
                  />
                  {/* Level 2 */}
                  <div
                    className="absolute w-4 h-4 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.moss, top: 56, left: 8 }}
                  />
                  <div
                    className="absolute w-4 h-4 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.moss, top: 56, left: 32 }}
                  />
                  <div
                    className="absolute w-4 h-4 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.moss, top: 56, right: 32 }}
                  />
                  <div
                    className="absolute w-4 h-4 rounded-sm"
                    style={{ backgroundColor: FIREWOOD_PALETTE.moss, top: 56, right: 8 }}
                  />
                  {/* Lines */}
                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: -1 }}>
                    <line x1="64" y1="24" x2="32" y2="28" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                    <line x1="64" y1="24" x2="96" y2="28" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                    <line x1="32" y1="48" x2="16" y2="56" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                    <line x1="32" y1="48" x2="40" y2="56" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                    <line x1="96" y1="48" x2="88" y2="56" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                    <line x1="96" y1="48" x2="112" y2="56" stroke={colors.wood} strokeOpacity="0.4" strokeWidth="1" />
                  </svg>
                </div>
                <span className={`text-[9px] font-mono ${colors.textFaint}`}>Hierarchical structure</span>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <svg width="40" height="24" viewBox="0 0 40 24" className="rotate-90 md:rotate-0">
                  <path d="M0 12 L30 12 M22 6 L30 12 L22 18" stroke={colors.wood} strokeOpacity="0.6" strokeWidth="2" fill="none" />
                </svg>
                <span className={`text-[9px] font-mono uppercase ${colors.textFaint}`}>flattened</span>
              </div>

              {/* KV Store (flattened) */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: colors.wood }}>
                  Generic KV Store
                </span>
                <div className="flex flex-col gap-1">
                  {[
                    { key: 'hash(root)', val: 'blob' },
                    { key: 'hash(node1)', val: 'blob' },
                    { key: 'hash(node2)', val: 'blob' },
                    { key: 'hash(leaf1)', val: 'data' },
                    { key: 'hash(leaf2)', val: 'data' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[9px] font-mono px-2 py-1 rounded-sm"
                      style={{ backgroundColor: colors.wood + '10', border: `1px solid ${colors.wood}20` }}
                    >
                      <span style={{ color: FIREWOOD_PALETTE.maple }}>{item.key}</span>
                      <span className={colors.textFaint}>→</span>
                      <span className={colors.textMuted}>{item.val}</span>
                    </div>
                  ))}
                </div>
                <span className={`text-[9px] font-mono ${colors.textFaint}`}>Flat key-value pairs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-4">
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          Traditional EVM implementations flatten the hierarchical trie structure into generic key-value storage. This loses the inherent tree relationships and requires hash lookups to traverse nodes — content-addressed storage adds overhead.
        </p>
      </div>
    </div>
  )
}

// Keep LSMCompaction export for backwards compatibility (even if not used)
export function LSMCompaction({ colors }: { colors: Colors }) {
  return <LSMProblemDiagram colors={colors} />
}
