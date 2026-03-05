'use client'

import { captureInLightMode } from './capture'

interface PDFOptions {
  filename?: string
  title?: string
  scale?: number
}

export async function exportDashboardToPDF(
  elementId: string,
  options: PDFOptions = {}
): Promise<void> {
  const {
    filename = 'rwa-dashboard.pdf',
    title = 'RWA Dashboard Report',
    scale = 2,
  } = options

  const element = document.getElementById(elementId)
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`)
  }

  const dataUrl = await captureInLightMode(element, { pixelRatio: scale })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = dataUrl
  })

  const imgWidthPx = img.width
  const imgHeightPx = img.height

  const pxToMm = 25.4 / (96 * scale)
  const imgWidthMm = imgWidthPx * pxToMm
  const imgHeightMm = imgHeightPx * pxToMm

  const orientation = imgWidthMm > imgHeightMm ? 'landscape' : 'portrait'

  const { default: jsPDF } = await import('jspdf')

  const pdf = new jsPDF({
    orientation: orientation as 'portrait' | 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10

  const availableWidth = pageWidth - 2 * margin
  const availableHeight = pageHeight - 2 * margin - 5 // 5mm for footer
  const fitScale = Math.min(availableWidth / imgWidthMm, availableHeight / imgHeightMm)
  const scaledWidth = imgWidthMm * fitScale
  const scaledHeight = imgHeightMm * fitScale
  const xOffset = margin + (availableWidth - scaledWidth) / 2

  pdf.addImage(dataUrl, 'PNG', xOffset, margin, scaledWidth, scaledHeight)

  const timestamp = new Date().toLocaleString()
  pdf.setFontSize(6)
  pdf.setTextColor(115, 115, 115)
  pdf.text(`${title} - Generated: ${timestamp}`, margin, pageHeight - 3)

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  pdf.save(finalFilename)
}
