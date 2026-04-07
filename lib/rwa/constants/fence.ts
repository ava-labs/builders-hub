// Fence Finance API configuration
// All metric IDs and deal IDs are from the OatFi-Valinor-Fence integration docs

export const FENCE_METRIC_IDS = {
  paidTotalCollections: 'efa4eff8-c9af-4bf5-a934-1dc20b28465e',
  expectedTotalCollections: '7b25ee61-48d5-497d-a492-17dc149203dd',
  cl01Concentration: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c51',
} as const

export const FENCE_DEAL_ID = '04c17177-60bd-4615-aefa-e959ba1fbe25'

export const FENCE_CACHE_TTL = 30 * 60 * 1000
export const FENCE_STALE_TTL = 60 * 60 * 1000

export const CL01_THRESHOLD = 0.35

export const FENCE_REQUEST_TIMEOUT_MS = 10_000
export const FENCE_AUTH_TIMEOUT_MS = 5_000
