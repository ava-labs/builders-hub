// Shared types and constants for SAE components

export interface Block {
  id: number
  uid: string // Unique identifier for React keys
  txCount: number
  txColors: string[] // Colors of transactions in this block
  createdAt: number
  spanCount?: number // Number of consensus blocks this execution block spans
  failedTxs?: Set<number> // Indices of transactions that failed during execution
}

export interface Transaction {
  id: number
  color: string
  slot: number // Stable slot position in mempool grid
}

export interface Colors {
  bg: string
  text: string
  textMuted: string
  textFaint: string
  border: string
  borderStrong: string
  blockBg: string
  blockBgStrong: string
  blockSolid: string
  blockFaint: string
  stroke: string
}

export const MAX_TX = 16 // 4x4 grid = 16 transactions per block

// Vibrant transaction colors
export const TX_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
]

export function getRandomTxColor() {
  return TX_COLORS[Math.floor(Math.random() * TX_COLORS.length)]
}

// C-Chain spec: tau = 5s
export const SAE_CONFIG = {
  tau: 5000, // Duration between execution and settlement (ms) - C-Chain = 5s
  // Derived timings (can be overridden)
  get consensusInterval() {
    return 1500 // 1.5 second consensus rhythm
  },
  get executionTime() {
    return 5000 // 5 second execution time
  },
  get mempoolMinDelay() {
    return 120 // Calm minimum delay
  },
  get mempoolMaxDelay() {
    return 280 // Calm maximum delay
  },
  get mempoolBatchMin() {
    return 1 // 1 transaction per batch minimum
  },
  get mempoolBatchMax() {
    return 2 // Up to 2 transactions per batch
  },
  get queueCheckInterval() {
    return 100 // Short interval for queue check
  },
}

// Synchronous Execution Configuration - much slower, must wait for full settlement
export const SYNC_CONFIG = {
  proposeTime: 5500, // Time in proposed state (2.2s fill animation + consensus phase)
  acceptTime: 3000, // Time in accepted state (1.2s fill + checkmark visible)
  executeTime: 3500, // Time in executing state (this is the bottleneck!)
  settleDelay: 600, // Brief pause after settling before next block
  mempoolMinDelay: 150,
  mempoolMaxDelay: 350,
}

