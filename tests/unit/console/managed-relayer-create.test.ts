import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* A managed relayer connects to the URLs of its configs from inside the cluster. The route sends the service the
   four fields of a config and nothing else, takes only public addresses, and counts the creates of an account. */

const { session, reserveDailyProvision } = vi.hoisted(() => ({
  session: { id: 'user-1' },
  reserveDailyProvision: vi.fn(),
}));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: session.id, email: 'a@example.com' } }) }));
vi.mock('@/server/services/provision-quota', () => ({ reserveDailyProvision, retryAfterSeconds: () => '3600' }));
vi.mock('@/prisma/prisma', () => ({ prisma: {} }));

import { POST } from '@/app/api/managed-testnet-relayers/route';
import { GET as listNodes } from '@/app/api/managed-testnet-nodes/route';

const SUBNET = '2Ld1ozNLbZYHYAyLuNuDALXYZ7m4Ui9dP3jxQ8yRWWnAPV9V3V';
const CHAIN = '2tmrrBo1Lgt1mzzvPSFt73kkQKFas5d1AP88tv9cicwoFp8BSn';
const config = {
  subnetId: SUBNET,
  blockchainId: CHAIN,
  rpcUrl: `https://node.example.com/ext/bc/${CHAIN}/rpc`,
  wsUrl: `wss://node.example.com/ext/bc/${CHAIN}/ws`,
};
// the primary network and the C-Chain, as the Console's chain list has them
const cChain = {
  subnetId: '11111111111111111111111111111111LpoYY',
  blockchainId: 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp',
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  wsUrl: 'wss://api.avax-test.network/ext/bc/C/ws',
};

const fetchMock = vi.fn();
const post = (body: unknown) =>
  POST(
    new NextRequest('https://build.avax.network/api/managed-testnet-relayers', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

beforeEach(() => {
  session.id = 'user-1';
  reserveDailyProvision.mockReset().mockResolvedValue({ allowed: true });
  fetchMock.mockReset().mockImplementation(async () => Response.json({ relayerId: '0xabc' }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('MANAGED_TESTNET_NODE_SERVICE_PASSWORD', 'test');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/managed-testnet-relayers', () => {
  it('sends the service the four fields of each config, with the account as the label', async () => {
    expect((await post({ configs: [config, cChain] })).status).toBe(201);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ configs: [config, cChain], label: 'user-1' });
    expect(reserveDailyProvision).toHaveBeenCalledWith('user-1', 'managed-testnet-relayer');
  });

  it('refuses a config with another key, an ID of another format, or no config', async () => {
    for (const configs of [
      [{ ...config, extra: 'x' }],
      [{ ...config, subnetId: '../relayers' }],
      [{ ...config, blockchainId: 'x' }],
      [{ ...config, rpcUrl: undefined }],
      [],
      Array.from({ length: 11 }, () => config),
    ]) {
      expect((await post({ configs })).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reserveDailyProvision).not.toHaveBeenCalled();
  });

  it('refuses a URL that is not public, or not of its scheme', async () => {
    for (const urls of [
      { rpcUrl: 'http://169.254.169.254/latest/meta-data' },
      { rpcUrl: 'http://localhost:9650/ext/bc/C/rpc' },
      { rpcUrl: 'http://10.0.0.4:3454/node_admin/relayers' },
      { rpcUrl: 'file:///etc/passwd' },
      { wsUrl: 'ws://127.0.0.1:9650/ext/bc/C/ws' },
      { wsUrl: 'ws://service.namespace.internal/ws' },
      { wsUrl: 'https://node.example.com/ws' },
    ]) {
      expect((await post({ configs: [{ ...config, ...urls }] })).status, JSON.stringify(urls)).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 429 past the daily cap, and calls no service', async () => {
    reserveDailyProvision.mockResolvedValue({ allowed: false, limit: 10, resetAt: new Date(), message: 'Daily limit reached' });
    const res = await post({ configs: [config] });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('a session with no account yet', () => {
  it('gets no managed relayer and no managed node', async () => {
    session.id = 'pending_a@example.com';
    expect((await post({ configs: [config] })).status).toBe(403);
    expect((await listNodes(new NextRequest('https://build.avax.network/api/managed-testnet-nodes'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
