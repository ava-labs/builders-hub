import { afterEach, describe, expect, it, vi } from 'vitest'

import { pinSvgPaint } from '@/lib/rwa/export/capture'

/* A stand-in for an SVG shape: its style attribute, an inline style, and
   the paint the page computes for it (the repo's tests run without a DOM). */
function shape(style: string | null, computed: { fill: string; stroke: string }) {
  const attrs = new Map<string, string>(style === null ? [] : [['style', style]])
  return {
    computed,
    style: {} as Record<string, string>,
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pinning the paint of a capture', () => {
  it("writes each shape's computed fill and stroke inline, so a color read from a CSS variable survives the copy", () => {
    const bar = shape(null, { fill: 'rgb(42, 120, 214)', stroke: 'none' })
    const tick = shape('font-size: 10px', { fill: 'rgb(113, 113, 122)', stroke: 'none' })
    vi.stubGlobal('getComputedStyle', (el: ReturnType<typeof shape>) => el.computed)
    const root = { querySelectorAll: () => [bar, tick] }

    pinSvgPaint(root as unknown as HTMLElement)

    expect(bar.style).toEqual({ fill: 'rgb(42, 120, 214)', stroke: 'none' })
    expect(tick.style).toEqual({ fill: 'rgb(113, 113, 122)', stroke: 'none' })
  })

  it('puts each style attribute back as it was', () => {
    const bar = shape(null, { fill: 'rgb(42, 120, 214)', stroke: 'none' })
    const tick = shape('font-size: 10px', { fill: 'rgb(113, 113, 122)', stroke: 'none' })
    vi.stubGlobal('getComputedStyle', (el: ReturnType<typeof shape>) => el.computed)
    const root = { querySelectorAll: () => [bar, tick] }

    const unpin = pinSvgPaint(root as unknown as HTMLElement)
    unpin()

    expect(bar.getAttribute('style')).toBeNull()
    expect(tick.getAttribute('style')).toBe('font-size: 10px')
  })
})
