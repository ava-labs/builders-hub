'use client'

import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 800): number {
  const [current, setCurrent] = useState(target)
  const prevTarget = useRef(target)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(target)
      prevTarget.current = target
      return
    }

    const start = prevTarget.current
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()

    function animate(time: number) {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(start + diff * eased)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        prevTarget.current = target
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration])

  return current
}
