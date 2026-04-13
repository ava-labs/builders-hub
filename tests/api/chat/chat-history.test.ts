import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  mockAuthSession,
} from '@/tests/api/helpers/mock-session';
import { getAuthSession } from '@/lib/auth/authSession';
import {
  createMockPrisma,
  type MockPrismaClient,
} from '@/tests/api/helpers/mock-prisma';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authSession');

// Create mock Prisma client and wire it into the module mock
const mockPrisma: MockPrismaClient = createMockPrisma();

vi.mock('@/prisma/prisma', () => ({
  prisma: new Proxy({} as any, {
    get(_target, prop: string) {
      return (mockPrisma as any)[prop];
    },
  }),
}));

// Mock the Prisma-backed rate limiter to always allow requests in tests.
vi.mock('@/lib/api/rate-limit', () => ({
  checkPrismaRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 99,
    resetAt: new Date(Date.now() + 60_000),
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
    },
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-user-id'),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  cleanupRateLimitLogs: vi.fn().mockResolvedValue(0),
}));

const MOCK_CONVERSATION = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: 'test-user-id',
  title: 'Test Conversation',
  is_shared: false,
  share_token: null,
  shared_at: null,
  share_expires_at: null,
  view_count: 0,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
  messages: [
    {
      id: 'msg-1',
      conversation_id: '00000000-0000-4000-8000-000000000001',
      role: 'user',
      content: 'Hello',
      created_at: new Date('2025-01-01'),
    },
    {
      id: 'msg-2',
      conversation_id: '00000000-0000-4000-8000-000000000001',
      role: 'assistant',
      content: 'Hi there!',
      created_at: new Date('2025-01-01'),
    },
  ],
};

const OTHER_USER_CONVERSATION = {
  ...MOCK_CONVERSATION,
  id: '00000000-0000-4000-8000-000000000099',
  user_id: 'other-user-id',
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  // Do NOT call resetAuthMocks() here -- it invokes vi.restoreAllMocks() which
  // would wipe out the vi.mock factory for '@/lib/api/rate-limit'.
  // Instead, manually reset call history for the auth mock.
  vi.mocked(getAuthSession).mockReset();

  // Reset Prisma model mocks (call history + return values)
  for (const method of [
    'findFirst', 'findMany', 'findUnique', 'create', 'createMany',
    'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'count',
  ] as const) {
    mockPrisma.chatConversation[method].mockReset();
    mockPrisma.chatMessage[method].mockReset();
  }
});

// ===========================================================================
// GET /api/chat-history
// ===========================================================================

