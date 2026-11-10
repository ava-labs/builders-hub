import { describe, expect, it } from 'vitest'

import { RANGE_DAYS } from '@/components/explorer-v2/time-range'
import {
  FENCE_WINDOW_DAYS,
  bucketOf,
  dayWindow,
  eachDay,
  fenceBounds,
  fenceSeries,
  fillLevel,
  firstDay,
  isFenceWindow,
  poolSeries,
  rollFlow,
  rollLevel,
  toDeltas,
  windowFor,
} from '@/lib/rwa/series'

const TODAY = '2026-10-01'
const W = { from: '2026-09-29', to: '2026-10-01' }

describe('the windows the Fence history route serves', () => {
  it('cover every page clock range but All', () => {
    for (const [range, days] of Object.entries(RANGE_DAYS)) {
      if (range === 'all') continue
      expect(FENCE_WINDOW_DAYS).toContain(Math.max(7, days))
    }
  })

  it('are whole UTC days the route accepts until the day after', () => {
    const { startDate, endDate } = fenceBounds(dayWindow(30, TODAY, null))
    expect([startDate, endDate]).toEqual(['2026-09-02T00:00:00.000Z', '2026-10-01T23:59:59.999Z'])
    expect(isFenceWindow(startDate, endDate, TODAY)).toBe(true)
    // asked just before midnight, read just after
    expect(isFenceWindow(startDate, endDate, '2026-10-02')).toBe(true)
    expect(isFenceWindow(startDate, endDate, '2026-10-03')).toBe(false)
  })
})

describe('the day window', () => {
  it('ends today and spans the clock in whole days', () => {
    expect(dayWindow(30, TODAY, null)).toEqual({ from: '2026-09-02', to: TODAY })
  })

  it('never spans less than a week', () => {
    expect(dayWindow(1, TODAY, null)).toEqual({ from: '2026-09-25', to: TODAY })
  })

  it('starts at the first reading when that comes after the clock would', () => {
    expect(dayWindow(30, TODAY, '2026-09-20')).toEqual({ from: '2026-09-20', to: TODAY })
    expect(dayWindow(3650, TODAY, '2026-02-10T08:00:00.000Z')).toEqual({ from: '2026-02-10', to: TODAY })
  })

  it('keeps the clock start when the first reading is older', () => {
    expect(dayWindow(30, TODAY, '2026-01-01')).toEqual({ from: '2026-09-02', to: TODAY })
  })
})

