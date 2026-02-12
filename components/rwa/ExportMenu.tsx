'use client'

import { useState } from 'react'
import { Download, FileText, Image, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { AllMetrics, HistoricalData } from '@/lib/rwa/types'

interface ExportMenuProps {
  metrics: AllMetrics | null
  historical: HistoricalData | null
  dashboardElementId: string
}

export function ExportMenu({ metrics, historical, dashboardElementId }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false)
  const handleCSVExport = async () => {
    if (!metrics && !historical) return
    setIsExporting(true)

    try {
      const { exportMetricsToCSV, exportHistoricalToCSV } = await import('@/lib/rwa/export/csv')
      if (metrics) exportMetricsToCSV(metrics)
      if (historical) exportHistoricalToCSV(historical)
      toast.success('CSV data downloaded')
    } catch (err) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handlePDFExport = async () => {
    setIsExporting(true)
    try {
      const { exportDashboardToPDF } = await import('@/lib/rwa/export/pdf')
      await exportDashboardToPDF(dashboardElementId)
      toast.success('PDF report downloaded')
    } catch (err) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImageExport = async () => {
    setIsExporting(true)
    try {
      const { exportDashboardToImage } = await import('@/lib/rwa/export/image')
      await exportDashboardToImage(dashboardElementId)
      toast.success('PNG image downloaded')
    } catch (err) {
      toast.error('Export failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={isExporting}>
          <Download className="h-3.5 w-3.5" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSVExport} disabled={!metrics && !historical}>
          <Table className="h-4 w-4 mr-2" />
          CSV Data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDFExport}>
          <FileText className="h-4 w-4 mr-2" />
          PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleImageExport}>
          <Image className="h-4 w-4 mr-2" />
          PNG Image
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
