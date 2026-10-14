import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectFindFirst, projectFindUnique, projectUpdate } = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectFindUnique: vi.fn(),
  projectUpdate: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    studioProject: { findFirst: projectFindFirst, findUniqueOrThrow: projectFindUnique, update: projectUpdate },
  },
}));

import { markRelayerRunning, recordRegistry } from '@/server/services/studio/chain';

const MESSENGER = '0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf';
const REGISTRY = '0x4444444444444444444444444444444444444444';

const l1 = {
  name: 'Moon Chain',
  rpcUrl: 'https://l1.invalid',
  evmChainId: 555001,
  teleporter: { messenger: MESSENGER, registry: null },
  relayer: 'not-running',
};

const saved = () => projectUpdate.mock.calls[0][0].data.runtime as { testnet: { l1: Record<string, unknown> } };

beforeEach(() => {
  vi.clearAllMocks();
  projectFindFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1', runtime: { testnet: { l1 } } });
  projectFindUnique.mockResolvedValue({ id: 'proj-1', runtime: { testnet: { l1 } } });
});

describe('recordRegistry', () => {
  it('adds the registry to the bound L1 and keeps its messenger and everything else', async () => {
    await recordRegistry('proj-1', 'testnet', REGISTRY);
    expect(saved().testnet.l1).toMatchObject({
      name: 'Moon Chain',
      rpcUrl: 'https://l1.invalid',
      relayer: 'not-running',
      teleporter: { messenger: MESSENGER, registry: REGISTRY },
    });
  });

  it('does nothing when no L1 is bound for the stage', async () => {
    projectFindUnique.mockResolvedValue({ id: 'proj-1', runtime: {} });
    await recordRegistry('proj-1', 'testnet', REGISTRY);
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});

describe('markRelayerRunning', () => {
  it('clears the relayer mark and leaves the rest of the binding alone', async () => {
    await markRelayerRunning('user-1', 'proj-1', 'testnet');
    expect(saved().testnet.l1).not.toHaveProperty('relayer');
    expect(saved().testnet.l1).toMatchObject({
      name: 'Moon Chain',
      teleporter: { messenger: MESSENGER, registry: null },
    });
  });

  it('refuses when there is no L1 to mark, and for projects the caller does not own', async () => {
    projectFindFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1', runtime: {} });
    await expect(markRelayerRunning('user-1', 'proj-1', 'testnet')).rejects.toMatchObject({ status: 404 });
    projectFindFirst.mockResolvedValue(null);
    await expect(markRelayerRunning('user-2', 'proj-1', 'testnet')).rejects.toMatchObject({ status: 404 });
    expect(projectUpdate).not.toHaveBeenCalled();
  });
});