describe('GET /api/chat-history', () => {
  it('returns conversations for the authenticated user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findMany.mockResolvedValue([
      MOCK_CONVERSATION,
    ]);

    const { GET } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chat-history',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);

    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('00000000-0000-4000-8000-000000000001');
    expect(data[0].messages).toHaveLength(2);
  });

  it('returns empty array when user has no conversations', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chat-history',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chat-history',
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// POST /api/chat-history — create conversation
// ===========================================================================

describe('POST /api/chat-history', () => {
  it('creates a new conversation', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.create.mockResolvedValue(MOCK_CONVERSATION);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        title: 'Test Conversation',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result, 201);

    expect(data.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(mockPrisma.chatConversation.create).toHaveBeenCalledOnce();
  });

  it('updates an existing conversation when id is provided', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      MOCK_CONVERSATION
    );
    mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.chatConversation.update.mockResolvedValue(MOCK_CONVERSATION);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Updated Title',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      },
    });

    const result = await callHandler(POST, req);
    expectSuccess(result);

    expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { conversation_id: '00000000-0000-4000-8000-000000000001' },
    });
    expect(mockPrisma.chatConversation.update).toHaveBeenCalledOnce();
  });

  it('returns 404 when updating a conversation owned by another user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    // findFirst returns null -- conversation not found for this user
    mockPrisma.chatConversation.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        id: '00000000-0000-4000-8000-000000000099',
        title: 'Hijack Attempt',
        messages: [{ role: 'user', content: 'hacked' }],
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 400 when title is missing', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 400 when messages is empty', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        title: 'Test',
        messages: [],
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/chat-history/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history',
      body: {
        title: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// PATCH /api/chat-history/[id] — rename conversation
// ===========================================================================

describe('PATCH /api/chat-history/[id]', () => {
  it('renames a conversation', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      MOCK_CONVERSATION
    );
    mockPrisma.chatConversation.update.mockResolvedValue({
      ...MOCK_CONVERSATION,
      title: 'New Title',
    });

    const { PATCH } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('PATCH', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
      body: { title: 'New Title' },
    });

    const result = await callHandler(PATCH, req, { id: '00000000-0000-4000-8000-000000000001' });
    const data = expectSuccess(result);
    expect(data.title).toBe('New Title');
  });

  it('trims whitespace from title', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      MOCK_CONVERSATION
    );
    mockPrisma.chatConversation.update.mockResolvedValue({
      ...MOCK_CONVERSATION,
      title: 'Trimmed',
    });

    const { PATCH } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('PATCH', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
      body: { title: '  Trimmed  ' },
    });

    const result = await callHandler(PATCH, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectSuccess(result);

    expect(mockPrisma.chatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { title: 'Trimmed' },
      })
    );
  });

  it('returns 400 when title is empty', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { PATCH } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('PATCH', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
      body: { title: '' },
    });

    const result = await callHandler(PATCH, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 when conversation belongs to another user (ownership enforcement)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    // assertOwnership uses findFirst -- returns null for wrong user
    mockPrisma.chatConversation.findFirst.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('PATCH', {
      url: 'http://localhost:3000/api/chat-history/conv-other',
      body: { title: 'Hijack' },
    });

    const result = await callHandler(PATCH, req, { id: '00000000-0000-4000-8000-000000000099' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { PATCH } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('PATCH', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
      body: { title: 'Test' },
    });

    const result = await callHandler(PATCH, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// DELETE /api/chat-history/[id]
// ===========================================================================

describe('DELETE /api/chat-history/[id]', () => {
  it('deletes a conversation', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      MOCK_CONVERSATION
    );
    mockPrisma.chatConversation.delete.mockResolvedValue(MOCK_CONVERSATION);

    const { DELETE } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000001' });
    // Route returns 204 No Content (noContentResponse)
    expect(result.status).toBe(204);
  });

  it('returns 404 when conversation belongs to another user (ownership enforcement)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-other',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000099' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { DELETE } = await import('@/app/api/chat-history/[id]/route');
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-1',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// POST /api/chat-history/[id]/share — enable sharing
// ===========================================================================

describe('POST /api/chat-history/[id]/share', () => {
  it('creates a share token for a conversation', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      MOCK_CONVERSATION
    );

    const sharedConversation = {
      ...MOCK_CONVERSATION,
      is_shared: true,
      share_token: 'abc123def456ghi789jk0l',
      shared_at: new Date('2025-01-01'),
      share_expires_at: new Date('2025-01-08'),
      view_count: 0,
    };
    mockPrisma.chatConversation.update.mockResolvedValue(sharedConversation);

    const { POST } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history/conv-1/share',
      body: { expiresInDays: 7 },
    });

    const result = await callHandler(POST, req, { id: '00000000-0000-4000-8000-000000000001' });
    // Route returns 201 for newly created share tokens
    const data = expectSuccess(result, 201);

    expect(data.shareToken).toBeTruthy();
    expect(data.shareUrl).toContain('/chat/share/');
    expect(data.expiresAt).toBeTruthy();
  });

  it('returns existing share info when already shared', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const alreadyShared = {
      ...MOCK_CONVERSATION,
      is_shared: true,
      share_token: 'existing-token-abc123',
      shared_at: new Date('2025-01-01'),
      share_expires_at: new Date('2025-01-08'),
      view_count: 42,
    };
    mockPrisma.chatConversation.findFirst.mockResolvedValue(alreadyShared);

    const { POST } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history/conv-1/share',
      body: {},
    });

    const result = await callHandler(POST, req, { id: '00000000-0000-4000-8000-000000000001' });
    const data = expectSuccess(result);

    expect(data.shareToken).toBe('existing-token-abc123');
    expect(data.viewCount).toBe(42);
    // Should NOT have called update -- reused existing share
    expect(mockPrisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('returns 404 when conversation belongs to another user (ownership enforcement)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(null);

    const { POST } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history/conv-other/share',
      body: {},
    });

    const result = await callHandler(POST, req, { id: '00000000-0000-4000-8000-000000000099' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/chat-history/conv-1/share',
      body: {},
    });

    const result = await callHandler(POST, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// DELETE /api/chat-history/[id]/share — revoke sharing
// ===========================================================================

describe('DELETE /api/chat-history/[id]/share', () => {
  it('revokes sharing for a conversation', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const sharedConversation = {
      ...MOCK_CONVERSATION,
      is_shared: true,
      share_token: 'token-to-revoke',
    };
    mockPrisma.chatConversation.findFirst.mockResolvedValue(
      sharedConversation
    );
    mockPrisma.chatConversation.update.mockResolvedValue({
      ...MOCK_CONVERSATION,
      is_shared: false,
      share_token: null,
      shared_at: null,
      share_expires_at: null,
      view_count: 0,
    });

    const { DELETE } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-1/share',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000001' });
    // Route returns 204 No Content (noContentResponse)
    expect(result.status).toBe(204);

    expect(mockPrisma.chatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          is_shared: false,
          share_token: null,
          view_count: 0,
        }),
      })
    );
  });

  it('returns 404 when conversation belongs to another user (ownership enforcement)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockPrisma.chatConversation.findFirst.mockResolvedValue(null);

    const { DELETE } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-other/share',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000099' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { DELETE } = await import(
      '@/app/api/chat-history/[id]/share/route'
    );
    const req = createMockRequest('DELETE', {
      url: 'http://localhost:3000/api/chat-history/conv-1/share',
    });

    const result = await callHandler(DELETE, req, { id: '00000000-0000-4000-8000-000000000001' });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// Security: share token randomness
// ===========================================================================

describe('Security: share token randomness', () => {
  it('generates cryptographically random share tokens (no duplicates across calls)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const tokens: string[] = [];

    for (let i = 0; i < 5; i++) {
      const conv = {
        ...MOCK_CONVERSATION,
        id: `00000000-0000-4000-8000-00000000000${i}`,
        is_shared: false,
        share_token: null,
      };

      mockPrisma.chatConversation.findFirst.mockResolvedValue(conv);
      mockPrisma.chatConversation.update.mockImplementation(async ({ data }: any) => ({
        ...conv,
        ...data,
        view_count: 0,
      }));

      const { POST } = await import('@/app/api/chat-history/[id]/share/route');
      const req = createMockRequest('POST', {
        url: `http://localhost:3000/api/chat-history/conv-${i}/share`,
        body: { expiresInDays: 7 },
      });

      const result = await callHandler(POST, req, { id: conv.id });
      const data = expectSuccess(result, 201);
      tokens.push(data.shareToken);
    }

    // All tokens should be unique
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);

    // Tokens should have sufficient entropy (base64url of 18 bytes = 24 chars)
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(20);
    }
  });
});
