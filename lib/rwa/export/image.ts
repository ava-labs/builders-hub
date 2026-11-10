'use client'

import { captureInLightMode } from './capture'

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

  const dataUrl = await captureInLightMode(element, {
    pixelRatio: scale,
    quality,
    format,
  })

  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${filename}.${format}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
