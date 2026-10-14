import { beforeEach, describe, expect, it, vi } from 'vitest';

const { nodeFindFirst, nodeFindMany, nodeCreate, probeChainId, getTransaction, getTransactionReceipt } = vi.hoisted(
  () => ({
    nodeFindFirst: vi.fn(),
    nodeFindMany: vi.fn(),
    nodeCreate: vi.fn(),
    probeChainId: vi.fn(),
    getTransaction: vi.fn(),
    getTransactionReceipt: vi.fn(),
  }),
);

vi.mock('@/prisma/prisma', () => ({
  prisma: { nodeRegistration: { findFirst: nodeFindFirst, findMany: nodeFindMany, create: nodeCreate } },
}));
vi.mock('@/server/services/studio/chain', () => ({
  probeChainId,
  publicClient: () => ({ getTransaction, getTransactionReceipt }),
  rpcUrlOf: () => 'https://api.avax-test.network/ext/bc/C/rpc',
}));

import { MANAGED_NODES_PRODUCTION_URL } from '@/app/api/managed-testnet-nodes/constants';
import type { DeploymentJob } from '@/lib/quick-l1/types';
import { nodeIdFromHex } from '@/lib/studio/l1';
import {
  NODE_WAIT_LABEL,
  conversionTxOf,
  failureOf,
  quickL1Request,
  recoverLiveL1,
  recoveryNote,
  registerLaunchedNodes,
  stepsOf,
} from '@/server/services/studio/quick-l1';

const SUBNET = 'LdeszenEBG8vVBYYDrq5WhdUrmCMyZuGp19WXPpLmWg2TdhkE';
const CHAIN = 'tmVDT951HxwkZdHBv3M6rgQdmxxmAXb2YX17RRQJ2Bc4xi7Lb';
const MANAGER = '0x5555555555555555555555555555555555555555';
const REGISTRY = '0x6666666666666666666666666666666666666666';
const REMOTE = '0x7777777777777777777777777777777777777777';
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const tx = (h: string, chain: 'p-chain' | 'c-chain' | 'l1') => ({
  hash: h,
  chain,
  network: 'fuji' as const,
  timestamp: '2026-09-30T14:20:00Z',
});
const productionRpc = `${MANAGED_NODES_PRODUCTION_URL}/ext/bc/${CHAIN}/rpc`;

function relayerDown(overrides: Partial<DeploymentJob> = {}): DeploymentJob {
  return {
    jobId: 'job-1',
    status: 'failed',
    currentStep: 'starting-relayer',
    completedSteps: [
      'creating-subnet',
      'creating-chain',
      'converting-to-l1',
      'initializing-validator-set',
      'deploying-icm-registry',
      'deploying-token-remote',
    ],
    evidence: [
      { step: 'creating-subnet', txs: [tx(SUBNET, 'p-chain')] },
      { step: 'creating-chain', txs: [tx(CHAIN, 'p-chain')] },
      { step: 'initializing-validator-set', txs: [tx(hash(1), 'c-chain')] },
      { step: 'deploying-icm-registry', txs: [tx(hash(2), 'l1')] },
      { step: 'deploying-token-remote', txs: [tx(hash(3), 'l1')] },
    ],
    error: 'waitForRelayerHealthy: relayer 0xabc not healthy within 240000ms. health=null',
    request: {
      chainName: 'Moon Chain',
      tokenSymbol: 'MOON',
      ownerEvmAddress: MANAGER,
      network: 'fuji',
      enableManagedRelayer: true,
      userId: 'user-1',
    },
    createdAt: '2026-09-30T14:20:00Z',
    updatedAt: '2026-09-30T14:31:31Z',
    ...overrides,
  } as DeploymentJob;
}

beforeEach(() => {
  vi.clearAllMocks();
  nodeFindFirst.mockResolvedValue(null);
  probeChainId.mockImplementation(async (url: string) => (url === productionRpc ? 833760 : null));
  getTransaction.mockResolvedValue({ to: MANAGER });
  getTransactionReceipt.mockImplementation(async ({ hash: h }: { hash: string }) => ({
    contractAddress: h === hash(2) ? REGISTRY : REMOTE,
  }));
});

