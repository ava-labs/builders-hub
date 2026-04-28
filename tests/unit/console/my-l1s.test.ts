import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/toolbox/coreViem/utils/glacier', () => ({
  getBlockchainInfoForNetwork: vi.fn(),
}));

import { getBlockchainInfoForNetwork } from '@/components/toolbox/coreViem/utils/glacier';
import { aggregateL1s, type NodeRow } from '@/lib/console/my-l1s';

const glacierInfo = {
  createBlockTimestamp: 1,
  createBlockNumber: '1',
  blockchainId: 'blockchain-1',
  vmId: 'subnet-evm',
  subnetId: 'subnet-1',
  blockchainName: 'Glacier L1',
  evmChainId: 12345,
};

function makeNode(overrides: Partial<NodeRow>): NodeRow {
  return {
    id: 'node-row-1',
    user_id: 'user-1',
    subnet_id: 'subnet-1',
    blockchain_id: 'blockchain-1',
    node_id: 'NodeID-1',
    node_index: 0,
    rpc_url: 'https://rpc.example.com/ext/bc/blockchain-1/rpc',
    chain_name: 'Local L1',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    expires_at: new Date('2099-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('aggregateL1s', () => {
  beforeEach(() => {
    vi.mocked(getBlockchainInfoForNetwork).mockReset();
    vi.mocked(getBlockchainInfoForNetwork).mockResolvedValue(glacierInfo);
  });

  it('uses the latest active-node expiry for a live managed L1', async () => {
    const l1s = await aggregateL1s([
      makeNode({
        id: 'expired-node',
        node_id: 'NodeID-expired',
        node_index: 0,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: new Date('2026-01-04T00:00:00.000Z'),
      }),
      makeNode({
        id: 'fresh-node',
        node_id: 'NodeID-fresh',
        node_index: 1,
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        expires_at: new Date('2099-01-05T00:00:00.000Z'),
      }),
    ]);

    expect(l1s).toHaveLength(1);
    expect(l1s[0]).toMatchObject({
      status: 'active',
      expiresAt: '2099-01-05T00:00:00.000Z',
      chainName: 'Glacier L1',
      evmChainId: 12345,
    });
    expect(l1s[0].nodes.map((n) => [n.id, n.status])).toEqual([
      ['fresh-node', 'active'],
      ['expired-node', 'expired'],
    ]);
  });

  it('uses the latest historical expiry for a spun-down managed L1', async () => {
    const l1s = await aggregateL1s([
      makeNode({
        id: 'old-node',
        node_index: 0,
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        expires_at: new Date('2026-01-04T00:00:00.000Z'),
      }),
      makeNode({
        id: 'newer-expired-node',
        node_index: 1,
        created_at: new Date('2026-01-02T00:00:00.000Z'),
        expires_at: new Date('2026-01-05T00:00:00.000Z'),
      }),
    ]);

    expect(l1s).toHaveLength(1);
    expect(l1s[0]).toMatchObject({
      status: 'expired',
      expiresAt: '2026-01-05T00:00:00.000Z',
    });
    expect(l1s[0].nodes.every((n) => n.status === 'expired')).toBe(true);
  });

  it('falls back to NodeRegistration metadata when Glacier has not indexed the L1', async () => {
    vi.mocked(getBlockchainInfoForNetwork).mockRejectedValue(new Error('not indexed'));

    const l1s = await aggregateL1s([
      makeNode({
        chain_name: 'Fallback Chain',
        blockchain_id: 'brand-new-blockchain',
      }),
    ]);

    expect(l1s[0]).toMatchObject({
      blockchainId: 'brand-new-blockchain',
      evmChainId: null,
      chainName: 'Fallback Chain',
    });
  });
});