describe('the days of a window', () => {
  it('lists every day oldest first, both ends included, across a month', () => {
    expect(eachDay(W)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01'])
  })

  it('is empty when the window runs backwards', () => {
    expect(eachDay({ from: '2026-10-02', to: TODAY })).toEqual([])
  })
})

describe('a level over the window', () => {
  it('carries the last reading before the window into its first day and steps on change days', () => {
    const points = [
      { date: '2026-09-30', value: 150 },
      { date: '2026-09-20', value: 100 },
    ]
    expect(fillLevel(points, W)).toEqual([
      { date: '2026-09-29', value: 100 },
      { date: '2026-09-30', value: 150 },
      { date: '2026-10-01', value: 150 },
    ])
  })

  it('reads zero before any reading', () => {
    expect(fillLevel([{ date: '2026-09-30', value: 150 }], W)[0]).toEqual({ date: '2026-09-29', value: 0 })
  })
})

describe('the first day of the series', () => {
  it('is the earliest day any series reads', () => {
    expect(firstDay([{ date: '2026-03-05', value: 1 }], [{ date: '2026-04-01', value: 1 }, { date: '2026-02-10T00:00:00.000Z', value: 1 }])).toBe('2026-02-10')
  })

  it('is null when every series is empty', () => {
    expect(firstDay([], [])).toBeNull()
  })
})

describe('the buckets of an interval', () => {
  it('are the day itself, its ISO week from Monday, or its month', () => {
    expect(bucketOf('2026-10-01', 'daily')).toBe('2026-10-01')
    // a Thursday and the Sunday that closes its week both fall in the week of Monday the 28th
    expect(bucketOf('2026-10-01', 'weekly')).toBe('2026-09-28')
    expect(bucketOf('2026-10-04', 'weekly')).toBe('2026-09-28')
    expect(bucketOf('2026-09-28', 'weekly')).toBe('2026-09-28')
    expect(bucketOf('2026-09-17T12:00:00.000Z', 'monthly')).toBe('2026-09-01')
  })
})

describe('a flow rolled up', () => {
  it('sums each bucket, zero where nothing moved, inside the window only', () => {
    const points = [
      { date: '2026-09-20', value: 99 },
      { date: '2026-09-28', value: 5 },
      { date: '2026-10-01', value: 2 },
      { date: '2026-10-13', value: 3 },
    ]
    expect(rollFlow(points, { from: '2026-09-28', to: '2026-10-14' }, 'weekly')).toEqual([
      { date: '2026-09-28', value: 7 },
      { date: '2026-10-05', value: 0 },
      { date: '2026-10-12', value: 3 },
    ])
  })
})

describe('a level rolled up', () => {
  it("reads each bucket's last level, carried in from before the window", () => {
    const points = [
      { date: '2026-07-10', value: 100 },
      { date: '2026-09-05', value: 150 },
      { date: '2026-09-20', value: 160 },
    ]
    expect(rollLevel(points, { from: '2026-08-15', to: '2026-10-02' }, 'monthly')).toEqual([
      { date: '2026-08-01', value: 100 },
      { date: '2026-09-01', value: 160 },
      { date: '2026-10-01', value: 160 },
    ])
  })
})

describe('the periodic view of a running total', () => {
  it("turn a running total into each bucket's increase, from the second bucket on, never below zero", () => {
    const running = [
      { date: '2026-09-28', value: 10 },
      { date: '2026-10-05', value: 15 },
      { date: '2026-10-12', value: 14 },
      { date: '2026-10-19', value: 22 },
    ]
    expect(toDeltas(running)).toEqual([
      { date: '2026-10-05', value: 5 },
      { date: '2026-10-12', value: 0 },
      { date: '2026-10-19', value: 8 },
    ])
  })
})

describe('the window of a range choice', () => {
  it('reads a preset as whole days ending today, never before the first reading', () => {
    expect(windowFor({ preset: '30d' }, TODAY, '2025-10-06')).toEqual({ from: '2026-09-02', to: TODAY })
    expect(windowFor({ preset: '7d' }, TODAY, '2025-10-06')).toEqual({ from: '2026-09-25', to: TODAY })
    expect(windowFor({ preset: '90d' }, TODAY, '2026-08-01')).toEqual({ from: '2026-08-01', to: TODAY })
  })

  it('reads year to date from January 1 and all time from the first reading', () => {
    expect(windowFor({ preset: 'ytd' }, TODAY, '2025-10-06')).toEqual({ from: '2026-01-01', to: TODAY })
    expect(windowFor({ preset: 'all' }, TODAY, '2025-10-06')).toEqual({ from: '2025-10-06', to: TODAY })
    expect(windowFor({ preset: 'all' }, TODAY, null)).toEqual({ from: TODAY, to: TODAY })
  })

  it('reads a custom range as its own days', () => {
    expect(windowFor({ from: '2026-03-01', to: '2026-03-31' }, TODAY, '2025-10-06')).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  })

  it('cuts a custom range to the days with readings: never after today, never before the first reading', () => {
    expect(windowFor({ from: '2026-09-28', to: '2026-10-06' }, TODAY, '2025-10-06')).toEqual({ from: '2026-09-28', to: TODAY })
    expect(windowFor({ from: '2025-09-01', to: '2025-10-10' }, TODAY, '2025-10-06')).toEqual({ from: '2025-10-06', to: '2025-10-10' })
    // a range that ends before the first reading has no days at all
    expect(eachDay(windowFor({ from: '2025-01-01', to: '2025-01-05' }, TODAY, '2025-10-06'))).toEqual([])
  })
})

describe('the pool series of the history charts', () => {
  it('roll the flows into sums and the levels into last readings, bucket by bucket', () => {
    const history = poolSeries(
      {
        transactedVolume: [{ date: '2026-09-29', value: 4 }, { date: '2026-10-01', value: 6 }],
        assetsFinanced: [{ date: '2026-09-29', value: 3 }],
        lenderRepayments: [{ date: '2026-10-01', value: 2 }],
        capitalUtilization: [{ date: '2026-09-20', value: 80 }, { date: '2026-09-30', value: 100 }],
        committedCapital: [{ date: '2026-02-11', value: 3_000_000 }],
        netCapitalPosition: [{ date: '2026-09-29', value: 2_900_000 }, { date: '2026-10-01', value: 2_999_999 }],
      },
      { from: '2026-09-28', to: '2026-10-04' },
      'weekly',
    )
    expect(history).toEqual({
      volume: [{ date: '2026-09-28', value: 10 }],
      financed: [{ date: '2026-09-28', value: 3 }],
      repaid: [{ date: '2026-09-28', value: 2 }],
      utilization: [{ date: '2026-09-28', value: 100 }],
      invested: [{ date: '2026-09-28', value: 3_000_000 }],
      outstanding: [{ date: '2026-09-28', value: 2_999_999 }],
    })
  })
})

describe('a Fence running total over the window', () => {
  const paid = [
    { date: '2026-09-29', value: 10 },
    { date: '2026-09-30', value: 12 },
    { date: '2026-10-01', value: 15 },
  ]

  it("reads each bucket's level, and nothing before the series starts", () => {
    expect(fenceSeries(paid, { from: '2026-09-28', to: '2026-10-01' }, 'daily').cumulative).toEqual([
      { date: '2026-09-28', value: null },
      { date: '2026-09-29', value: 10 },
      { date: '2026-09-30', value: 12 },
      { date: '2026-10-01', value: 15 },
    ])
  })

  it("reads each bucket's increase, taking the bucket before the window into account", () => {
    expect(fenceSeries(paid, { from: '2026-09-30', to: '2026-10-01' }, 'daily').periodic).toEqual([
      { date: '2026-09-30', value: 2 },
      { date: '2026-10-01', value: 3 },
    ])
    // the first reading has no earlier one to rise from
    expect(fenceSeries(paid, { from: '2026-09-29', to: '2026-09-30' }, 'daily').periodic).toEqual([
      { date: '2026-09-29', value: null },
      { date: '2026-09-30', value: 2 },
    ])
  })
})