describe('recoverLiveL1', () => {
  it("rebuilds the chain from the service's transactions and the managed node that serves it", async () => {
    const recovered = await recoverLiveL1('user-1', relayerDown());
    expect(recovered).toEqual({
      subnetId: SUBNET,
      blockchainId: CHAIN,
      evmChainId: 833760,
      rpcUrl: productionRpc,
      validatorManagerAddress: MANAGER,
      nodeId: null,
      interop: { icmRegistryAddress: REGISTRY, tokenRemoteAddress: REMOTE },
    });
    expect(getTransaction).toHaveBeenCalledWith({ hash: hash(1) });
    expect(nodeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'user-1', blockchain_id: CHAIN, status: 'active' } }),
    );
  });

  it("prefers the builder's registered node over the service hosts", async () => {
    const registered = `https://nodes.example/ext/bc/${CHAIN}/rpc`;
    nodeFindFirst.mockResolvedValue({ rpc_url: registered, node_id: 'NodeID-abc' });
    probeChainId.mockResolvedValue(833760);
    expect(await recoverLiveL1('user-1', relayerDown())).toMatchObject({ rpcUrl: registered, nodeId: 'NodeID-abc' });
  });

  it('gives up when no managed node answers for the chain', async () => {
    probeChainId.mockResolvedValue(null);
    expect(await recoverLiveL1('user-1', relayerDown())).toBeNull();
  });

  it('recovers a failure at any step after the chain was converted, keeping what did not deploy empty', async () => {
    getTransactionReceipt.mockResolvedValue(null);
    const registryTimedOut = relayerDown({
      currentStep: 'deploying-icm-registry',
      completedSteps: ['creating-subnet', 'creating-chain', 'converting-to-l1', 'initializing-validator-set'],
      evidence: relayerDown().evidence.slice(0, 3),
      error: 'L1 RPC not ready within 180000ms: HTTP request failed. Status: 404',
    });
    expect(await recoverLiveL1('user-1', registryTimedOut)).toMatchObject({
      blockchainId: CHAIN,
      evmChainId: 833760,
      interop: { icmRegistryAddress: null, tokenRemoteAddress: null },
    });
  });

  it('does not recover a chain that was never converted', async () => {
    expect(
      await recoverLiveL1(
        'user-1',
        relayerDown({ currentStep: 'converting-to-l1', completedSteps: ['creating-subnet', 'creating-chain'] }),
      ),
    ).toBeNull();
    expect(await recoverLiveL1('user-1', relayerDown({ status: 'running' }))).toBeNull();
    expect(probeChainId).not.toHaveBeenCalled();
  });

  it('will not build an RPC URL from an ID that is not CB58', async () => {
    const job = relayerDown();
    job.evidence[1] = { step: 'creating-chain', txs: [tx('../../admin', 'p-chain')] };
    expect(await recoverLiveL1('user-1', job)).toBeNull();
    expect(probeChainId).not.toHaveBeenCalled();
  });
});

describe('failureOf', () => {
  it("says a relayer failure left the L1 running and keeps the service's report", () => {
    const message = failureOf(relayerDown());
    expect(message).toContain('created and converted your L1');
    expect(message).toContain('"Starting ICM Relayer"');
    expect(message).toContain('health=null');
  });

  it('names the step for a failure before the chain exists', () => {
    expect(
      failureOf(
        relayerDown({
          currentStep: 'converting-to-l1',
          completedSteps: ['creating-subnet'],
          error: 'insufficient funds',
        }),
      ),
    ).toBe('Quick L1 stopped at "Converting Subnet to L1": insufficient funds');
  });

  it('says the L1 exists when a later setup step failed', () => {
    const message = failureOf(relayerDown({ currentStep: 'deploying-icm-registry', error: 'L1 RPC not ready' }));
    expect(message).toContain('created and converted your L1');
    expect(message).toContain('"Deploying ICM Registry (L1)"');
    expect(message).toContain('L1 RPC not ready');
  });
});

