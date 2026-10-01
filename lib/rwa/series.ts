import type { HistoricalData, TimeSeriesDataPoint } from './types'

/* The RWA view's charts read whole UTC days over the page clock's
   window. The feeds send only the days something happened, so a flow is
   zero-filled across the window and a level carries its last reading
   forward; a curve never bridges a gap with values that never existed. */

export interface DayWindow {
  /** first day, YYYY-MM-DD, inclusive */
  from: string
  /** last day, YYYY-MM-DD, inclusive */
  to: string
}

const DAY_MS = 86_400_000
/** ten years of days, the longest window the clock offers */
const MAX_DAYS = 3660

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const msOfDay = (day: string) => Date.parse(`${day.slice(0, 10)}T00:00:00Z`)

/** the clock's window as whole days ending on `today`: never under a week, never before the first reading */
export function dayWindow(days: number, today: string, first: string | null): DayWindow {
  const span = Math.max(7, Math.min(days, MAX_DAYS))
  const from = dayOf(msOfDay(today) - (span - 1) * DAY_MS)
  const start = first && first.slice(0, 10) > from ? first.slice(0, 10) : from
  return { from: start, to: today.slice(0, 10) }
}

/** the spans the view asks Fence for: the page clock's windows, never under a week (All asks for no window) */
export const FENCE_WINDOW_DAYS = [7, 30, 90, 365] as const

/** the bounds the view sends for a window: its first day from midnight to its last day's final millisecond, UTC */
export function fenceBounds(w: DayWindow): { startDate: string; endDate: string } {
  return { startDate: `${w.from}T00:00:00.000Z`, endDate: `${w.to}T23:59:59.999Z` }
}

/** true for bounds the view sends: whole UTC days, a span it offers, ending today or yesterday (an ask across midnight) */
export function isFenceWindow(startDate: string, endDate: string, today: string): boolean {
  const from = startDate.slice(0, 10)
  const to = endDate.slice(0, 10)
  const exact = fenceBounds({ from, to })
  if (startDate !== exact.startDate || endDate !== exact.endDate) return false
  if (to !== today.slice(0, 10) && to !== dayOf(msOfDay(today) - DAY_MS)) return false
  const span = Math.round((msOfDay(to) - msOfDay(from)) / DAY_MS) + 1
  return (FENCE_WINDOW_DAYS as readonly number[]).includes(span)
}

/** every day in the window, oldest first */
export function eachDay({ from, to }: DayWindow): string[] {
  const start = msOfDay(from)
  const end = msOfDay(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return []
  const days: string[] = []
  for (let t = start; t <= end && days.length < MAX_DAYS; t += DAY_MS) days.push(dayOf(t))
  return days
}

/** a flow over the window: each day's amount, zero where nothing moved */
export function fillFlow(points: TimeSeriesDataPoint[], w: DayWindow): TimeSeriesDataPoint[] {
  const byDay = new Map<string, number>()
  for (const p of points) {
    const day = p.date.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + p.value)
  }
  return eachDay(w).map((date) => ({ date, value: byDay.get(date) ?? 0 }))
}

/** a level over the window: each day carries the last reading on or before it, zero before the first */
export function fillLevel(points: TimeSeriesDataPoint[], w: DayWindow): TimeSeriesDataPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  let next = 0
  let level = 0
  return eachDay(w).map((date) => {
    while (next < sorted.length && sorted[next].date.slice(0, 10) <= date) {
      level = sorted[next].value
      next += 1
    }
    return { date, value: level }
  })
}

/** the earliest day any series reads, or null when every series is empty */
export function firstDay(...series: TimeSeriesDataPoint[][]): string | null {
  let first: string | null = null
  for (const points of series) {
    for (const p of points) {
      const day = p.date.slice(0, 10)
      if (first === null || day < first) first = day
    }
  }
  return first
}

/** the pool's flows over the clock's window, each zero-filled from the first reading to today */
export function poolHistory(h: HistoricalData, days: number, today: string) {
  const w = dayWindow(days, today, firstDay(h.transactedVolume, h.assetsFinanced, h.lenderRepayments))
  return {
    financed: fillFlow(h.assetsFinanced, w),
    repaid: fillFlow(h.lenderRepayments, w),
    volume: fillFlow(h.transactedVolume, w),
  }
}

/** one day of Fence's two running totals; null before a series' first reading */
export interface CollectionDay {
  date: string
  paid: number | null
  expected: number | null
}

/** Fence's running totals over the clock's window, each carried forward, nothing before a series starts */
export function collectionDays(paid: TimeSeriesDataPoint[], expected: TimeSeriesDataPoint[], days: number, today: string): CollectionDay[] {
  const first = firstDay(paid, expected)
  if (!first) return []
  const w = dayWindow(days, today, first)
  const paidFrom = firstDay(paid)
  const expectedFrom = firstDay(expected)
  const expectedDays = fillLevel(expected, w)
  return fillLevel(paid, w).map((d, i) => ({
    date: d.date,
    paid: paidFrom && d.date >= paidFrom ? d.value : null,
    expected: expectedFrom && d.date >= expectedFrom ? expectedDays[i].value : null,
  }))
}
