import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAllTrackedTransfers } from '@/lib/rwa/glacier/transactions'
import { listLineTransactions } from '@/lib/rwa/line/figures'
import { normalizeAddress } from '@/lib/rwa/constants/addresses'
import { checkRateLimit } from '@/lib/rwa/middleware/rate-limit'
import { ledgerLabels, serializeBigints } from '@/lib/rwa/utils'
import { getFacility, isLineFacility } from '@/lib/rwa/facilities'
import type { RWAFacility } from '@/lib/rwa/facilities'
import type { TransactionRecord, ParsedTransfer } from '@/lib/rwa/types'

export const dynamic = 'force-dynamic'
export const revalidate = 300

interface RouteParams {
  params: Promise<{ slug: string }>
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['inbound', 'outbound', 'internal', 'all']).default('all'),
  // a line of credit's event kind: a facility without a line has none, so a kind other than all leaves it no rows
  kind: z.enum(['draw', 'repayment', 'commitment', 'withdrawal', 'all']).default('all'),
  sortField: z.enum(['date', 'amount']).default('date'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
})

function labelAddress(labels: Record<string, string>, address: string): string {
  return labels[address] ?? address
}

function classifyDirection(facility: RWAFacility, transfer: ParsedTransfer): TransactionRecord['direction'] {
  if (transfer.isInternal) return 'internal'

  const tranchePool = normalizeAddress(facility.pool.address)
  const borrower = normalizeAddress(facility.borrower.address)
  const isToTracked = transfer.to === tranchePool || transfer.to === borrower
  const isFromTracked = transfer.from === tranchePool || transfer.from === borrower

  if (isToTracked && !isFromTracked) return 'inbound'
  if (isFromTracked && !isToTracked) return 'outbound'
  return 'internal'
}

function toTransactionRecord(facility: RWAFacility, labels: Record<string, string>, transfer: ParsedTransfer): TransactionRecord {
  return {
    txHash: transfer.txHash,
    timestamp: transfer.timestamp.toISOString(),
    from: transfer.from,
    fromLabel: labelAddress(labels, transfer.from),
    to: transfer.to,
    toLabel: labelAddress(labels, transfer.to),
    amount: transfer.amount,
    direction: classifyDirection(facility, transfer),
  }
}

/** the ledger of a facility whose capital moves in USDC transfers, as its tracked addresses list them */
async function listTransferRecords(facility: RWAFacility): Promise<TransactionRecord[]> {
  const transfersByAddress = await getAllTrackedTransfers(facility)
  const labels = ledgerLabels(facility)

  const seen = new Set<string>()
  const allRecords: TransactionRecord[] = []

  // one row per transfer, as the metrics count them: a transaction can carry
  // several tracked transfers, and an internal one is listed under both addresses
  for (const [, transfers] of transfersByAddress) {
    for (const transfer of transfers) {
      const key = `${transfer.txHash}-${transfer.from}-${transfer.to}`
      if (seen.has(key)) continue
      seen.add(key)
      allRecords.push(toTransactionRecord(facility, labels, transfer))
    }
  }

  return allRecords
}

export async function GET(request: Request, { params }: RouteParams) {
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
    const { slug } = await params
    const facility = getFacility(slug)

    if (!facility) {
      return NextResponse.json(
        { error: 'RWA project not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const rawParams = {
      page: searchParams.get('page') ?? '1',
      pageSize: searchParams.get('pageSize') ?? '20',
      direction: searchParams.get('direction') ?? 'all',
      kind: searchParams.get('kind') ?? 'all',
      sortField: searchParams.get('sortField') ?? 'date',
      sortDirection: searchParams.get('sortDirection') ?? 'desc',
    }

    const validatedParams = querySchema.parse(rawParams)
    // a line of credit lists its position's events, never its transfers
    const allRecords = isLineFacility(facility)
      ? await listLineTransactions(facility)
      : await listTransferRecords(facility)

    allRecords.sort((a, b) => {
      const multiplier = validatedParams.sortDirection === 'asc' ? 1 : -1
      if (validatedParams.sortField === 'date') {
        return multiplier * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }
      if (a.amount < b.amount) return -1 * multiplier
      if (a.amount > b.amount) return 1 * multiplier
      return 0
    })

    const byDirection = validatedParams.direction === 'all'
      ? allRecords
      : allRecords.filter((r) => r.direction === validatedParams.direction)
    const filtered = validatedParams.kind === 'all'
      ? byDirection
      : byDirection.filter((r) => r.kind === validatedParams.kind)

    const total = filtered.length
    const startIndex = (validatedParams.page - 1) * validatedParams.pageSize
    const page = filtered.slice(startIndex, startIndex + validatedParams.pageSize)

    const serializedPage = page.map(
      (record) => serializeBigints(record) as unknown
    )

    return NextResponse.json(
      {
        transactions: serializedPage,
        total,
        page: validatedParams.page,
        pageSize: validatedParams.pageSize,
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
