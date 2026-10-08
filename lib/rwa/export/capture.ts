import { toPng, toJpeg } from 'html-to-image'

const exportFilter = (node: HTMLElement): boolean => {
  if (node.tagName === 'BUTTON') return false
  if (node.classList?.contains('recharts-brush')) return false
  if (node.hasAttribute?.('data-export-hidden')) return false
  return true
}

/** writes each SVG shape's computed fill and stroke inline: html-to-image copies an SVG as it is, so paint
 *  read from a CSS variable or currentColor would lose its color in the copy. Returns the undo */
export function pinSvgPaint(root: HTMLElement): () => void {
  const pinned = Array.from(root.querySelectorAll<SVGElement>('svg *'), (el) => {
    const before = el.getAttribute('style')
    const { fill, stroke } = getComputedStyle(el)
    el.style.fill = fill
    el.style.stroke = stroke
    return [el, before] as const
  })
  return () => {
    for (const [el, before] of pinned) {
      if (before === null) el.removeAttribute('style')
      else el.setAttribute('style', before)
    }
  }
}

interface CaptureOptions {
  pixelRatio?: number
  quality?: number
  format?: 'png' | 'jpeg'
}

export async function captureInLightMode(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<string> {
  const { pixelRatio = 2, quality = 0.95, format = 'png' } = options
  const html = document.documentElement
  const wasDark = html.classList.contains('dark')
  // the theme swaps at once: a card that fades its background would be captured mid-fade
  const still = document.createElement('style')
  still.textContent = '*, *::before, *::after { transition: none !important; }'
  document.head.appendChild(still)

  if (wasDark) {
    html.classList.remove('dark')
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  }

  const imageOptions = {
    pixelRatio,
    backgroundColor: '#ffffff',
    filter: exportFilter,
  }

  const unpin = pinSvgPaint(element)
  try {
    return format === 'jpeg'
      ? await toJpeg(element, { ...imageOptions, quality })
      : await toPng(element, imageOptions)
  } finally {
    unpin()
    if (wasDark) {
      html.classList.add('dark')
    }
    still.remove()
  }
}
