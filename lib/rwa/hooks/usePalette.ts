'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { RWAPalette } from '@/lib/rwa/constants/palettes'
import { PALETTE_PRESETS } from '@/lib/rwa/constants/palettes'
import type { TrendPeriod } from '@/lib/rwa/types'

const STORAGE_KEY = 'rwa-palette'
const TREND_PERIOD_KEY = 'rwa-trend-period'

function findPalette(name: string): RWAPalette {
  return PALETTE_PRESETS.find((p) => p.name === name) ?? PALETTE_PRESETS[0]
}

function buildChartColors(palette: RWAPalette) {
  return {
    transactedVolume: palette.shades[700],
    committedCapital: palette.shades[600],
    assetsFinanced: palette.shades[700],
    lenderRepayments: palette.shades[400],
    capitalUtilization: palette.shades[400],
    netCapitalPosition: palette.shades[900],
    lenderValinor: palette.shades[700],
    lenderAvalanche: palette.shades[400],
  }
}

interface PaletteContextValue {
  palette: RWAPalette
  chartColors: ReturnType<typeof buildChartColors>
  setPalette: (name: string) => void
  trendPeriod: TrendPeriod
  setTrendPeriod: (period: TrendPeriod) => void
}

export const PaletteContext = createContext<PaletteContextValue | null>(null)

function isValidTrendPeriod(v: string | null): v is TrendPeriod {
  return v === '7d' || v === '30d' || v === '90d'
}

export function usePaletteProvider() {
  const [palette, setPaletteState] = useState<RWAPalette>(PALETTE_PRESETS[0])
  const [trendPeriod, setTrendPeriodState] = useState<TrendPeriod>('30d')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setPaletteState(findPalette(stored))
    }
    const storedPeriod = localStorage.getItem(TREND_PERIOD_KEY)
    if (isValidTrendPeriod(storedPeriod)) {
      setTrendPeriodState(storedPeriod)
    }
  }, [])

  const setPalette = useCallback((name: string) => {
    const next = findPalette(name)
    setPaletteState(next)
    localStorage.setItem(STORAGE_KEY, name)
  }, [])

  const setTrendPeriod = useCallback((period: TrendPeriod) => {
    setTrendPeriodState(period)
    localStorage.setItem(TREND_PERIOD_KEY, period)
  }, [])

  const chartColors = useMemo(() => buildChartColors(palette), [palette])

  const cssVars = useMemo(
    () =>
      ({
        '--rwa-accent-900': palette.shades[900],
        '--rwa-accent-700': palette.shades[700],
        '--rwa-accent-600': palette.shades[600],
        '--rwa-accent-500': palette.shades[500],
        '--rwa-accent-400': palette.shades[400],
        '--rwa-accent-300': palette.shades[300],
      }) as React.CSSProperties,
    [palette]
  )

  return { palette, chartColors, setPalette, cssVars, trendPeriod, setTrendPeriod }
}

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext)
  if (!ctx) {
    throw new Error('usePalette must be used within a PaletteProvider')
  }
  return ctx
}
