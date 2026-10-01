import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Mocking NextAuth session
 */
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

/**
 * Helper to create a mock NextRequest
 */
export function createMockRequest(url: string, options: RequestInit = {}) {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`;
  return new NextRequest(new URL(fullUrl), options);
}

/**
 * Mock Prisma client
 */
export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  faucetClaim: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};
