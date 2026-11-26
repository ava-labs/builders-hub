import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A proxy in front of the managed node service can answer with an HTML page
// (for example a 403 block page). The user must see the HTTP status, not a
// JSON parse error and not the page itself.

vi.mock('@/prisma/prisma', () => ({ prisma: { nodeRegistration: { findMany: vi.fn(async () => []) } } }));
vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: vi.fn(async () => ({ user: { id: 'user-1', email: 'user-1@example.invalid' } })),
}));
vi.mock('@/components/toolbox/coreViem/utils/glacier', async () => {
  const { SUBNET_EVM_VM_ID } = await import('@/constants/console');
  return {
    getBlockchainInfo: vi.fn(async () => ({
      vmId: SUBNET_EVM_VM_ID,
      blockchainName: 'test',
      subnetId: '2Ld1ozNLbZYHYAyLuNuDALXYZ7m4Ui9dP3jxQ8yRWWnAPV9V3V',
    })),
  };
});
vi.mock('@/server/services/provision-quota', () => ({
  reserveDailyProvision: vi.fn(async () => ({ allowed: true })),
  retryAfterSeconds: () => '1',
}));

const { builderHubAddNode, builderHubDeleteNode, ManagedTestnetNodeServiceRequestError } = await import(
  '@/app/api/managed-testnet-nodes/service'
);
const { NextRequest } = await import('next/server');
const nodes = await import('@/app/api/managed-testnet-nodes/route');

const SUBNET = '2Ld1ozNLbZYHYAyLuNuDALXYZ7m4Ui9dP3jxQ8yRWWnAPV9V3V';
const CHAIN = '2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn';
const BLOCK_PAGE = '<!DOCTYPE html>\n<html><head><title>Attention Required! | Cloudflare</title></head></html>';

function htmlResponse(status: number): Response {
  return new Response(BLOCK_PAGE, { status, headers: { 'content-type': 'text/html; charset=UTF-8' } });
}

beforeEach(() => {
  vi.stubEnv('MANAGED_TESTNET_NODE_SERVICE_PASSWORD', 'test');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('builderHubAddNode', () => {
  it('names the HTTP status when the service answers with an HTML page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(403)));
    const error = await builderHubAddNode(SUBNET, CHAIN, null).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ManagedTestnetNodeServiceRequestError);
    expect((error as InstanceType<typeof ManagedTestnetNodeServiceRequestError>).status).toBe(502);
    expect((error as Error).message).toContain('HTTP 403');
    expect((error as Error).message).not.toMatch(/Invalid JSON|<html|DOCTYPE/i);
  });

  it('reports an unreachable service as 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const error = await builderHubAddNode(SUBNET, CHAIN, null).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ManagedTestnetNodeServiceRequestError);
    expect((error as InstanceType<typeof ManagedTestnetNodeServiceRequestError>).status).toBe(503);
  });

  it('keeps the service error text from a JSON error reply', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'No free node slots' }, { status: 409 })));
    await expect(builderHubAddNode(SUBNET, CHAIN, null)).rejects.toThrow('No free node slots');
  });
});

describe('builderHubDeleteNode', () => {
  it('does not show an HTML page as the error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(403)));
    const error = await builderHubDeleteNode(SUBNET, 0).catch((e: unknown) => e);
    expect((error as Error).message).toContain('HTTP 403');
    expect((error as Error).message).not.toMatch(/<html|DOCTYPE/i);
  });
});

describe('POST /api/managed-testnet-nodes', () => {
  it('answers 502 with the status message when the service answers with an HTML page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => htmlResponse(403)));
    const response = await nodes.POST(
      new NextRequest('https://build.avax.network/api/managed-testnet-nodes', {
        method: 'POST',
        body: JSON.stringify({ subnetId: SUBNET, blockchainId: CHAIN }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(response.status).toBe(502);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('HTTP 403');
    expect(body.message).not.toMatch(/Invalid JSON|<html|DOCTYPE/i);
  });
});
