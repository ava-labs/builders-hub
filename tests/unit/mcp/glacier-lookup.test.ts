import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { dataTools as DataTools } from '@/lib/mcp/tools/data'

// The request that onchain_lookup builds for the Primary Network subnet. The production
// E2E test (tests/e2e/api/mcp-blockchain-lookup.e2e.ts) makes the same lookup on the live API.
const PRIMARY_SUBNET_ID = '11111111111111111111111111111111LpoYY'
const SUBNET_URL = `https://glacier-api.avax.network/v1/networks/mainnet/subnets/${PRIMARY_SUBNET_ID}`

let dataTools: typeof DataTools

beforeEach(async () => {
  // A new module graph per test, so a lookup that the MCP cache keeps does not hide the next request.
  vi.resetModules()
  ;({ dataTools } = await import('@/lib/mcp/tools/data'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function mockDataApi(response: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response())
}

function sentRequest(fetchMock: ReturnType<typeof mockDataApi>) {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]!
  return { url: String(url), headers: new Headers(init?.headers) }
}

async function lookUpPrimarySubnet() {
  const result = await dataTools.handlers.onchain_lookup({ value: PRIMARY_SUBNET_ID })
  return { text: result.content[0]?.text ?? '', isError: !!result.isError }
}

describe('onchain_lookup on the primary subnet', () => {
  it('sends GLACIER_API_KEY to the Data API host that accepts it', async () => {
    vi.stubEnv('GLACIER_API_KEY', 'test-key')
    const fetchMock = mockDataApi(() => Response.json({ subnetId: PRIMARY_SUBNET_ID }))

    const result = await lookUpPrimarySubnet()

    expect(result.isError).toBe(false)
    expect(JSON.parse(result.text)).toMatchObject({ kind: 'subnet', subnetId: PRIMARY_SUBNET_ID, network: 'mainnet' })
    const request = sentRequest(fetchMock)
    expect(request.url).toBe(SUBNET_URL)
    expect(request.headers.get('x-glacier-api-key')).toBe('test-key')
  })

  it('sends no key header when GLACIER_API_KEY is not set', async () => {
    vi.stubEnv('GLACIER_API_KEY', '')
    vi.stubEnv('GLACIER_API_KEY_1', 'other-key')
    const fetchMock = mockDataApi(() => Response.json({ subnetId: PRIMARY_SUBNET_ID }))

    expect((await lookUpPrimarySubnet()).isError).toBe(false)

    const request = sentRequest(fetchMock)
    expect(request.url).toBe(SUBNET_URL)
    expect(request.headers.has('x-glacier-api-key')).toBe(false)
  })

  it('names the reason the Data API gives for a 400, and hides the path', async () => {
    vi.stubEnv('GLACIER_API_KEY', 'test-key')
    mockDataApi(() =>
      Response.json(
        { message: 'Api key is invalid', error: 'Bad Request', statusCode: 400 },
        { status: 400, statusText: 'Bad Request' },
      ),
    )

    const result = await lookUpPrimarySubnet()

    expect(result).toEqual({ text: 'Data API error: 400 Bad Request (Api key is invalid)', isError: true })
  })
})
