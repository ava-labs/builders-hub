import { describe, expect, it } from 'vitest'

import { RANGE_DAYS } from '@/components/explorer-v2/time-range'
import {
  FENCE_WINDOW_DAYS,
  collectionDays,
  dayWindow,
  eachDay,
  fenceBounds,
  fillFlow,
  fillLevel,
  firstDay,
  isFenceWindow,
  poolHistory,
} from '@/lib/rwa/series'
import type { HistoricalData } from '@/lib/rwa/types'

const TODAY = '2026-10-01'
const W = { from: '2026-09-29', to: '2026-10-01' }
const NO_HISTORY: HistoricalData = {
  transactedVolume: [],
  assetsFinanced: [],
  lenderRepayments: [],
  capitalUtilization: [],
  committedCapital: [],
  netCapitalPosition: [],
}

describe('the windows the view asks Fence for', () => {
  it('cover every page clock range but All, so the route never refuses the view', () => {
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

describe('the pool history over the clock', () => {
  it('zero-fills each flow from its first reading to today', () => {
    const history = poolHistory(
      {
        ...NO_HISTORY,
        transactedVolume: [{ date: '2026-09-27', value: 9 }],
        assetsFinanced: [{ date: '2026-09-28', value: 5 }],
        lenderRepayments: [{ date: '2026-09-30', value: 4 }],
      },
      30,
      TODAY,
    )
    expect(history.financed.map((p) => p.date)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'])
    expect(history.financed.map((p) => p.value)).toEqual([0, 5, 0, 0, 0])
    expect(history.repaid.map((p) => p.value)).toEqual([0, 0, 0, 4, 0])
    expect(history.volume.map((p) => p.value)).toEqual([9, 0, 0, 0, 0])
  })
})

describe('the collections over the clock', () => {
  it('carry each running total forward and read nothing before a series starts', () => {
    const days = collectionDays([{ date: '2026-09-29', value: 10 }, { date: '2026-10-01', value: 12 }], [{ date: '2026-09-30', value: 11 }], 30, TODAY)
    expect(days).toEqual([
      { date: '2026-09-29', paid: 10, expected: null },
      { date: '2026-09-30', paid: 10, expected: 11 },
      { date: '2026-10-01', paid: 12, expected: 11 },
    ])
  })

  it('are empty without a reading', () => {
    expect(collectionDays([], [], 30, TODAY)).toEqual([])
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

describe('a flow over the window', () => {
  it('is zero on days nothing moved, sums a repeated day and drops days outside', () => {
    const points = [
      { date: '2026-09-30', value: 5 },
      { date: '2026-09-30T12:00:00.000Z', value: 2 },
      { date: '2026-09-01', value: 99 },
    ]
    expect(fillFlow(points, W)).toEqual([
      { date: '2026-09-29', value: 0 },
      { date: '2026-09-30', value: 7 },
      { date: '2026-10-01', value: 0 },
    ])
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
