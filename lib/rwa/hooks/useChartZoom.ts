'use client'

import { useState, useCallback, useMemo } from 'react'
import type { TimeSeriesDataPoint } from '../types'

interface ZoomState {
  left: string | null
  right: string | null
  refAreaLeft: string | null
  refAreaRight: string | null
}

type ChartMouseEvent = {
  activeLabel?: string | number | undefined
}

interface UseChartZoomResult {
  zoomState: ZoomState
  zoomedData: TimeSeriesDataPoint[]
  isZoomed: boolean
  handleMouseDown: (e: ChartMouseEvent) => void
  handleMouseMove: (e: ChartMouseEvent) => void
  handleMouseUp: () => void
  resetZoom: () => void
}

const initialZoomState: ZoomState = {
  left: null,
  right: null,
  refAreaLeft: null,
  refAreaRight: null,
}

export function useChartZoom(data: TimeSeriesDataPoint[]): UseChartZoomResult {
  const [zoomState, setZoomState] = useState<ZoomState>(initialZoomState)

  const isZoomed = zoomState.left !== null && zoomState.right !== null

  const handleMouseDown = useCallback((e: ChartMouseEvent) => {
    const label = e.activeLabel
    if (label !== undefined && label !== null) {
      setZoomState((prev) => ({
        ...prev,
        refAreaLeft: String(label),
        refAreaRight: null,
      }))
    }
  }, [])

  const handleMouseMove = useCallback((e: ChartMouseEvent) => {
    const label = e.activeLabel
    setZoomState((prev) => {
      if (prev.refAreaLeft && label !== undefined && label !== null) {
        return { ...prev, refAreaRight: String(label) }
      }
      return prev
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    setZoomState((prev) => {
      const { refAreaLeft, refAreaRight } = prev

      if (refAreaLeft && refAreaRight) {
        const left = refAreaLeft < refAreaRight ? refAreaLeft : refAreaRight
        const right = refAreaLeft < refAreaRight ? refAreaRight : refAreaLeft

        return { left, right, refAreaLeft: null, refAreaRight: null }
      }

      return { ...prev, refAreaLeft: null, refAreaRight: null }
    })
  }, [])

  const resetZoom = useCallback(() => {
    setZoomState(initialZoomState)
  }, [])

  const zoomedData = useMemo(() => {
    if (!isZoomed || !data.length) return data

    const leftIndex = data.findIndex((d) => d.date === zoomState.left)
    const rightIndex = data.findIndex((d) => d.date === zoomState.right)

    if (leftIndex === -1 || rightIndex === -1) return data

    return data.slice(leftIndex, rightIndex + 1)
  }, [data, isZoomed, zoomState.left, zoomState.right])

  return {
    zoomState,
    zoomedData,
    isZoomed,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom,
  }
}
