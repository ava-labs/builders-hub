import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkMCPRateLimit, getClientId, getMCPRequestCost } from '@/lib/mcp-rate-limit'
import { MAX_MCP_BODY_BYTES, MCPBodyTooLargeError, readMCPJson } from '@/lib/mcp/request-body'
import { actionTools } from '@/lib/mcp/tools/actions'
import { consoleTools } from '@/lib/mcp/tools/console'
import { dataTools } from '@/lib/mcp/tools/data'

afterEach(() => vi.restoreAllMocks())

function textOf(result: Awaited<ReturnType<(typeof actionTools.handlers)[string]>>): string {
  return result.content[0]?.text || ''
}

describe('MCP request admission', () => {
  it('charges every batch item and weighs data calls', () => {
    expect(getMCPRequestCost([
      { method: 'ping' },
      { method: 'tools/call', params: { name: 'docs_search' } },
      { method: 'tools/call', params: { name: 'onchain_query' } },
    ])).toBe(7)
  })

  it('isolates browser clients sharing an origin by trusted proxy IP', () => {
    const first = { headers: new Headers({ origin: 'https://claude.ai', 'x-vercel-forwarded-for': '203.0.113.1' }) }
    const second = { headers: new Headers({ origin: 'https://claude.ai', 'x-vercel-forwarded-for': '203.0.113.2' }) }
    expect(getClientId(first as never)).not.toBe(getClientId(second as never))
  })

  it('retains per-instance protection when Redis is unavailable', async () => {
    const previous = process.env.REDIS_URL
    delete process.env.REDIS_URL
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const request = {
      headers: new Headers({ origin: 'https://fallback-test.invalid', 'x-real-ip': '203.0.113.55' }),
    }
    try {
      for (let i = 0; i < 120; i++) {
        await expect(checkMCPRateLimit(request as never)).resolves.toBeNull()
      }
      await expect(checkMCPRateLimit(request as never)).resolves.toMatchObject({ status: 429 })
    } finally {
      if (previous === undefined) delete process.env.REDIS_URL
      else process.env.REDIS_URL = previous
    }
  })

  it('enforces the actual streamed body size when Content-Length is absent', async () => {
    const valid = new Request('https://example.test', { method: 'POST', body: JSON.stringify({ ok: true }) })
    expect(await readMCPJson(valid)).toEqual({ ok: true })

    const oversized = new Request('https://example.test', { method: 'POST', body: 'x'.repeat(MAX_MCP_BODY_BYTES + 1) })
    oversized.headers.delete('content-length')
    await expect(readMCPJson(oversized)).rejects.toBeInstanceOf(MCPBodyTooLargeError)
  })
})

describe('action output safety and links', () => {
  it('emits valid genesis JSON and the canonical create-L1 URL', async () => {
    const result = await actionTools.handlers.build_plan({
      operation: 'create-l1',
      chainId: '12345',
      name: 'safe-l1',
      tokenSymbol: 'SAFE',
    })
    const output = textOf(result)
    expect(result.isError).not.toBe(true)
    expect(output).toContain('https://build.avax.network/console/create-l1')
    const genesis = output.match(/```json\n([\s\S]*?)\n```/)?.[1]
    expect(genesis).toBeTruthy()
    expect(JSON.parse(genesis!)).toMatchObject({ config: { chainId: 12345 } })
  })

  it('rejects command injection and incomplete command parameters', async () => {
    const injected = await actionTools.handlers.build_plan({
      operation: 'transfer',
      amount: '1',
      to: '0xabc; curl https://attacker.invalid',
    })
    expect(injected.isError).toBe(true)
    expect(textOf(injected)).not.toContain('platform transfer')

    const missingChain = await actionTools.handlers.build_plan({ operation: 'create-l1' })
    expect(missingChain.isError).toBe(true)
  })

  it('returns real validator-manager and interchain-kit destinations', async () => {
    const manager = await actionTools.handlers.console_link({
      flow: 'validator-manager',
      validatorManager: 'pos-native',
    })
    expect(textOf(manager)).toContain('/permissionless-l1s/native-staking-manager-setup')

    const kit = await actionTools.handlers.console_link({ flow: 'interchain-kit-local' })
    expect(textOf(kit)).toContain('/docs/tooling/avalanche-sdk/interchain-kit')

    const listed = await consoleTools.handlers.console_flow({})
    expect(textOf(listed)).toContain('/console/ictt/setup')
    expect(textOf(listed)).toContain('/console/primary-network/c-p-bridge')
  })
})

describe('tool compatibility', () => {
  it('keeps the retired blockchain names as indexed lookup aliases', () => {
    const names = dataTools.tools.map((tool) => tool.name)
    expect(names).toEqual(expect.arrayContaining([
      'blockchain_get_native_balance',
      'blockchain_get_contract_info',
      'blockchain_lookup_address',
    ]))
  })

  it('preserves legacy response shapes without the five-call general lookup fanout', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('balances:getNative')) {
        return new Response(JSON.stringify({ nativeTokenBalance: { balance: '1500000000000000000', symbol: 'AVAX' } }))
      }
      return new Response(JSON.stringify({ name: 'Token', symbol: 'TOK', ercType: 'ERC-20' }))
    })
    const address = `0x${'a'.repeat(40)}`

    const balance = await dataTools.handlers.blockchain_get_native_balance({ address, chainId: '43114' })
    expect(JSON.parse(balance.content[0]!.text)).toMatchObject({ balanceFormatted: '1.500000', symbol: 'AVAX' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockClear()
    const lookup = await dataTools.handlers.blockchain_lookup_address({ address, chainId: '43114' })
    expect(JSON.parse(lookup.content[0]!.text)).toMatchObject({ balance: '1.500000 AVAX', isContract: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
