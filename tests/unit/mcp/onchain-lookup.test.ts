import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { dataTools as DataTools } from '@/lib/mcp/tools/data'

// The production E2E test (tests/e2e/api/mcp-blockchain-lookup.e2e.ts) looks up the same ids on the live API.
const PRIMARY_SUBNET_ID = '11111111111111111111111111111111LpoYY'
const BEAM_SUBNET_ID = 'eYwmVU67LmSfZb1RwqCMhBYkFyG8ftxn6jAwqzFmxC9STBWLC'
const SUBNET_URL = `https://stats-api.avax.network/v1/networks/mainnet/subnets/${BEAM_SUBNET_ID}`

let dataTools: typeof DataTools

beforeEach(async () => {
  // A new module graph per test, so a lookup that the MCP cache keeps does not hide the next request.
  vi.resetModules()
  ;({ dataTools } = await import('@/lib/mcp/tools/data'))
})

afterEach(() => vi.restoreAllMocks())

function mockStatsApi(response: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response())
}

async function lookUp(value: string) {
  const result = await dataTools.handlers.onchain_lookup({ value })
  return { text: result.content[0]?.text ?? '', isError: !!result.isError }
}

describe('onchain_lookup on a subnet', () => {
  it('reads the subnet from the Stats API with no key header', async () => {
    const fetchMock = mockStatsApi(() => Response.json({ subnetId: BEAM_SUBNET_ID }))

    const result = await lookUp(BEAM_SUBNET_ID)

    expect(result.isError).toBe(false)
    expect(JSON.parse(result.text)).toMatchObject({ kind: 'subnet', subnetId: BEAM_SUBNET_ID, network: 'mainnet', source: 'stats-api' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(SUBNET_URL)
    const headers = new Headers(init?.headers)
    expect([...headers.keys()].filter((key) => key !== 'accept')).toEqual([])
  })

  it('answers the Primary Network subnet without a request', async () => {
    const fetchMock = mockStatsApi(() => Response.json({}))

    const result = await lookUp(PRIMARY_SUBNET_ID)

    expect(result.isError).toBe(false)
    const body = JSON.parse(result.text)
    expect(body).toMatchObject({ kind: 'subnet', subnetId: PRIMARY_SUBNET_ID, network: 'mainnet', result: { isPrimaryNetwork: true } })
    expect(body.result.blockchains.map((chain: { blockchainName: string }) => chain.blockchainName)).toEqual(['P-Chain', 'X-Chain', 'C-Chain'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a subnet the Stats API does not know as not found', async () => {
    mockStatsApi(() => Response.json({ error: 'Not Found', message: 'subnet not found' }, { status: 404 }))

    expect(await lookUp(BEAM_SUBNET_ID)).toEqual({ text: `Subnet ${BEAM_SUBNET_ID} was not found on mainnet.`, isError: true })
  })

  it('names the reason the Stats API gives for a 400, and hides the path', async () => {
    mockStatsApi(() =>
      Response.json(
        { error: 'Bad Request', message: 'invalid subnet id', statusCode: 400 },
        { status: 400, statusText: 'Bad Request' },
      ),
    )

    expect(await lookUp(BEAM_SUBNET_ID)).toEqual({ text: 'Stats API error: 400 Bad Request (invalid subnet id)', isError: true })
  })
})
