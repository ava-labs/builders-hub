'use client'

import { useState } from 'react'
import { Download, FileText, Image, Table, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { AllMetrics, HistoricalData, TransactionRecord } from '@/lib/rwa/types'

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

  const handleTransactionCSVExport = async () => {
    setIsExporting(true)
    try {
      const allTransactions: TransactionRecord[] = []
      let currentPage = 1
      let totalPages = 1

      while (currentPage <= totalPages) {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: '100',
          direction: 'all',
        })
        const response = await fetch(`/api/rwa/transactions?${params}`)
        if (!response.ok) throw new Error('Failed to fetch transactions')

        const data = await response.json()
        const parsed: TransactionRecord[] = data.transactions.map((tx: TransactionRecord) => ({
          ...tx,
          amount: BigInt(tx.amount),
        }))
        allTransactions.push(...parsed)
        totalPages = Math.ceil(data.total / 100)
        currentPage++
      }

      const { exportTransactionsToCSV } = await import('@/lib/rwa/export/csv')
      exportTransactionsToCSV(allTransactions)
      toast.success('Transaction CSV downloaded')
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
        <DropdownMenuItem onClick={handleTransactionCSVExport}>
          <List className="h-4 w-4 mr-2" />
          Transaction CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
