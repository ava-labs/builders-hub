import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAllTrackedTransfers } from '@/lib/rwa/glacier/transactions'
import { ADDRESSES, normalizeAddress } from '@/lib/rwa/constants/addresses'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { serializeBigints } from '@/lib/rwa/utils'
import type { TransactionRecord, ParsedTransfer } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['inbound', 'outbound', 'internal', 'all']).default('all'),
  sortField: z.enum(['date', 'amount']).default('date'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})

const ADDRESS_LABELS: Record<string, string> = {
  [normalizeAddress(ADDRESSES.TRANCHE_POOL)]: 'Tranche Pool',
  [normalizeAddress(ADDRESSES.BORROWER_OPERATING)]: 'Borrower Operating',
  [normalizeAddress(ADDRESSES.LENDER_VALINOR)]: 'Valinor',
  [normalizeAddress(ADDRESSES.LENDER_AVALANCHE)]: 'Avalanche',
}

function labelAddress(address: string): string {
  return ADDRESS_LABELS[address] ?? address
}

function classifyDirection(transfer: ParsedTransfer): TransactionRecord['direction'] {
  if (transfer.isInternal) return 'internal'

  const tranchePool = normalizeAddress(ADDRESSES.TRANCHE_POOL)
  const borrower = normalizeAddress(ADDRESSES.BORROWER_OPERATING)
  const isToTracked = transfer.to === tranchePool || transfer.to === borrower
  const isFromTracked = transfer.from === tranchePool || transfer.from === borrower

  if (isToTracked && !isFromTracked) return 'inbound'
  if (isFromTracked && !isToTracked) return 'outbound'
  return 'internal'
}

function toTransactionRecord(transfer: ParsedTransfer): TransactionRecord {
  return {
    txHash: transfer.txHash,
    timestamp: transfer.timestamp.toISOString(),
    from: transfer.from,
    fromLabel: labelAddress(transfer.from),
    to: transfer.to,
    toLabel: labelAddress(transfer.to),
    amount: transfer.amount,
    direction: classifyDirection(transfer),
  }
}

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter) },
      }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawParams = {
      page: searchParams.get('page') ?? '1',
      pageSize: searchParams.get('pageSize') ?? '20',
      direction: searchParams.get('direction') ?? 'all',
      sortField: searchParams.get('sortField') ?? 'date',
      sortDirection: searchParams.get('sortDirection') ?? 'desc',
    }

    const params = querySchema.parse(rawParams)
    const transfersByAddress = await getAllTrackedTransfers()

    const seen = new Set<string>()
    const allRecords: TransactionRecord[] = []

    for (const [, transfers] of transfersByAddress) {
      for (const transfer of transfers) {
        if (seen.has(transfer.txHash)) continue
        seen.add(transfer.txHash)
        allRecords.push(toTransactionRecord(transfer))
      }
    }

    allRecords.sort((a, b) => {
      const multiplier = params.sortDirection === 'asc' ? 1 : -1
      if (params.sortField === 'date') {
        return multiplier * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }
      if (a.amount < b.amount) return -1 * multiplier
      if (a.amount > b.amount) return 1 * multiplier
      return 0
    })

    const filtered = params.direction === 'all'
      ? allRecords
      : allRecords.filter((r) => r.direction === params.direction)

    const total = filtered.length
    const startIndex = (params.page - 1) * params.pageSize
    const page = filtered.slice(startIndex, startIndex + params.pageSize)

    const serializedPage = page.map(
      (record) => serializeBigints(record) as unknown
    )

    return NextResponse.json(
      {
        transactions: serializedPage,
        total,
        page: params.page,
        pageSize: params.pageSize,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
