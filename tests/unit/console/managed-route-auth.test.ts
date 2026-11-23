import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The managed-node and L1 upgrade routes act on one account's nodes. Each one must
// refuse a signed-out caller, and must never read or change a node that another
// account owns, whatever subnet, node index or row id the caller sends.

type Row = Record<string, unknown>;

const { sessionMock, rows, service } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  rows: [] as Row[],
  service: {
    builderHubAddNode: vi.fn(),
    builderHubDeleteNode: vi.fn(async () => ({ deletedExternally: true })),
    builderHubGetUpgradeJson: vi.fn(async () => ({ upgradeJson: {}, exists: true })),
    builderHubWriteUpgradeJson: vi.fn(async () => ({ ok: true })),
    builderHubRestartManagedNode: vi.fn(async () => ({ ok: true })),
  },
}));

// A Prisma stand-in over `rows` that honors the filters these routes use:
// equality, `{ gt: Date }` and `{ not: null }`.
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const op = cond as { gt?: Date; not?: unknown };
      if ('gt' in op) return value instanceof Date && op.gt instanceof Date && value > op.gt;
      if ('not' in op) return value !== op.not;
      return false;
    }
    return value === cond;
  });
}

vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: sessionMock }));
vi.mock('@/lib/rateLimit', () => ({
  rateLimit: (handler: unknown) => handler,
  checkRateLimit: () => ({ allowed: true }),
}));
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    nodeRegistration: {
      findFirst: vi.fn(async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where))),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = rows.find((r) => matches(r, where));
        if (row) Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
  },
}));
vi.mock('@/app/api/managed-testnet-nodes/service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...service,
}));
vi.mock('@/lib/console/my-l1s', () => ({
  aggregateL1s: vi.fn(async (nodes: Row[]) => nodes.map((n) => ({ subnetId: n.subnet_id }))),
}));
// Create passes the chain lookup and the daily cap, so only its own ID checks can refuse a request.
vi.mock('@/components/toolbox/coreViem/utils/glacier', async () => {
  const { SUBNET_EVM_VM_ID } = await import('@/constants/console');
  return { getBlockchainInfo: vi.fn(async () => ({ vmId: SUBNET_EVM_VM_ID, blockchainName: 'test' })) };
});
vi.mock('@/server/services/provision-quota', () => ({
  reserveDailyProvision: vi.fn(async () => ({ allowed: true })),
  retryAfterSeconds: () => '1',
}));

const nodes = await import('@/app/api/managed-testnet-nodes/route');
const node = await import('@/app/api/managed-testnet-nodes/[subnetId]/[nodeIndex]/route');
const managed = await import('@/app/api/console/l1-upgrade/managed/route');
const restart = await import('@/app/api/console/l1-upgrade/managed/restart/route');
const myL1s = await import('@/app/api/console/my-l1s/route');
const { ManagedTestnetNodesServiceURLs } = await import('@/app/api/managed-testnet-nodes/constants');
const { validateSubnetId } = await import('@/app/api/managed-testnet-nodes/utils');

const OWNER = 'user-owner';
const OTHER = 'user-other';
const SUBNET = '2EhsmhGYMffVMk3cRG1vaQJGSbmw7krjv2dfXfpWa2ZNjEcGJL';
const CHAIN = 'yPsWyyCvzM5vkvwRHKxiXYRwAXAQMfgMd3mhKXnt1u1GEkfW4';
const BASE = 'https://build.avax.network';

const as = (userId: string | null) =>
  sessionMock.mockResolvedValue(userId ? { user: { id: userId, email: `${userId}@example.invalid` } } : null);
const req = (path: string, init?: { method?: string; body?: unknown }) =>
  new NextRequest(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body), headers: { 'content-type': 'application/json' } } : {}),
  });
const nodeParams = { params: Promise.resolve({ subnetId: SUBNET, nodeIndex: '1' }) };
const managedQuery = `/api/console/l1-upgrade/managed?subnetId=${SUBNET}&blockchainId=${CHAIN}`;
const managedBody = { subnetId: SUBNET, blockchainId: CHAIN, upgradeJson: { precompileUpgrades: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  rows.length = 0;
  rows.push({
    id: 'row-owner',
    user_id: OWNER,
    subnet_id: SUBNET,
    blockchain_id: CHAIN,
    node_index: 1,
    node_id: 'NodeID-owner',
    status: 'active',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 86_400_000),
  });
});

