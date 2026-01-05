"use client"
import { Colors, FIREWOOD_PALETTE } from "./types"

// Key insight diagram: address-based vs hash-based
export function AddressVsHashDiagram({ colors }: { colors: Colors }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`text-xs uppercase tracking-widest ${colors.text} font-semibold`}>
          The Core Innovation
        </span>
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Hash-based (LevelDB) */}
              <div className="flex flex-col items-center">
                <div
                  className="w-full p-4 mb-4 rounded-sm"
                  style={{ backgroundColor: FIREWOOD_PALETTE.ember + '15', border: `1px solid ${FIREWOOD_PALETTE.ember}40` }}
                >
                  <h4 className="text-sm font-bold mb-3" style={{ color: FIREWOOD_PALETTE.ember }}>
                    Content-Addressed (LevelDB)
                  </h4>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className={colors.textMuted}>1. Compute hash</span>
                      <span className={colors.textFaint}>→</span>
                      <span style={{ color: FIREWOOD_PALETTE.maple }}>SHA256(node)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={colors.textMuted}>2. Lookup hash</span>
                      <span className={colors.textFaint}>→</span>
                      <span style={{ color: FIREWOOD_PALETTE.maple }}>LSM search</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={colors.textMuted}>3. Get data</span>
                      <span className={colors.textFaint}>→</span>
                      <span style={{ color: FIREWOOD_PALETTE.maple }}>deserialize</span>
                    </div>
                  </div>
                </div>
                <div className={`text-[9px] ${colors.textMuted} text-center`}>
                  O(log n) lookup per node traversal
                </div>
              </div>

              {/* Address-based (Firewood) */}
              <div className="flex flex-col items-center">
                <div
                  className="w-full p-4 mb-4 rounded-sm"
                  style={{ backgroundColor: FIREWOOD_PALETTE.moss + '15', border: `1px solid ${FIREWOOD_PALETTE.moss}40` }}
                >
                  <h4 className="text-sm font-bold mb-3" style={{ color: FIREWOOD_PALETTE.moss }}>
                    Address-Based (Firewood)
                  </h4>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className={colors.textMuted}>1. Read address</span>
                      <span className={colors.textFaint}>→</span>
                      <span style={{ color: FIREWOOD_PALETTE.moss }}>disk_offset</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={colors.textMuted}>2. Seek + read</span>
                      <span className={colors.textFaint}>→</span>
                      <span style={{ color: FIREWOOD_PALETTE.moss }}>node data</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-40">
                      <span className={colors.textMuted}>3. No hash lookup</span>
                    </div>
                  </div>
                </div>
                <div className={`text-[9px] ${colors.textMuted} text-center`}>
                  O(1) direct disk access
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          The fundamental insight: node location = disk offset. No hash table, no LSM lookup, no content addressing overhead. Branch nodes store child addresses directly. Traversing the trie is just following pointers on disk.
        </p>
      </div>
    </div>
  )
}

// Keep TrieNativeStorage export for backwards compatibility
export function TrieNativeStorage({ colors }: { colors: Colors }) {
  return <AddressVsHashDiagram colors={colors} />
}
