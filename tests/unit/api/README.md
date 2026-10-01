# API Route Testing

This directory contains unit tests for Next.js API routes located in `app/api/`.

## Pattern

API routes should be tested by importing the handler function (e.g., `GET`, `POST`) and calling it with a mocked `NextRequest`.

### Helpers

Use the shared helpers in `helpers.ts` to mock common dependencies:

- `createMockRequest(url, options)`: Creates a `NextRequest` object.
- `mockSession`: A default mocked session for NextAuth.
- `mockPrisma`: A mocked Prisma client.

### Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/your-route/route';
import { createMockRequest } from '../helpers';
import { getAuthSession } from '@/lib/auth/authSession';

vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: vi.fn(),
}));

describe('GET /api/your-route', () => {
  it('should return 401 if not authenticated', async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const req = createMockRequest('/api/your-route');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
```

## Coverage

Test coverage is tracked via Vitest. Run tests with coverage using:

```bash
pnpm vitest --coverage
```

Coverage configuration is located in `vitest.config.ts`.
