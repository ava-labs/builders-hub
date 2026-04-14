// Shared types and constants for Firewood components
// Reuse Colors from SAE — same theme system
export type { Colors } from "../sae/types"

export interface TrieNode {
  id: string
  type: "branch" | "leaf"
  offset: number
  children?: (TrieNode | null)[]
  partialPath?: string
  value?: string
}

export const FIREWOOD_CONFIG = {
  revisionRetention: 128,
  areaCount: 23,
  minAreaSize: 16,
  maxAreaSize: 16 * 1024 * 1024, // 16MB
  subtreeCount: 16, // PathComponent::LEN = 16 (hexary trie, one per nibble 0-F)
  nibbleValues: 16,
  // Source: firewood/src/manager.rs — deferred_persistence_commit_count default = nonzero!(1u64)
  deferredPersistencePermits: 1,
  // Source: firewood/src/manager.rs — node_cache_memory_limit default = nonzero!(192_000_000_usize)
  nodeCacheMemoryMB: 192,
  // Source: firewood/src/db.rs — UseParallel::BatchSize(8) default
  parallelBatchThreshold: 8,
} as const

// Accent colors for different Firewood concepts
export const FIREWOOD_COLORS = {
  rust: "#DEA584",
  trie: "#3b82f6",
  disk: "#22c55e",
  compaction: "#ef4444",
  parallel: "#8b5cf6",
  cow: "#06b6d4",
  fdl: "#f97316",
  leveldb: "#94a3b8",
  pebble: "#64748b",
  firewood: "#DEA584",
} as const

// Light-mode solid tints for each accent color.
// In dark mode, hex alpha on bright colors works fine.
// In light mode, hex alpha on muted colors is invisible — use pre-computed solid tints instead.
const RUST_TINT = { bg: "#f5e6d8", bgStrong: "#ebd0b8", border: "#d4a574", borderStrong: "#c08050" }

export const LIGHT_TINTS: Record<string, { bg: string; bgStrong: string; border: string; borderStrong: string }> = {
  [FIREWOOD_COLORS.leveldb]:    { bg: "#e8ecf0", bgStrong: "#d4dbe3", border: "#b0bec5", borderStrong: "#90a4ae" },
  [FIREWOOD_COLORS.rust]:       RUST_TINT,
  [FIREWOOD_COLORS.disk]:       { bg: "#dcf5e4", bgStrong: "#b8ebc8", border: "#6dd490", borderStrong: "#3cc060" },
  [FIREWOOD_COLORS.trie]:       { bg: "#dbeafe", bgStrong: "#bfdbfe", border: "#7cb3f4", borderStrong: "#5094e8" },
  [FIREWOOD_COLORS.compaction]: { bg: "#fee2e2", bgStrong: "#fecaca", border: "#f08080", borderStrong: "#e05050" },
  [FIREWOOD_COLORS.parallel]:   { bg: "#ede9fe", bgStrong: "#ddd6fe", border: "#a78bfa", borderStrong: "#8b5cf6" },
  [FIREWOOD_COLORS.cow]:        { bg: "#cffafe", bgStrong: "#a5f3fc", border: "#22d3ee", borderStrong: "#06b6d4" },
}

// Theme-aware color picker. Returns hex-alpha in dark mode, solid tint in light mode.
export function lt(stroke: string, accent: string, variant: "bg" | "bgStrong" | "border" | "borderStrong", darkHex: string): string {
  if (stroke !== "#000000") return `${accent}${darkHex}`
  const tint = LIGHT_TINTS[accent]
  return tint ? tint[variant] : `${accent}${darkHex}`
}

// Nibble labels (0-F) for trie visualization
export const NIBBLES = [
  "0", "1", "2", "3", "4", "5", "6", "7",
  "8", "9", "A", "B", "C", "D", "E", "F",
] as const