const ROUTES: Array<[string, () => Promise<Response>]> = [
  ['GET /api/managed-testnet-nodes', () => nodes.GET(req('/api/managed-testnet-nodes'))],
  ['POST /api/managed-testnet-nodes', () => nodes.POST(req('/api/managed-testnet-nodes', { method: 'POST', body: {} }))],
  ['DELETE /api/managed-testnet-nodes?id=', () => nodes.DELETE(req('/api/managed-testnet-nodes?id=row-owner', { method: 'DELETE' }))],
  ['GET /api/managed-testnet-nodes/{subnetId}/{nodeIndex}', () => node.GET(req('/x'), nodeParams)],
  ['DELETE /api/managed-testnet-nodes/{subnetId}/{nodeIndex}', () => node.DELETE(req('/x', { method: 'DELETE' }), nodeParams)],
  ['GET /api/console/l1-upgrade/managed', () => managed.GET(req(managedQuery))],
  ['POST /api/console/l1-upgrade/managed', () => managed.POST(req('/x', { method: 'POST', body: managedBody }))],
  ['POST /api/console/l1-upgrade/managed/restart', () => restart.POST(req('/x', { method: 'POST', body: managedBody }))],
  ['GET /api/console/my-l1s', () => myL1s.GET(req('/api/console/my-l1s'))],
];

