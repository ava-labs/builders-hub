import { describe, expect, it, vi } from 'vitest';

const { contractMock, sourcesMock } = vi.hoisted(() => ({ contractMock: vi.fn(), sourcesMock: vi.fn() }));
vi.mock('@/lib/sourcify', () => ({ getVerifiedContractResolvingProxies: contractMock, getContractSources: sourcesMock }));

import { GET as contractGET } from '@/app/api/sourcify/[chainId]/[address]/route';
import { GET as sourcesGET } from '@/app/api/sourcify/[chainId]/[address]/sources/route';

const ctx = { params: Promise.resolve({ chainId: '43114', address: '0x000000000000000000000000000000000000dEaD' }) };
const req = {} as never;

describe('the Sourcify routes', () => {
  it('answer an unverified contract with 200, so the browser logs no error', async () => {
    contractMock.mockResolvedValueOnce(null);
    const res = await contractGET(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: false });
    // a miss is never browser-cached: verification can land at any moment
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=60');
  });

  it('answer missing sources with 200', async () => {
    sourcesMock.mockResolvedValueOnce(null);
    const res = await sourcesGET(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
  });

  it('still serve a verified contract', async () => {
    contractMock.mockResolvedValueOnce({ name: 'Example', abi: [] });
    const res = await contractGET(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verified: true, name: 'Example' });
  });
});
