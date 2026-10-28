import type { AllMetrics, FenceHistoricalData, FenceMetrics, HistoricalData, LineFacilityMetrics } from '@/lib/rwa/types';

/* The RWA view's feeds as the routes served them on 2026-10-01: the pool's
   figures in USDC base units, Fence's latest figures, and short histories. */

export const METRICS: AllMetrics = {
  general: {
    transactedVolume: 124_154_992_423_166n,
    assetsFinanced: 61_542_595_899_000n,
    lenderRepayments: 58_542_596_780_686n,
    idleCapital: 881_686n,
    committedCapital: 3_000_000_000_000n,
    capitalTurnover: 20.5141,
    lifeSinceInception: 359,
    avgCapitalRecycling: 17.5,
    averageCapitalUtilization: 89.41,
  },
  oatfi: { capitalOutstanding: 2_999_999_118_314n, principalRepayments: 58_542_596_780_686n, convertedUsdc: 62_075_897_412_054n },
  lenderBreakdown: [
    { lender: 'Valinor', address: '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f', amount: 1_666_667_000_000n, percentage: 55.55 },
    { lender: 'Avalanche', address: '0x7a75539cd0647625217ef93302855ddeb02f7093', amount: 1_333_333_000_000n, percentage: 44.44 },
  ],
  lastUpdated: '2026-10-01T17:13:02.292Z',
};

export const FENCE: FenceMetrics = {
  paidTotalCollections: { value: 58_837_806.6, asOfDate: '2026-10-01T17:02:02.887574' },
  expectedTotalCollections: { value: 57_867_071.17, asOfDate: '2026-10-01T17:00:32.523531' },
  cl01Concentration: { value: 0.1286, asOfDate: '2026-10-01T17:03:23.961847', withinLimit: true, threshold: 0.35 },
  repaymentRatio: 1.0168,
  lastUpdated: '2026-10-01T17:13:04.381Z',
};

export const HISTORY: HistoricalData = {
  transactedVolume: [{ date: '2026-09-28', value: 300_000 }, { date: '2026-09-30', value: 280_000 }],
  assetsFinanced: [{ date: '2026-09-28', value: 136_000 }],
  lenderRepayments: [{ date: '2026-09-30', value: 136_000 }],
  capitalUtilization: [{ date: '2026-09-28', value: 99.9 }],
  committedCapital: [{ date: '2026-02-11', value: 3_000_000 }],
  netCapitalPosition: [{ date: '2026-09-28', value: 2_999_000 }],
};

export const FENCE_HISTORY: FenceHistoricalData = {
  paidCollections: [{ date: '2026-09-29', value: 58_000_000 }, { date: '2026-09-30', value: 58_800_000 }],
  expectedCollections: [{ date: '2026-09-29', value: 57_500_000 }, { date: '2026-09-30', value: 57_900_000 }],
};

/* Rain's feeds as the routes serve them at block 98,617,516 (Task 2's reference values), and a short history */
export const RAIN_METRICS: LineFacilityMetrics = {
  general: {
    assetsFinanced: 17_224_206_832_469n,
    lenderRepayments: 17_028_947_463_693n,
    idleCapital: 46_466_510_311n,
    committedCapital: 250_000_000_000n,
    capitalTurnover: 68.8968,
    lifeSinceInception: 255,
    avgCapitalRecycling: 3.7012,
    averageCapitalUtilization: 28.68,
  },
  line: { capitalOutstanding: 203_533_489_689n, draws: 233 },
  lastUpdated: '2026-10-26T15:55:14.000Z',
};

export const RAIN_HISTORY: HistoricalData = {
  transactedVolume: [],
  assetsFinanced: [{ date: '2026-02-12', value: 52_713.705714 }, { date: '2026-10-26', value: 82_340.914286 }],
  lenderRepayments: [{ date: '2026-02-12', value: 50_556.54 }, { date: '2026-10-26', value: 97_072.208769 }],
  capitalUtilization: [{ date: '2026-02-12', value: 2.16 }, { date: '2026-10-26', value: 81.41 }],
  committedCapital: [{ date: '2026-02-12', value: 100_000 }, { date: '2026-09-03', value: 250_000 }],
  netCapitalPosition: [{ date: '2026-02-12', value: 2_159.802888 }, { date: '2026-10-26', value: 203_533.489689 }],
};
