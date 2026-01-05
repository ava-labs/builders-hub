// Firewood theme - warm wood tones and forest greens
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
  // Firewood-specific
  wood: string
  woodLight: string
  accent: string
}

// Node types for trie visualization
export interface TrieNode {
  id: string
  type: 'branch' | 'leaf' | 'extension'
  children?: string[]
  value?: string
  depth: number
}

// LSM Level for compaction visualization
export interface LSMLevel {
  id: number
  files: LSMFile[]
  isCompacting?: boolean
}

export interface LSMFile {
  id: string
  size: number
  age: number
  color: string
}

// Firewood block for visualization
export interface FirewoodBlock {
  id: number
  address: number
  type: 'branch' | 'leaf'
  children?: number[]
}

// ============================================================================
// FIREWOOD THEME PALETTE
// ============================================================================

export const FIREWOOD_PALETTE = {
  // Primary wood tones
  oak: '#b08968',
  walnut: '#7c5c4a',
  maple: '#d4a574',
  cedar: '#a0522d',
  pine: '#c9b896',
  bark: '#5c4332',

  // Forest greens
  moss: '#4a7c59',
  fern: '#3d6b4f',
  sage: '#87ae73',
  forest: '#2d5a3d',

  // Fire/ember accents
  ember: '#e85d04',
  flame: '#f48c06',
  ash: '#9d8b7a',
  coal: '#3d3027',

  // Neutral tones
  charcoal: '#2d2419',
  parchment: '#f5efe6',
  cream: '#faf7f2',
  smoke: '#a39687',
}

// Node colors for trie visualizations
export const NODE_COLORS = {
  root: FIREWOOD_PALETTE.ember,
  branch: FIREWOOD_PALETTE.oak,
  leaf: FIREWOOD_PALETTE.moss,
  extension: FIREWOOD_PALETTE.maple,
}

// LSM file colors (warm gradient)
export const LSM_COLORS = [
  FIREWOOD_PALETTE.ember,
  FIREWOOD_PALETTE.flame,
  FIREWOOD_PALETTE.maple,
  FIREWOOD_PALETTE.oak,
  FIREWOOD_PALETTE.walnut,
  FIREWOOD_PALETTE.bark,
]

export const FIREWOOD_CONFIG = {
  // Animation timings
  compactionInterval: 3000,
  writeInterval: 800,
  trieUpdateInterval: 1500,

  // Visualization settings
  maxLSMLevels: 5,
  maxFilesPerLevel: 6,
  maxTrieDepth: 4,
}
