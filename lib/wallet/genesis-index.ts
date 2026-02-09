import type { GenesisAllocation, UnlockSchedule } from './types'

const GENESIS_URL =
  'https://raw.githubusercontent.com/ava-labs/avalanchego/refs/heads/master/genesis/genesis_mainnet.json'

interface GenesisIndex {
  byAvaxAddr: Map<string, GenesisAllocation>
  byEthAddr: Map<string, GenesisAllocation>
  allAllocations: GenesisAllocation[]
}

let genesisIndex: GenesisIndex | null = null
let initPromise: Promise<GenesisIndex> | null = null

function normalizeAvaxAddr(addr: string): string {
  return addr.replace(/^(X-|P-|C-)/, '').toLowerCase()
}

function normalizeEthAddr(addr: string): string {
  return addr.toLowerCase()
}

function parseAllocation(raw: {
  avaxAddr: string
  ethAddr: string
  initialAmount: number
  unlockSchedule?: Array<{ amount: number; locktime: number }>
}): GenesisAllocation {
  const unlockSchedule: UnlockSchedule[] = (raw.unlockSchedule ?? []).map(
    (s) => ({
      amount: s.amount,
      locktime: s.locktime,
    })
  )

  return {
    avaxAddr: raw.avaxAddr,
    ethAddr: raw.ethAddr,
    initialAmount: raw.initialAmount,
    unlockSchedule,
  }
}

async function buildIndex(): Promise<GenesisIndex> {
  const response = await fetch(GENESIS_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch genesis: ${response.status}`)
  }

  const genesis = await response.json()
  const rawAllocations: Array<{
    avaxAddr: string
    ethAddr: string
    initialAmount: number
    unlockSchedule?: Array<{ amount: number; locktime: number }>
  }> = genesis.allocations ?? []

  const byAvaxAddr = new Map<string, GenesisAllocation>()
  const byEthAddr = new Map<string, GenesisAllocation>()
  const allAllocations: GenesisAllocation[] = []

  for (const raw of rawAllocations) {
    const allocation = parseAllocation(raw)
    allAllocations.push(allocation)

    if (allocation.avaxAddr) {
      byAvaxAddr.set(normalizeAvaxAddr(allocation.avaxAddr), allocation)
    }
    if (allocation.ethAddr) {
      byEthAddr.set(normalizeEthAddr(allocation.ethAddr), allocation)
    }
  }

  return { byAvaxAddr, byEthAddr, allAllocations }
}

export async function getGenesisIndex(): Promise<GenesisIndex> {
  if (genesisIndex) {
    return genesisIndex
  }

  if (!initPromise) {
    initPromise = buildIndex()
      .then((index) => {
        genesisIndex = index
        return index
      })
      .catch((error) => {
        initPromise = null
        throw error
      })
  }

  return initPromise
}

export async function lookupGenesisByAvaxAddr(
  addr: string
): Promise<GenesisAllocation | undefined> {
  const index = await getGenesisIndex()
  return index.byAvaxAddr.get(normalizeAvaxAddr(addr))
}

export async function lookupGenesisByEthAddr(
  addr: string
): Promise<GenesisAllocation | undefined> {
  const index = await getGenesisIndex()
  return index.byEthAddr.get(normalizeEthAddr(addr))
}

export async function lookupGenesis(
  addr: string
): Promise<GenesisAllocation | undefined> {
  if (addr.startsWith('0x')) {
    return lookupGenesisByEthAddr(addr)
  }
  return lookupGenesisByAvaxAddr(addr)
}

export async function searchGenesisAllocations(options: {
  query?: string
  minAmount?: number
  page?: number
  pageSize?: number
}): Promise<{ allocations: GenesisAllocation[]; total: number }> {
  const { query, minAmount, page = 1, pageSize = 50 } = options
  const index = await getGenesisIndex()

  let filtered = index.allAllocations

  if (query) {
    const q = query.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.avaxAddr.toLowerCase().includes(q) ||
        a.ethAddr.toLowerCase().includes(q)
    )
  }

  if (minAmount !== undefined) {
    const minNanoAvax = minAmount * 1e9
    filtered = filtered.filter((a) => a.initialAmount >= minNanoAvax)
  }

  const total = filtered.length
  const start = (page - 1) * pageSize
  const allocations = filtered.slice(start, start + pageSize)

  return { allocations, total }
}
