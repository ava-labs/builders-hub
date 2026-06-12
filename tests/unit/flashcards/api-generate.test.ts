import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock NextAuth + generate pipeline before importing the route.
const getAuthSessionMock = vi.fn();
vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: () => getAuthSessionMock(),
}));

const generateDeckMock = vi.fn();
vi.mock('@/lib/flashcards/generate', () => ({
  generateDeck: (...args: unknown[]) => generateDeckMock(...args),
  regenerateCard: vi.fn(),
}));

// Import after mocks
const { POST } = await import('@/app/api/flashcards/generate/route');
const {
  TokenBudgetExceededError,
  SourceUnavailableError,
  ServiceUnavailableError,
  FLASHCARDS_MAX_SOURCE_TOKENS,
} = await import('@/lib/flashcards/errors');

const validBody = {
  sources: [
    {
      kind: 'academy' as const,
      path: '/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications',
      chapterTitle: 'Decentralized Applications',
    },
  ],
  targetCardCount: 15,
};

function makeRequest(body: unknown): Request {
  return new Request('http://test/api/flashcards/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/flashcards/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // NOTE: in-memory rate-limit store persists across tests in this file.
    // Tests use distinct user ids to stay below the per-user limit.
  });

  it('returns 401 when not authenticated', async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid body', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-bad-body' } });
    const res = await POST(makeRequest({ sources: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when JSON is malformed', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-malformed' } });
    const req = new Request('http://test/api/flashcards/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns a sanitized 502 for unknown generation failures', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-throws' } });
    generateDeckMock.mockRejectedValue(new Error('LLM unavailable: token sk-ant-XYZ'));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.message).not.toContain('sk-ant');
    expect(body.message).not.toContain('LLM unavailable');
    expect(body.error).toBe('Generation failed');
  });

  it('returns 503 when the upstream Anthropic API leaks auth wording', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-anthropic' } });
    generateDeckMock.mockRejectedValue(
      new Error('Anthropic API key authentication_error'),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).not.toContain('api key');
    expect(body.message).not.toContain('Anthropic');
    expect(body.error).toBe('Service unavailable');
  });

  it('returns 503 for ServiceUnavailableError (missing API key)', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-no-key' } });
    generateDeckMock.mockRejectedValue(
      new ServiceUnavailableError('Flashcard generation is not configured'),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).not.toContain('configured');
    expect(body.error).toBe('Service unavailable');
  });

  it('returns 400 with token budget details when sources exceed the cap', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-budget' } });
    generateDeckMock.mockRejectedValue(
      new TokenBudgetExceededError(150_000, FLASHCARDS_MAX_SOURCE_TOKENS),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Sources exceed token budget');
    expect(body.details).toMatchObject({
      tokensUsed: 150_000,
      tokenLimit: FLASHCARDS_MAX_SOURCE_TOKENS,
    });
  });

  it('returns 422 when source content cannot be loaded', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-source' } });
    generateDeckMock.mockRejectedValue(
      new SourceUnavailableError(
        'No MDX file found for /some/internal/path.mdx',
      ),
    );
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).not.toContain('/some/internal');
    expect(body.error).toBe('Source unavailable');
  });

  it('returns 200 with deck + sessionId on success', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-success' } });
    generateDeckMock.mockResolvedValue({
      deck: {
        id: 'd1',
        title: 'Test Deck',
        sources: validBody.sources,
        cards: [
          {
            id: 'c1',
            type: 'qa',
            front: 'Q',
            back: 'A',
            source: validBody.sources[0],
          },
        ],
      },
      droppedDuplicateIds: [],
      totalSourceTokens: 100,
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeTruthy();
    expect(body.deck.cards).toHaveLength(1);
  });

  it('returns 429 after exceeding the daily rate limit', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user-limit' } });
    generateDeckMock.mockResolvedValue({
      deck: {
        id: 'd',
        title: 'T',
        sources: validBody.sources,
        cards: [
          {
            id: 'c',
            type: 'qa',
            front: 'Q',
            back: 'A',
            source: validBody.sources[0],
          },
        ],
      },
      droppedDuplicateIds: [],
      totalSourceTokens: 1,
    });

    // 10 generations allowed, 11th should 429
    let final: Response | undefined;
    for (let i = 0; i < 11; i++) {
      final = await POST(makeRequest(validBody));
    }
    expect(final?.status).toBe(429);
  });
});