describe('signed-out callers', () => {
  it.each(ROUTES)('%s answers 401 and calls no node service', async (_name, call) => {
    as(null);
    const res = await call();
    expect(res.status).toBe(401);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("another account's node", () => {
  beforeEach(() => as(OTHER));

  it('is not in the node list or the L1 list', async () => {
    expect(await (await nodes.GET(req('/api/managed-testnet-nodes'))).json()).toEqual({ nodes: [], total: 0 });
    expect(await (await myL1s.GET(req('/api/console/my-l1s'))).json()).toEqual({ l1s: [], total: 0 });
  });

  it('answers 404 by subnet and node index', async () => {
    expect((await node.GET(req('/x'), nodeParams)).status).toBe(404);
    expect((await node.DELETE(req('/x', { method: 'DELETE' }), nodeParams)).status).toBe(404);
  });

  it('answers 404 by row id', async () => {
    expect((await nodes.DELETE(req('/api/managed-testnet-nodes?id=row-owner', { method: 'DELETE' }))).status).toBe(404);
  });

  it('reads as not managed, and writes and restarts answer 404', async () => {
    expect(await (await managed.GET(req(managedQuery))).json()).toMatchObject({ managed: false, nodes: [] });
    expect((await managed.POST(req('/x', { method: 'POST', body: managedBody }))).status).toBe(404);
    expect((await restart.POST(req('/x', { method: 'POST', body: managedBody }))).status).toBe(404);
  });

  it('leaves the node untouched', async () => {
    await node.DELETE(req('/x', { method: 'DELETE' }), nodeParams);
    await nodes.DELETE(req('/api/managed-testnet-nodes?id=row-owner', { method: 'DELETE' }));
    await managed.POST(req('/x', { method: 'POST', body: managedBody }));
    await restart.POST(req('/x', { method: 'POST', body: managedBody }));
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('active');
  });
});

describe('the owner', () => {
  beforeEach(() => as(OWNER));

  it('lists and reads the node', async () => {
    expect((await (await nodes.GET(req('/api/managed-testnet-nodes'))).json()).total).toBe(1);
    expect((await myL1s.GET(req('/api/console/my-l1s'))).status).toBe(200);
    const res = await node.GET(req('/x'), nodeParams);
    expect(res.status).toBe(200);
    expect((await res.json()).node.id).toBe('row-owner');
  });

  it('reads, writes and restarts the managed L1', async () => {
    expect(await (await managed.GET(req(managedQuery))).json()).toMatchObject({ managed: true });
    expect((await managed.POST(req('/x', { method: 'POST', body: managedBody }))).status).toBe(200);
    expect((await restart.POST(req('/x', { method: 'POST', body: managedBody }))).status).toBe(200);
    expect(service.builderHubRestartManagedNode).toHaveBeenCalledWith({ subnetId: SUBNET, nodeIndex: 1 });
  });

  it('deletes the node', async () => {
    expect((await node.DELETE(req('/x', { method: 'DELETE' }), nodeParams)).status).toBe(200);
    expect(service.builderHubDeleteNode).toHaveBeenCalledWith(SUBNET, 1);
    expect(rows[0].status).toBe('terminated');
  });
});

// The node service keys a node on (subnet, node index) and reuses a freed slot. A
// registration that is terminated or expired no longer holds its slot, so it must not
// reach the service: another account can hold that slot by then.
describe('a stale registration for a slot that another account now holds', () => {
  const stale = (patch: Row) => rows.push({ ...rows[0], id: 'row-stale', user_id: OTHER, ...patch });
  const byId = () => nodes.DELETE(req('/api/managed-testnet-nodes?id=row-stale', { method: 'DELETE' }));
  beforeEach(() => as(OTHER));

  it.each<[string, Row]>([
    ['a terminated row', { status: 'terminated' }],
    ['an expired row', { expires_at: new Date(Date.now() - 1000) }],
  ])('delete by row id of %s calls no node service', async (_name, patch) => {
    stale(patch);
    const res = await byId();
    expect(res.status).toBe(200);
    expect((await res.json()).deletedExternally).toBe(false);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    expect(rows.map((r) => r.status)).toEqual(['active', 'terminated']);
  });

  it('delete by subnet and node index of an expired row calls no node service', async () => {
    stale({ expires_at: new Date(Date.now() - 1000) });
    const res = await node.DELETE(req('/x', { method: 'DELETE' }), nodeParams);
    expect(res.status).toBe(200);
    expect((await res.json()).deletedExternally).toBe(false);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
    expect(rows.map((r) => r.status)).toEqual(['active', 'terminated']);
  });

  it('a live row still deletes the node in the node service', async () => {
    rows[0].user_id = OTHER;
    const res = await nodes.DELETE(req('/api/managed-testnet-nodes?id=row-owner', { method: 'DELETE' }));
    expect((await res.json()).deletedExternally).toBe(true);
    expect(service.builderHubDeleteNode).toHaveBeenCalledWith(SUBNET, 1);
  });
});

// Subnet and blockchain IDs go into the node service URL path. A value with dot
// segments would leave the node's own path, so only base58 text may pass.
describe('ids that go into the node service URL', () => {
  const NOT_AN_ID = [
    `../../relayers/reserve/${'./'.repeat(9)}`,
    `%2e%2e/%2e%2e/relayers/reserve?${'a'.repeat(10)}`,
    `%252e%252e/%252e%252e/relayers/reserve/x`,
    `${SUBNET}/../x`,
    `${SUBNET}?x`,
    ` ${SUBNET}`,
  ];
  const create = (body: Row) => nodes.POST(req('/api/managed-testnet-nodes', { method: 'POST', body }));
  beforeEach(() => as(OWNER));

  it('accepts a CB58 ID', () => {
    expect(validateSubnetId(SUBNET)).toBe(true);
    expect(validateSubnetId(CHAIN)).toBe(true);
  });

  it.each(NOT_AN_ID)('create refuses the subnet ID %j', async (subnetId) => {
    expect((await create({ subnetId, blockchainId: CHAIN })).status).toBe(400);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it.each(NOT_AN_ID)('create refuses the blockchain ID %j', async (blockchainId) => {
    expect((await create({ subnetId: SUBNET, blockchainId })).status).toBe(400);
    for (const fn of Object.values(service)) expect(fn).not.toHaveBeenCalled();
  });

  it.each(NOT_AN_ID)('the node routes refuse the subnet ID %j', async (subnetId) => {
    const params = { params: Promise.resolve({ subnetId, nodeIndex: '1' }) };
    expect((await node.GET(req('/x'), params)).status).toBe(400);
    expect((await node.DELETE(req('/x', { method: 'DELETE' }), params)).status).toBe(400);
  });

  it('a stored subnet ID cannot leave its path segment', () => {
    const { addNode, deleteNode, upgradeJson, restartNode } = ManagedTestnetNodesServiceURLs;
    const id = '../../relayers';
    const path = (url: string) => new URL(url).pathname;
    expect(path(addNode(id, CHAIN, null))).toBe('/node_admin/subnets/add/..%2F..%2Frelayers');
    expect(path(deleteNode(id, 1))).toBe('/node_admin/subnets/delete/..%2F..%2Frelayers/1');
    expect(path(upgradeJson(id, 1, CHAIN))).toBe('/node_admin/subnets/..%2F..%2Frelayers/1/upgrade-json');
    expect(path(restartNode(id, 1))).toBe('/node_admin/subnets/..%2F..%2Frelayers/1/restart');
  });
});
