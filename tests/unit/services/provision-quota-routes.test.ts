import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { reserveDailyProvision, getUserNodes, builderHubAddNode, getBlockchainInfo } = vi.hoisted(() => ({
  reserveDailyProvision: vi.fn(),
  getUserNodes: vi.fn(),
  builderHubAddNode: vi.fn(),
  getBlockchainInfo: vi.fn(),
}));

vi.mock('@/server/services/provision-quota', () => ({
  reserveDailyProvision,
  retryAfterSeconds: () => '3600',
}));

vi.mock('@/lib/auth/authSession', () => ({
  getAuthSession: async () => ({ user: { id: 'user-1', email: 'builder@example.com' } }),
}));

vi.mock('@/prisma/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/quick-l1/mock-orchestrator', () => ({ startMockDeployment: () => ({ jobId: 'mock-job' }) }));

vi.mock('@/app/api/managed-testnet-nodes/service', () => ({
  builderHubAddNode,
  builderHubDeleteNode: vi.fn(),
  createDbNode: vi.fn(),
  getUserNodes,
  ManagedTestnetNodeServiceRequestError: class extends Error {},
  selectNewestNode: vi.fn(),
}));

vi.mock('@/components/toolbox/coreViem/utils/glacier', () => ({ getBlockchainInfo }));

import { POST as deploy } from '@/app/api/quick-l1/deploy/route';
import { POST as createNode } from '@/app/api/managed-testnet-nodes/route';
import { SUBNET_EVM_VM_ID } from '@/constants/console';

const refused = {
  allowed: false,
  limit: 10,
  resetAt: new Date(Date.now() + 60 * 60 * 1000),
  message: 'Daily limit reached: an account can start 10 Quick L1 deployments in 24 hours.',
};

function post(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  [reserveDailyProvision, getUserNodes, builderHubAddNode, getBlockchainInfo, fetchMock].forEach((m) => m.mockReset());
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.test');
  vi.stubEnv('QUICK_L1_INTERNAL_SECRET', 'test-secret');
  vi.stubEnv('BUILDER_HUB_URL', 'https://builders-hub.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/quick-l1/deploy daily cap', () => {
  const valid = { chainName: 'My Chain', tokenSymbol: 'TKN', ownerEvmAddress: '0xabc', network: 'fuji' };

  it('answers 429 and never calls the upstream service when the cap is reached', async () => {
    reserveDailyProvision.mockResolvedValue(refused);

    const res = await deploy(post('https://builders-hub.test/api/quick-l1/deploy', valid));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect((await res.json()).error).toMatch(/Daily limit reached/);
    expect(reserveDailyProvision).toHaveBeenCalledWith('user-1', 'quick-l1-deploy');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the deploy when the account is under the cap', async () => {
    reserveDailyProvision.mockResolvedValue({ allowed: true });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: 'job-1' }), { status: 200 }));

    const res = await deploy(post('https://builders-hub.test/api/quick-l1/deploy', valid));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not count a request that fails local validation', async () => {
    const res = await deploy(post('https://builders-hub.test/api/quick-l1/deploy', { ...valid, network: 'mainnet' }));

    expect(res.status).toBe(400);
    expect(reserveDailyProvision).not.toHaveBeenCalled();
  });
});

describe('POST /api/managed-testnet-nodes daily cap', () => {
  const valid = { subnetId: 'x'.repeat(48), blockchainId: 'chain-1' };

  beforeEach(() => {
    getUserNodes.mockResolvedValue([]);
    getBlockchainInfo.mockResolvedValue({ blockchainName: 'My Chain', vmId: SUBNET_EVM_VM_ID });
  });

  it('answers 429 and never calls the node service when the cap is reached', async () => {
    reserveDailyProvision.mockResolvedValue(refused);

    const res = (await createNode(post('https://builders-hub.test/api/managed-testnet-nodes', valid))) as NextResponse;

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect((await res.json()).message).toMatch(/Daily limit reached/);
    expect(reserveDailyProvision).toHaveBeenCalledWith('user-1', 'managed-testnet-node');
    expect(builderHubAddNode).not.toHaveBeenCalled();
  });

  it('checks the 3-active limit before spending a daily slot', async () => {
    getUserNodes.mockResolvedValue([{}, {}, {}]);

    const res = await createNode(post('https://builders-hub.test/api/managed-testnet-nodes', valid));

    expect(res.status).toBe(429);
    expect(reserveDailyProvision).not.toHaveBeenCalled();
  });
});
