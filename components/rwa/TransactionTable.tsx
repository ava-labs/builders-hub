'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ADDRESSES, normalizeAddress } from '@/lib/rwa/constants/addresses'
import type { TransactionRecord } from '@/lib/rwa/types'
import { bigintToNumber } from '@/lib/rwa/utils'
import { usePalette } from '@/lib/rwa/hooks/usePalette'

const COMPACT_SIZE = 5
const EXPANDED_SIZE = 20

const ADDRESS_LABELS: Record<string, string> = {
  [normalizeAddress(ADDRESSES.TRANCHE_POOL)]: 'Tranche Pool',
  [normalizeAddress(ADDRESSES.BORROWER_OPERATING)]: 'Borrower (OatFi)',
  [normalizeAddress(ADDRESSES.LENDER_VALINOR)]: 'Lender (Valinor)',
  [normalizeAddress(ADDRESSES.LENDER_AVALANCHE)]: 'Lender (Avalanche)',
}

function labelForAddress(address: string): string {
  return ADDRESS_LABELS[normalizeAddress(address)] ?? `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatAmount(amount: bigint): string {
  const num = bigintToNumber(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

type Direction = 'all' | 'inbound' | 'outbound'
type Explorer = 'bh' | 'snowtrace' | 'avalanche'

const EXPLORER_URLS: Record<Explorer, (hash: string) => string> = {
  bh: (hash) => `/explorer/c-chain/tx/${hash}`,
  snowtrace: (hash) => `https://snowtrace.io/tx/${hash}`,
  avalanche: (hash) => `https://subnets.avax.network/c-chain/tx/${hash}`,
}

const EXPLORER_LABELS: Record<Explorer, string> = {
  bh: 'Internal Explorer',
  snowtrace: 'Snowtrace',
  avalanche: 'Avalanche Explorer',
}

interface TransactionsResponse {
  transactions: TransactionRecord[]
  total: number
  page: number
  pageSize: number
}

export function TransactionTable() {
  const { palette } = usePalette()
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [direction, setDirection] = useState<Direction>('all')
  const [explorer, setExplorer] = useState<Explorer>('bh')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const pageSize = expanded ? EXPANDED_SIZE : COMPACT_SIZE

  const fetchTransactions = useCallback(async (p: number, dir: Direction, size: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(size),
        direction: dir,
      })
      const response = await fetch(`/api/rwa/transactions?${params}`)
      if (!response.ok) throw new Error('Failed to fetch transactions')

      const data: TransactionsResponse = await response.json()

      const parsed = data.transactions.map((tx) => ({
        ...tx,
        amount: BigInt(tx.amount),
      }))

      setTransactions(parsed)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransactions(page, direction, pageSize)
  }, [page, direction, pageSize, fetchTransactions])

  const handleDirectionChange = useCallback((value: string) => {
    setDirection(value as Direction)
    setPage(1)
  }, [])

  const handleExplorerChange = useCallback((value: string) => {
    setExplorer(value as Explorer)
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
    setPage(1)
  }, [])

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={explorer} onValueChange={handleExplorerChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs dark:border-muted-foreground/25">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(EXPLORER_LABELS) as Explorer[]).map((key) => (
                  <SelectItem key={key} value={key}>{EXPLORER_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={handleDirectionChange}>
              <SelectTrigger className="w-[110px] h-8 text-xs dark:border-muted-foreground/25">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <Table className="[&_td]:py-2 [&_th]:py-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">From</TableHead>
                  <TableHead className="hidden sm:table-cell">To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tx Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.txHash}>
                      <TableCell className="text-xs">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {labelForAddress(tx.from)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {labelForAddress(tx.to)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatAmount(tx.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={EXPLORER_URLS[explorer](tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs hover:underline"
                          style={{ color: palette.shades[600] }}
                          aria-label={`View transaction ${tx.txHash.slice(0, 8)} on ${EXPLORER_LABELS[explorer]}`}
                        >
                          {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination & expand toggle */}
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                {total} transaction{total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleToggleExpand}
                >
                  {expanded ? 'Show less' : 'Show more'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
