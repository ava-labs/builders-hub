'use client'

import { toPng } from 'html-to-image'

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

  const dataUrl = await toPng(element, {
    pixelRatio: scale,
    backgroundColor: '#ffffff',
    filter: (node: HTMLElement) => {
      if (node.tagName === 'BUTTON') return false
      if (node.classList?.contains('recharts-brush')) return false
      if (node.hasAttribute?.('data-export-hidden')) return false
      return true
    },
  })

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
    format: [imgWidthMm, imgHeightMm],
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight)

  const timestamp = new Date().toLocaleString()
  pdf.setFontSize(6)
  pdf.setTextColor(115, 115, 115)
  pdf.text(`${title} - Generated: ${timestamp}`, 5, pageHeight - 3)

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  pdf.save(finalFilename)
}