describe('stepsOf', () => {
  it('marks each step done, current or pending, and leaves out what the options switch off', () => {
    const job = relayerDown({
      status: 'running',
      currentStep: 'deploying-icm-registry',
      completedSteps: ['creating-subnet', 'creating-chain', 'converting-to-l1', 'initializing-validator-set'],
      request: { ...relayerDown().request, enableManagedRelayer: false },
    });
    const steps = stepsOf(job);
    expect(steps.find((s) => s.label === 'Creating Subnet')?.status).toBe('done');
    expect(steps.find((s) => s.label === 'Verifying L1 is Ready')?.status).toBe('pending');
    expect(steps.map((s) => s.label)).not.toContain('Starting ICM Relayer');
    expect(steps.map((s) => s.label)).not.toContain('Deploying ICM Registry (L1)');
    expect(steps.map((s) => s.label)).not.toContain('Configuring ERC20 PoS (C-Chain)');
  });

  it('shows the step a failed job stopped at as failed, and the others as they stood', () => {
    const steps = stepsOf(
      relayerDown({
        currentStep: 'deploying-icm-registry',
        completedSteps: ['creating-subnet', 'creating-chain', 'converting-to-l1', 'initializing-validator-set'],
      }),
    );
    expect(steps.find((s) => s.label === 'Deploying ICM Registry (L1)')?.status).toBe('failed');
    expect(steps.find((s) => s.label === 'Deploying TokenRemote (L1)')?.status).toBe('pending');
    expect(steps.filter((s) => s.status === 'current')).toHaveLength(0);
  });

  it('puts each transaction under the step that signed it, linking the ones the explorer serves', () => {
    const steps = stepsOf(relayerDown());
    expect(steps.find((s) => s.label === 'Creating Subnet')?.txs).toEqual([
      { label: null, chain: 'p-chain', hash: SUBNET, url: `/explorer/fuji/p-chain/tx/${SUBNET}` },
    ]);
    expect(steps.find((s) => s.label === 'Deploying ICM Registry (L1)')?.txs).toEqual([
      { label: null, chain: 'l1', hash: hash(2), url: null },
    ]);
    expect(steps.find((s) => s.label === 'Starting ICM Relayer')?.txs).toBeUndefined();
  });

  it('adds the node wait right before the step that failed on the new chain', () => {
    const labels = stepsOf(
      relayerDown({
        currentStep: 'deploying-icm-registry',
        completedSteps: ['creating-subnet', 'creating-chain', 'converting-to-l1', 'initializing-validator-set'],
      }),
      { waitingForNode: true },
    ).map((s) => `${s.label}:${s.status}`);
    const at = labels.indexOf(`${NODE_WAIT_LABEL}:current`);
    expect(at).toBeGreaterThan(-1);
    expect(labels[at + 1]).toBe('Deploying ICM Registry (L1):failed');
  });
});

describe('quickL1Request', () => {
  const base = {
    chainName: 'Moon Chain',
    tokenSymbol: 'MOON',
    ownerEvmAddress: MANAGER,
    validatorMode: { type: 'poa' },
  };

  it('sends real booleans when the plan saved them as strings, and leaves unset ones to the defaults', () => {
    const request = quickL1Request({
      ...base,
      precompiles: { nativeMinter: 'true', interoperability: true, feeManager: false, txAllowList: '' },
      enableManagedRelayer: 'true',
    });
    expect(request.precompiles).toEqual({ nativeMinter: true, interoperability: true, feeManager: false });
    expect(request.enableManagedRelayer).toBe(true);
  });

  it('names a value that is not a boolean instead of letting the service reject the whole request', () => {
    expect(() => quickL1Request({ ...base, precompiles: { nativeMinter: 'yes' } })).toThrow(
      'precompiles.nativeMinter must be true or false',
    );
  });

  it('still refuses a managed relayer without interoperability', () => {
    expect(() =>
      quickL1Request({ ...base, precompiles: { interoperability: 'false' }, enableManagedRelayer: true }),
    ).toThrow('needs interoperability');
  });
});

