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

export interface Revision {
  id: number
  root: number
  totalNodes: number
  sharedNodes: number
  newNodes: number
}

export const FIREWOOD_CONFIG = {
  revisionRetention: 128,
  areaCount: 23,
  minAreaSize: 16,
  maxAreaSize: 16 * 1024 * 1024, // 16MB
  subtreeCount: 16,
  nibbleValues: 16,
  gasRate: 30_000_000, // R = 30M gas/sec
  deferredPersistencePermits: 1,
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

// Nibble labels (0-F) for trie visualization
export const NIBBLES = [
  "0", "1", "2", "3", "4", "5", "6", "7",
  "8", "9", "A", "B", "C", "D", "E", "F",
] as const
