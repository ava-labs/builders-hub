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

  const { default: jsPDF } = await import('jspdf')

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const footerHeight = 5

  const availableWidth = pageWidth - 2 * margin
  const availablePageHeight = pageHeight - 2 * margin - footerHeight

  // Scale image width to fit page width, then paginate vertically
  const pxToMm = 25.4 / (96 * scale)
  const imgWidthMm = imgWidthPx * pxToMm
  const imgHeightMm = imgHeightPx * pxToMm

  const fitScale = availableWidth / imgWidthMm
  const scaledWidth = imgWidthMm * fitScale
  const scaledHeight = imgHeightMm * fitScale

  // How many pages do we need?
  const totalPages = Math.ceil(scaledHeight / availablePageHeight)

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage()
    }

    // Offset the image upward for each page
    const yOffset = margin - page * availablePageHeight

    // Clip to page bounds using the image placement
    pdf.addImage(
      dataUrl,
      'PNG',
      margin,
      yOffset,
      scaledWidth,
      scaledHeight
    )

    // White-out areas outside the content region to clean up overflow
    // Top overflow (above margin)
    if (page > 0) {
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pageWidth, margin, 'F')
    }
    // Bottom overflow (below content area)
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, pageHeight - margin - footerHeight, pageWidth, margin + footerHeight, 'F')

    // Footer
    const timestamp = new Date().toLocaleString()
    pdf.setFontSize(6)
    pdf.setTextColor(115, 115, 115)
    pdf.text(
      `${title} - Generated: ${timestamp} - Page ${page + 1}/${totalPages}`,
      margin,
      pageHeight - 3
    )
  }

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  pdf.save(finalFilename)
}
