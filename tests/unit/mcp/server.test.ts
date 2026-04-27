import { describe, expect, it, vi } from 'vitest'

import { MCPServer, MAX_BATCH_SIZE } from '@/lib/mcp/server'
import { jsonRpcMessageSchema } from '@/lib/mcp/types'
import { GITHUB_REPOSITORIES, githubTools } from '@/lib/mcp/tools/github'

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}))

function createServer() {
  return new MCPServer({
    name: 'test-server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
  })
}

describe('jsonRpcMessageSchema', () => {
  it('rejects messages with malformed request ids', () => {
    const parsed = jsonRpcMessageSchema.safeParse({
      jsonrpc: '2.0',
      id: true,
      method: 'tools/list',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('MCPServer.handlePost', () => {
  it('accepts initialized notifications without returning a JSON-RPC response', async () => {
    const server = createServer()

    await expect(
      server.handlePost({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      })
    ).resolves.toBeNull()
  })

  it('returns Invalid request for malformed ids instead of treating them as notifications', async () => {
    const server = createServer()

    await expect(
      server.handlePost({
        jsonrpc: '2.0',
        id: true,
        method: 'tools/list',
      })
    ).resolves.toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: 'Invalid request',
      },
    })
  })

  it('filters notification-only entries out of batch responses', async () => {
    const server = createServer()

    await expect(
      server.handlePost([
        {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        },
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        },
      ])
    ).resolves.toEqual([
      {
        jsonrpc: '2.0',
        id: 1,
        result: {},
      },
    ])
  })

  it('rejects batches that exceed the maximum batch size', async () => {
    const server = createServer()
    const batch = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({
      jsonrpc: '2.0' as const,
      id: i,
      method: 'ping' as const,
    }))

    await expect(server.handlePost(batch)).resolves.toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32600,
        message: expect.stringContaining(`exceeds the maximum of ${MAX_BATCH_SIZE}`),
      },
    })
  })
})

describe('githubTools', () => {
  it('covers the core Avalanche repositories from the MCP roadmap', () => {
    expect(GITHUB_REPOSITORIES.map((repo) => repo.fullName)).toEqual([
      'ava-labs/avalanchego',
      'ava-labs/subnet-evm',
      'ava-labs/coreth',
      'ava-labs/avalanche-cli',
      'ava-labs/platform-cli',
      'ava-labs/icm-services',
      'ava-labs/avalanche-network-runner',
      'ava-labs/icm-contracts',
      'ava-labs/hypersdk',
      'ava-labs/libevm',
      'ava-labs/builders-hub',
    ])
  })

  it('exposes repository coverage through an MCP tool', async () => {
    const result = await githubTools.handlers.github_list_repositories({})
    const payload = JSON.parse(result.content[0].text)

    expect(payload.repositories).toHaveLength(11)
    expect(payload.repositories[0]).toMatchObject({
      name: 'avalanchego',
      fullName: 'ava-labs/avalanchego',
    })
  })
})
