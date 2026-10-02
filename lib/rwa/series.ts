import type { DatePreset, HistoricalData, TimeInterval, TimeSeriesDataPoint } from './types'

/* The RWA view's charts read whole UTC days over the reader's range,
   by day, week or month. The feeds send only the days something
   happened, so a flow is zero-filled across the window and a level
   carries its last reading forward; a curve never bridges a gap with
   values that never existed. */

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

/** the spans the Fence history route serves besides the whole history: the page clock's windows, never under a week */
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

/** the bucket a day falls in: the day itself, its ISO week's Monday, or its month's first day */
export function bucketOf(day: string, interval: TimeInterval): string {
  const d = day.slice(0, 10)
  if (interval === 'daily') return d
  if (interval === 'monthly') return `${d.slice(0, 7)}-01`
  const ms = msOfDay(d)
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7
  return dayOf(ms - sinceMonday * DAY_MS)
}

/** the window's buckets, oldest first */
function bucketsOf(w: DayWindow, interval: TimeInterval): string[] {
  return [...new Set(eachDay(w).map((day) => bucketOf(day, interval)))]
}

/** a flow over the window by bucket: each bucket's sum, zero where nothing moved */
export function rollFlow(points: TimeSeriesDataPoint[], w: DayWindow, interval: TimeInterval): TimeSeriesDataPoint[] {
  const sums = new Map<string, number>()
  for (const p of points) {
    const day = p.date.slice(0, 10)
    if (day < w.from || day > w.to) continue
    const bucket = bucketOf(day, interval)
    sums.set(bucket, (sums.get(bucket) ?? 0) + p.value)
  }
  return bucketsOf(w, interval).map((date) => ({ date, value: sums.get(date) ?? 0 }))
}

/** a level over the window by bucket: each bucket's last reading, carried in from before the window */
export function rollLevel(points: TimeSeriesDataPoint[], w: DayWindow, interval: TimeInterval): TimeSeriesDataPoint[] {
  const lastOf = new Map<string, number>()
  for (const d of fillLevel(points, w)) lastOf.set(bucketOf(d.date, interval), d.value)
  return [...lastOf.entries()].map(([date, value]) => ({ date, value }))
}

/** each bucket's increase of a running total: the periodic view; the first bucket has no earlier reading, so it is left out */
export function toDeltas(points: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
  return points.slice(1).map((p, i) => ({ date: p.date, value: Math.max(0, p.value - points[i].value) }))
}

/** a range the reader picks: a preset, or a custom span of days */
export type RangeChoice = { preset: DatePreset } | { from: string; to: string }

const PRESET_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 }

/** the days a range choice covers: never after today, never before the first reading (a custom range
 *  wholly outside them has no days), so a level is never carried into a day nothing was read */
export function windowFor(choice: RangeChoice, today: string, first: string | null): DayWindow {
  if ('from' in choice) {
    const from = choice.from.slice(0, 10)
    const to = choice.to.slice(0, 10)
    return { from: first && first.slice(0, 10) > from ? first.slice(0, 10) : from, to: to > today.slice(0, 10) ? today.slice(0, 10) : to }
  }
  const to = today.slice(0, 10)
  if (choice.preset === 'all') return { from: first ?? to, to }
  if (choice.preset === 'ytd') {
    const jan1 = `${to.slice(0, 4)}-01-01`
    return { from: first && first > jan1 ? first : jan1, to }
  }
  return dayWindow(PRESET_DAYS[choice.preset], to, first)
}

/** the pool's series for the history charts, rolled over the window by bucket: flows as sums, levels as last readings */
export function poolSeries(h: HistoricalData, w: DayWindow, interval: TimeInterval) {
  return {
    volume: rollFlow(h.transactedVolume, w, interval),
    financed: rollFlow(h.assetsFinanced, w, interval),
    repaid: rollFlow(h.lenderRepayments, w, interval),
    utilization: rollLevel(h.capitalUtilization, w, interval),
    invested: rollLevel(h.committedCapital, w, interval),
    outstanding: rollLevel(h.netCapitalPosition, w, interval),
  }
}

/** a reading that may not exist yet */
export interface MaybePoint {
  date: string
  value: number | null
}

/** one of Fence's running totals over the window by bucket: the cumulative reading is the bucket's last level, the
 *  periodic one its increase on the bucket before (taken over the whole series, so the window's first bucket has
 *  one); before the series starts, and for its first bucket's increase, there is no reading */
export function fenceSeries(points: TimeSeriesDataPoint[], w: DayWindow, interval: TimeInterval): { cumulative: MaybePoint[]; periodic: MaybePoint[] } {
  const levels = rollLevel(points, w, interval)
  const start = firstDay(points)
  if (!start) {
    const none = levels.map((b) => ({ date: b.date, value: null }))
    return { cumulative: none, periodic: none }
  }
  const firstBucket = bucketOf(start, interval)
  const whole = rollLevel(points, { from: start < w.from ? start : w.from, to: w.to }, interval)
  const increase = new Map(toDeltas(whole).map((d) => [d.date, d.value]))
  return {
    cumulative: levels.map((b) => ({ date: b.date, value: b.date < firstBucket ? null : b.value })),
    periodic: levels.map((b) => ({ date: b.date, value: b.date <= firstBucket ? null : increase.get(b.date) ?? null })),
  }
}