describe('registering the launch nodes', () => {
  const CONVERSION = '2WU8odit49mFm4wRdR1fSsChSNGoqMkBQ2PJRGQ2NaaoKgemiU';
  const KEY = `0x${'8e'.repeat(48)}`;
  const POP = `0x${'84'.repeat(96)}`;
  const launch = {
    subnetId: SUBNET,
    blockchainId: CHAIN,
    rpcUrl: productionRpc,
    chainName: 'Moon Chain',
    conversionTx: CONVERSION,
    launchedAt: new Date('2026-09-30T14:20:00Z'),
  };
  const pChainAnswers = (subnetID = SUBNET) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          result: {
            tx: {
              unsignedTx: {
                subnetID,
                validators: [
                  {
                    nodeID: '0x8ae94f763035879586b6e30364de1e1ada398a04',
                    signer: { publicKey: KEY, proofOfPossession: POP },
                  },
                ],
              },
            },
          },
        }),
      ),
    );

  it('prints a hex node id the way avalanchego does', () => {
    expect(nodeIdFromHex('0x8ae94f763035879586b6e30364de1e1ada398a04')).toMatch(/^NodeID-[1-9A-HJ-NP-Za-km-z]+$/);
    expect(nodeIdFromHex('0x1234')).toBeNull();
  });

  it('finds the conversion among the P-Chain transactions', () => {
    expect(
      conversionTxOf([
        { label: 'CreateSubnetTx', chain: 'p-chain', hash: SUBNET },
        { label: 'ConvertSubnetToL1Tx', chain: 'p-chain', hash: CONVERSION },
      ]),
    ).toBe(CONVERSION);
    expect(conversionTxOf([{ label: 'ConvertSubnetToL1Tx', chain: 'p-chain', hash: '../x' }])).toBeNull();
  });

  it("writes each validator of the conversion to the builder's nodes, with the 3-day expiry", async () => {
    pChainAnswers();
    nodeFindMany.mockResolvedValue([]);
    expect(await registerLaunchedNodes('user-1', launch)).toBe(1);
    expect(nodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user_id: 'user-1',
        subnet_id: SUBNET,
        blockchain_id: CHAIN,
        node_id: nodeIdFromHex('0x8ae94f763035879586b6e30364de1e1ada398a04'),
        public_key: KEY,
        proof_of_possession: POP,
        rpc_url: productionRpc,
        chain_name: 'Moon Chain',
        expires_at: new Date('2026-10-03T14:20:00Z'),
        status: 'active',
      }),
    });
    vi.unstubAllGlobals();
  });

  it('leaves nodes already listed alone, and ignores a conversion of another subnet', async () => {
    pChainAnswers();
    nodeFindMany.mockResolvedValue([{ node_id: nodeIdFromHex('0x8ae94f763035879586b6e30364de1e1ada398a04') }]);
    expect(await registerLaunchedNodes('user-1', launch)).toBe(0);
    pChainAnswers(CHAIN);
    expect(await registerLaunchedNodes('user-1', launch)).toBe(0);
    expect(nodeCreate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('recoveryNote', () => {
  it('lists what did not finish and warns about the relayer', () => {
    const note = recoveryNote(
      relayerDown({
        currentStep: 'deploying-icm-registry',
        completedSteps: [
          'creating-subnet',
          'reserving-relayer',
          'attaching-relayer',
          'creating-chain',
          'converting-to-l1',
          'initializing-validator-set',
        ],
      }),
    );
    expect(note).toContain('stopped at "Deploying ICM Registry (L1)"');
    expect(note).toContain('Not finished: Deploying ICM Registry (L1), Deploying TokenRemote (L1)');
    expect(note).toContain('Starting ICM Relayer');
    expect(note).toContain('Without its managed ICM relayer');
  });

  it('leaves relayer steps out when none was requested', () => {
    const job = relayerDown({
      currentStep: 'verifying-l1-bootstrap',
      request: { ...relayerDown().request, enableManagedRelayer: false },
    });
    const note = recoveryNote(job);
    expect(note).toContain('Not finished: Verifying L1 is Ready');
    expect(note.split('Service report')[0]).not.toContain('Relayer');
    expect(note).not.toContain('Without its managed');
  });
});
