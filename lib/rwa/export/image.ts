'use client'

import { toPng, toJpeg } from 'html-to-image'

export type ImageFormat = 'png' | 'jpeg'

interface ImageExportOptions {
  filename?: string
  format?: ImageFormat
  quality?: number
  scale?: number
}

export async function exportDashboardToImage(
  elementId: string,
  options: ImageExportOptions = {}
): Promise<void> {
  const {
    filename = 'rwa-dashboard',
    format = 'png',
    quality = 0.95,
    scale = 2,
  } = options

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`)
  }

  const imageOptions = {
    pixelRatio: scale,
    backgroundColor: '#ffffff',
    filter: (node: HTMLElement) => {
      if (node.tagName === 'BUTTON') return false
      if (node.classList?.contains('recharts-brush')) return false
      if (node.hasAttribute?.('data-export-hidden')) return false
      return true
    },
  }

  const dataUrl =
    format === 'jpeg'
      ? await toJpeg(element, { ...imageOptions, quality })
      : await toPng(element, imageOptions)

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${filename}.${format}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
