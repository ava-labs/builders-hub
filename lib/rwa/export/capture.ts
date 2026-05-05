import { toPng, toJpeg } from 'html-to-image'

const exportFilter = (node: HTMLElement): boolean => {
  if (node.tagName === 'BUTTON') return false
  if (node.classList?.contains('recharts-brush')) return false
  if (node.hasAttribute?.('data-export-hidden')) return false
  return true
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

  try {
    return format === 'jpeg'
      ? await toJpeg(element, { ...imageOptions, quality })
      : await toPng(element, imageOptions)
  } finally {
    if (wasDark) {
      html.classList.add('dark')
    }
  }
}
