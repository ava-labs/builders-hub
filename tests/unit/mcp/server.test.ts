import { describe, expect, it, vi } from 'vitest'

import { MCPServer } from '@/lib/mcp/server'
import { jsonRpcMessageSchema } from '@/lib/mcp/types'

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
})
