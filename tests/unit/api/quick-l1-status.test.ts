import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* The status route asks the deploy service for one job, with the service's secret. The job ID is one path segment
   there, so an ID that could name another path is answered as a job that does not exist, with no call. */

vi.mock('@/app/api/managed-testnet-nodes/utils', () => ({ getUserId: async () => ({ userId: 'me', error: null }) }));

import { GET } from '@/app/api/quick-l1/status/[jobId]/route';

const fetchMock = vi.fn();
const get = (jobId: string) => GET(new NextRequest('http://localhost/api/quick-l1/status/x'), { params: Promise.resolve({ jobId }) });

beforeEach(() => {
  vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://deploy.example');
  vi.stubEnv('QUICK_L1_INTERNAL_SECRET', 'test-secret');
  fetchMock.mockReset().mockImplementation(async () => new Response('{"status":"running"}', { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/quick-l1/status/:jobId', () => {
  it('asks the service for a job by its ID', async () => {
    expect((await get('job_abc123-def')).status).toBe(200);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/status/job_abc123-def');
  });

  it('answers 404 to an ID that is not one path segment, and sends the secret nowhere', async () => {
    for (const id of ['x/../../openapi.json', '..', 'a\\b', 'a/b', 'x'.repeat(129)]) expect((await get(id)).status, id).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
