import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeDeployData, encodeFunctionResult, parseAbi, toFunctionSelector } from 'viem';

const {
  projectFindFirst,
  deploymentFindFirst,
  deploymentUpdateMany,
  deploymentFindUnique,
  getTransaction,
  getTransactionReceipt,
  chainCall,
  recordRegistry,
  bindQuickL1Result,
  startQuickL1,
  quickL1Job,
  assertLaunchQuota,
  recoverLiveL1,
  findRelayer,
  markRelayerRunning,
} = vi.hoisted(() => ({
  findRelayer: vi.fn(),
  markRelayerRunning: vi.fn(),
  projectFindFirst: vi.fn(),
  deploymentFindFirst: vi.fn(),
  deploymentUpdateMany: vi.fn(),
  deploymentFindUnique: vi.fn(),
  getTransaction: vi.fn(),
  getTransactionReceipt: vi.fn(),
  chainCall: vi.fn(),
  recordRegistry: vi.fn(),
  bindQuickL1Result: vi.fn(),
  startQuickL1: vi.fn(),
  quickL1Job: vi.fn(),
  assertLaunchQuota: vi.fn(),
  recoverLiveL1: vi.fn(),
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    studioProject: { findFirst: projectFindFirst },
    studioDeployment: {
      findFirst: deploymentFindFirst,
      updateMany: deploymentUpdateMany,
      findUniqueOrThrow: deploymentFindUnique,
    },
  },
}));
vi.mock('@/server/services/studio/chain', () => ({
  publicClient: () => ({ getTransaction, getTransactionReceipt, call: chainCall }),
  rpcUrlOf: () => 'https://rpc.invalid',
  bindQuickL1Result,
  recordRegistry,
  markRelayerRunning,
}));
vi.mock('@/server/services/studio/relayers', () => ({ findRelayer }));
vi.mock('@/server/services/studio/quick-l1', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/services/studio/quick-l1')>()),
  startQuickL1,
  quickL1Job,
  assertLaunchQuota,
  recoverLiveL1,
}));

import { loadBlueprint, loadRegistry } from '@/lib/blueprints';
import { nextAction, reportStep, viewOf } from '@/server/services/studio/deployments';
import { StudioError } from '@/server/services/studio/errors';

const SIGNER = '0x1111111111111111111111111111111111111111';
const STORE = '0x2222222222222222222222222222222222222222';
const HASH = `0x${'ab'.repeat(32)}` as const;
const BYTECODE = '0x6080604052' as const;
const abi = parseAbi(['constructor(address usdc, address initialOwner)', 'function owner() view returns (address)']);
const usdc = loadRegistry().networks['fuji-c-chain'].tokens.USDC.address;
const deployData = encodeDeployData({ abi, bytecode: BYTECODE, args: [usdc as `0x${string}`, SIGNER] });

let saved: Record<string, unknown> = {};

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dep-1',
    project_id: 'proj-1',
    stage: 'testnet',
    status: 'running',
    blueprint_id: 'usdc-checkout',
    networks: { main: 'fuji-c-chain' },
    params: {},
    plan: { manifest: loadBlueprint('usdc-checkout').manifest, runtime: {} },
    steps: {},
    checks: [],
    signer: SIGNER,
    promotion_id: null,
    updated_at: new Date('2026-09-29T00:00:00Z'),
    build: { contracts: [{ file: 'contracts/USDCCheckout.sol', name: 'USDCCheckout', abi, bytecode: BYTECODE }] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saved = {};
  projectFindFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
  deploymentFindFirst.mockResolvedValue(deployment());
  deploymentUpdateMany.mockImplementation(async ({ data }) => {
    saved = data;
    return { count: 1 };
  });
  deploymentFindUnique.mockImplementation(async () => deployment({ steps: saved.steps, checks: saved.checks ?? [] }));
});

describe('reportStep', () => {
  it('records a deploy only from the receipt the server fetched', async () => {
    getTransaction.mockResolvedValue({ from: SIGNER, to: null, input: deployData, value: 0n, chainId: 43113 });
    getTransactionReceipt.mockResolvedValue({ status: 'success', contractAddress: STORE, blockNumber: 42n, logs: [] });

    const { status } = await reportStep('user-1', 'proj-1', 'dep-1', {
      kind: 'tx',
      stepId: 'deploy-checkout',
      txHash: HASH,
    });
    expect(status).toBe('done');
    const steps = saved.steps as Record<string, { status: string; address: string; blockNumber: string }>;
    expect(steps['deploy-checkout']).toMatchObject({ status: 'done', address: STORE, blockNumber: '42' });
  });

  it('rejects a transaction whose calldata differs from the prepared one', async () => {
    getTransaction.mockResolvedValue({ from: SIGNER, to: null, input: `${deployData}00`, value: 0n, chainId: 43113 });
    await expect(
      reportStep('user-1', 'proj-1', 'dep-1', { kind: 'tx', stepId: 'deploy-checkout', txHash: HASH }),
    ).rejects.toMatchObject({
      code: 'tx_mismatch',
    });
    expect(deploymentUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a transaction sent from another wallet', async () => {
    getTransaction.mockResolvedValue({ from: STORE, to: null, input: deployData, value: 0n, chainId: 43113 });
    await expect(
      reportStep('user-1', 'proj-1', 'dep-1', { kind: 'tx', stepId: 'deploy-checkout', txHash: HASH }),
    ).rejects.toBeInstanceOf(StudioError);
  });

  it('keeps a step pending until the chain has a receipt', async () => {
    getTransaction.mockResolvedValue({ from: SIGNER, to: null, input: deployData, value: 0n, chainId: 43113 });
    getTransactionReceipt.mockResolvedValue(null);
    const { status } = await reportStep('user-1', 'proj-1', 'dep-1', {
      kind: 'tx',
      stepId: 'deploy-checkout',
      txHash: HASH,
    });
    expect(status).toBe('pending');
    expect((saved.steps as Record<string, { status: string }>)['deploy-checkout'].status).toBe('sent');
  });

  it('will not mark a transaction step done without its transaction', async () => {
    await expect(
      reportStep('user-1', 'proj-1', 'dep-1', { kind: 'confirm', stepId: 'deploy-checkout' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses steps out of order and projects the caller does not own', async () => {
    await expect(
      reportStep('user-1', 'proj-1', 'dep-1', { kind: 'tx', stepId: 'list-product', txHash: HASH }),
    ).rejects.toMatchObject({
      code: 'out_of_order',
    });
    projectFindFirst.mockResolvedValue(null);
    await expect(
      reportStep('user-2', 'proj-1', 'dep-1', { kind: 'tx', stepId: 'deploy-checkout', txHash: HASH }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('waiting for an ICM message', () => {
  const MESSAGE = `0x${'77'.repeat(32)}`;
  const done = (extra: Record<string, unknown> = {}) => ({ status: 'done', at: '2026-09-30T00:00:00Z', ...extra });

  function waitingOnRegister(minutesAgo: number) {
    deploymentFindFirst.mockResolvedValue(
      deployment({
        blueprint_id: 'ictt-token-bridge',
        networks: { home: 'fuji-c-chain', remote: 'l1' },
        params: { token: STORE, remoteName: 'Moon', remoteSymbol: 'MOON' },
        plan: {
          manifest: loadBlueprint('ictt-token-bridge').manifest,
          runtime: {
            l1: {
              name: 'Moon Chain',
              rpcUrl: 'https://l1.invalid',
              evmChainId: 555001,
              blockchainIdHex: `0x${'cd'.repeat(32)}`,
            },
          },
        },
        steps: {
          'ensure-relayer': done(),
          'deploy-home': done({ address: STORE }),
          'deploy-remote': done({ address: SIGNER }),
          register: done({ outputs: { messageId: MESSAGE } }),
          'wait-register': { status: 'sent', at: new Date(Date.now() - minutesAgo * 60_000).toISOString() },
        },
        build: { contracts: [] },
      }),
    );
    chainCall.mockResolvedValue({ data: `0x${'0'.repeat(64)}` });
  }

  it('checks every 5 seconds before the timeout', async () => {
    waitingOnRegister(1);
    expect(await nextAction('user-1', 'proj-1', 'dep-1', SIGNER)).toMatchObject({
      kind: 'wait',
      stepId: 'wait-register',
      retryInMs: 5_000,
    });
  });

  it('keeps checking every 15 seconds after it, saying what delivery needs', async () => {
    waitingOnRegister(10);
    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(action).toMatchObject({ kind: 'wait', stepId: 'wait-register', retryInMs: 15_000 });
    expect((action as { detail: string }).detail).toContain('Not delivered after 5 minutes');
    expect((action as { detail: string }).detail).toContain('keeps checking every 15 seconds');
  });
});

describe('the plan a deployment shows', () => {
  const view = () => viewOf(deployment({ params: { productName: 'Hat' } }) as never);

  it('shows arguments as they will be signed, keeping references that only an earlier step can answer', () => {
    const steps = Object.fromEntries(view().steps.map((s) => [s.id, s.detail]));
    expect(steps['deploy-checkout']).toMatchObject({
      signer: 'deployer',
      contract: 'USDCCheckout',
      function: null,
      args: [usdc, SIGNER],
    });
    expect(steps['list-product']).toMatchObject({
      function: 'setProduct',
      target: '$out.deploy-checkout.address',
      args: ['1', 'Hat', '5000000', 'true'],
    });
    expect(steps['approve-test-purchase'].target).toBe(usdc);
  });

  it('lists parameters with where each value came from', () => {
    const params = Object.fromEntries(view().plan.params.map((p) => [p.name, p]));
    expect(params.productName).toMatchObject({ value: 'Hat', source: 'set' });
    expect(params.productPrice).toMatchObject({ value: '5000000', source: 'default' });
    expect(params.owner).toMatchObject({ value: SIGNER, source: 'default' });
  });

  it('carries what a builder should read before deploying', () => {
    const { plan } = view();
    const manifest = loadBlueprint('usdc-checkout').manifest;
    expect(plan.title).toBe(manifest.title);
    expect(plan.contracts.map((c) => c.name)).toContain('USDCCheckout');
    expect(plan.checks.length).toBeGreaterThan(0);
    expect(plan.review.length).toBeGreaterThan(0);
    expect(plan.prerequisites).toEqual(manifest.prerequisites);
  });
});

describe('finishing ICM on an L1', () => {
  const registryArtifact = loadBlueprint('l1-icm-setup');
  const messenger = loadRegistry().networks.l1.teleporter!.messenger as `0x${string}`;
  const REGISTRY = '0x4444444444444444444444444444444444444444';
  const L1_CHAIN = 555001;
  const artifact = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'contracts/icm-contracts/compiled/TeleporterRegistry.json'), 'utf8'),
  );
  const registryAbi = artifact.abi;
  const deployRegistry = encodeDeployData({
    abi: registryAbi,
    bytecode: `0x${artifact.bytecode.object.replace(/^0x/, '')}`,
    args: [[{ version: 1n, protocolAddress: messenger }]],
  });

  function setupDeployment() {
    const base = deployment({
      blueprint_id: 'l1-icm-setup',
      networks: { l1: 'l1', cchain: 'fuji-c-chain' },
      plan: {
        manifest: registryArtifact.manifest,
        runtime: {
          l1: {
            name: 'Moon Chain',
            rpcUrl: 'https://l1.invalid',
            evmChainId: L1_CHAIN,
            blockchainIdHex: `0x${'cd'.repeat(32)}`,
            teleporter: { messenger, registry: null },
          },
        },
      },
      build: { contracts: [] },
    });
    deploymentFindFirst.mockResolvedValue(base);
    deploymentFindUnique.mockImplementation(async () => ({ ...base, steps: saved.steps, checks: saved.checks ?? [] }));
    getTransaction.mockResolvedValue({ from: SIGNER, to: null, input: deployRegistry, value: 0n, chainId: L1_CHAIN });
    getTransactionReceipt.mockResolvedValue({
      status: 'success',
      contractAddress: REGISTRY,
      blockNumber: 7n,
      logs: [],
    });
  }

  const answers =
    (version: bigint, protocol: string) =>
    async ({ data }: { data: string }) => {
      const fn = data.startsWith(toFunctionSelector('latestVersion()')) ? 'latestVersion' : 'getAddressFromVersion';
      return {
        data: encodeFunctionResult({
          abi: registryAbi,
          functionName: fn,
          result: (fn === 'latestVersion' ? version : protocol) as never,
        }),
      };
    };

  it("records the registry on the project's L1 once its checks pass", async () => {
    setupDeployment();
    chainCall.mockImplementation(answers(1n, messenger));
    const { status } = await reportStep('user-1', 'proj-1', 'dep-1', {
      kind: 'tx',
      stepId: 'deploy-registry',
      txHash: HASH,
    });
    expect(status).toBe('done');
    expect(recordRegistry).toHaveBeenCalledWith('proj-1', 'testnet', REGISTRY);
  });

  it('does not record a registry whose checks fail', async () => {
    setupDeployment();
    chainCall.mockImplementation(answers(1n, '0x9999999999999999999999999999999999999999'));
    const { status } = await reportStep('user-1', 'proj-1', 'dep-1', {
      kind: 'tx',
      stepId: 'deploy-registry',
      txHash: HASH,
    });
    expect(status).toBe('done');
    expect(recordRegistry).not.toHaveBeenCalled();
  });
});

describe('nextAction with Quick L1', () => {
  const result = {
    subnetId: 'subnet-1',
    blockchainId: 'chain-1',
    evmChainId: 555001,
    rpcUrl: 'https://nodes.example/ext/bc/chain-1/rpc',
    validatorManagerAddress: STORE,
    nodeId: 'NodeID-1',
  };

  it('launches the L1, follows the job, and binds the result to the project', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    let current: Record<string, unknown> = deployment({
      blueprint_id: 'l1-quickstart',
      status: 'proposed',
      signer: null,
      networks: { primary: 'fuji-c-chain' },
      params: { chainName: 'Moon Chain', tokenSymbol: 'MOON' },
      plan: { manifest: loadBlueprint('l1-quickstart').manifest, runtime: {} },
      build: { contracts: [] },
    });
    deploymentFindFirst.mockImplementation(async () => current);
    deploymentFindUnique.mockImplementation(async () => current);
    deploymentUpdateMany.mockImplementation(async ({ data }) => {
      current = { ...current, ...data, updated_at: new Date() };
      return { count: 1 };
    });
    startQuickL1.mockResolvedValue('job-1');
    quickL1Job.mockResolvedValueOnce({
      status: 'running',
      currentStep: 'creating-chain',
      completedSteps: ['creating-subnet'],
      evidence: [],
    });

    const first = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(assertLaunchQuota).toHaveBeenCalledWith('user-1');
    expect(startQuickL1).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        chainName: 'Moon Chain',
        tokenSymbol: 'MOON',
        ownerEvmAddress: SIGNER,
        network: 'fuji',
      }),
    );
    expect(first).toMatchObject({ kind: 'wait', stepId: 'wait-launch' });
    expect((first as { progress: { label: string; status: string }[] }).progress).toEqual(
      expect.arrayContaining([
        { label: 'Creating Subnet', status: 'done' },
        { label: 'Creating Chain', status: 'current' },
        { label: 'Converting Subnet to L1', status: 'pending' },
      ]),
    );

    quickL1Job.mockResolvedValueOnce({
      status: 'complete',
      currentStep: null,
      completedSteps: ['creating-subnet', 'creating-chain'],
      evidence: [
        {
          step: 'creating-subnet',
          txs: [{ hash: '2xSubnetTx', chain: 'p-chain', network: 'fuji', timestamp: '2026-09-30T00:00:00Z' }],
        },
      ],
      result,
      request: { chainName: 'Moon Chain', tokenSymbol: 'MOON' },
    });
    const second = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(bindQuickL1Result).toHaveBeenCalledWith('proj-1', expect.objectContaining({ result }));
    expect(second).toEqual({ kind: 'done', status: 'succeeded' });
    const steps = current.steps as Record<
      string,
      { status: string; outputs: Record<string, unknown>; evidence?: { url: string | null }[] }
    >;
    expect(steps.launch.outputs).toEqual({ jobId: 'job-1' });
    expect(steps['wait-launch'].outputs).toMatchObject({
      rpcUrl: result.rpcUrl,
      evmChainId: 555001,
      teleporterRegistry: null,
    });
    expect(steps['wait-launch'].evidence).toEqual([
      expect.objectContaining({ chain: 'p-chain', hash: '2xSubnetTx', url: '/explorer/fuji/p-chain/tx/2xSubnetTx' }),
    ]);
    vi.unstubAllEnvs();
  });

  it('refuses to launch when the Quick L1 service is not connected', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', '');
    deploymentFindFirst.mockResolvedValue(
      deployment({
        blueprint_id: 'l1-quickstart',
        networks: { primary: 'fuji-c-chain' },
        params: { chainName: 'Moon Chain', tokenSymbol: 'MOON' },
        plan: { manifest: loadBlueprint('l1-quickstart').manifest, runtime: {} },
        build: { contracts: [] },
      }),
    );
    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(action).toMatchObject({ kind: 'blocked', stepId: 'launch' });
    expect((action as { detail: string }).detail).toContain('QUICK_L1_SERVICE_URL');
    expect(startQuickL1).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  const relayerDown = {
    status: 'failed',
    currentStep: 'starting-relayer',
    completedSteps: [
      'creating-subnet',
      'creating-chain',
      'converting-to-l1',
      'initializing-validator-set',
      'deploying-icm-registry',
    ],
    evidence: [
      {
        step: 'creating-subnet',
        txs: [{ hash: '2xSubnetTx', chain: 'p-chain', network: 'fuji', timestamp: '2026-09-30T00:00:00Z' }],
      },
    ],
    error: 'waitForRelayerHealthy: relayer 0xabc not healthy within 240000ms. health=null',
    request: { chainName: 'Moon Chain', tokenSymbol: 'MOON', enableManagedRelayer: true },
  };

  function waitingLaunch() {
    let current: Record<string, unknown> = deployment({
      blueprint_id: 'l1-quickstart',
      networks: { primary: 'fuji-c-chain' },
      params: { chainName: 'Moon Chain', tokenSymbol: 'MOON' },
      plan: { manifest: loadBlueprint('l1-quickstart').manifest, runtime: {} },
      steps: { launch: { status: 'done', outputs: { jobId: 'job-1' }, at: '2026-09-30T00:00:00Z' } },
      build: { contracts: [] },
    });
    deploymentFindFirst.mockImplementation(async () => current);
    deploymentFindUnique.mockImplementation(async () => current);
    deploymentUpdateMany.mockImplementation(async ({ data }) => {
      current = { ...current, ...data, updated_at: new Date() };
      return { count: 1 };
    });
    return () => current;
  }

  it('keeps the L1 and flags the relayer when only the managed relayer failed', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    const current = waitingLaunch();
    const recovered = {
      ...result,
      nodeId: null,
      interop: { icmRegistryAddress: '0x3333333333333333333333333333333333333333', tokenRemoteAddress: null },
    };
    quickL1Job.mockResolvedValueOnce(relayerDown);
    recoverLiveL1.mockResolvedValueOnce(recovered);

    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(recoverLiveL1).toHaveBeenCalledWith('user-1', relayerDown);
    expect(bindQuickL1Result).toHaveBeenCalledWith('proj-1', relayerDown, recovered);
    expect(action).toEqual({ kind: 'done', status: 'succeeded' });
    const wait = (
      current().steps as Record<
        string,
        { status: string; warning: string; outputs: Record<string, unknown>; evidence: unknown[] }
      >
    )['wait-launch'];
    expect(wait.status).toBe('done');
    expect(wait.warning).toContain('Without its managed ICM relayer');
    expect(wait.warning).toContain(relayerDown.error);
    expect(wait.outputs).toMatchObject({
      rpcUrl: result.rpcUrl,
      evmChainId: 555001,
      teleporterRegistry: recovered.interop.icmRegistryAddress,
      relayer: null,
    });
    expect(wait.evidence).toHaveLength(1);
    vi.unstubAllEnvs();
  });

  it('keeps the L1 when a setup step after conversion timed out, and finishes on Continue once it is reachable', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    const current = waitingLaunch();
    const registryTimedOut = {
      ...relayerDown,
      currentStep: 'deploying-icm-registry',
      completedSteps: [
        'creating-subnet',
        'reserving-relayer',
        'attaching-relayer',
        'creating-chain',
        'converting-to-l1',
        'initializing-validator-set',
      ],
      error: 'L1 RPC not ready within 180000ms: HTTP request failed. Status: 404',
    };
    quickL1Job.mockResolvedValue(registryTimedOut);

    recoverLiveL1.mockResolvedValueOnce(null);
    const first = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(first).toMatchObject({ kind: 'blocked', stepId: 'wait-launch' });
    expect((first as { detail: string }).detail).toContain('Continue checks the chain again');
    expect((current().steps as Record<string, { status: string }>)['wait-launch'].status).toBe('failed');

    recoverLiveL1.mockResolvedValueOnce({
      ...result,
      nodeId: null,
      interop: { icmRegistryAddress: null, tokenRemoteAddress: null },
    });
    const second = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(second).toEqual({ kind: 'done', status: 'succeeded' });
    const wait = (current().steps as Record<string, { status: string; warning: string }>)['wait-launch'];
    expect(wait.status).toBe('done');
    expect(wait.warning).toContain('stopped at "Deploying ICM Registry (L1)"');
    expect(wait.warning).toContain('Not finished: Deploying ICM Registry (L1)');
    expect(bindQuickL1Result).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });

  it('waits for the validator node after a post-conversion failure instead of stopping', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    const current = waitingLaunch();
    quickL1Job.mockResolvedValue({
      ...relayerDown,
      currentStep: 'deploying-icm-registry',
      completedSteps: ['creating-subnet', 'creating-chain', 'converting-to-l1', 'initializing-validator-set'],
      error: 'L1 RPC not ready within 180000ms: HTTP request failed. Status: 404',
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    recoverLiveL1.mockResolvedValueOnce(null);

    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(action).toMatchObject({ kind: 'wait', stepId: 'wait-launch', retryInMs: 10_000 });
    const progress = (action as { progress: { label: string; status: string }[] }).progress;
    expect(progress.find((s) => s.status === 'current')?.label).toBe('Waiting for the validator node to be healthy');
    expect((current().steps as Record<string, { status: string }>)['wait-launch'].status).not.toBe('failed');
    vi.unstubAllEnvs();
  });

  it("says the L1 is live when only the managed relayer failed and the chain can't be confirmed", async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    const current = waitingLaunch();
    const report = relayerDown.error;
    quickL1Job.mockResolvedValueOnce(relayerDown);
    recoverLiveL1.mockResolvedValueOnce(null);

    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(action).toMatchObject({ kind: 'blocked', stepId: 'wait-launch' });
    const detail = (action as { detail: string }).detail;
    expect(detail).toContain('created and converted your L1');
    expect(detail).toContain('"Starting ICM Relayer"');
    expect(detail).toContain(report);
    expect((current().steps as Record<string, { status: string; error: string }>)['wait-launch']).toMatchObject({
      status: 'failed',
      error: expect.stringContaining(report),
    });
    expect(bindQuickL1Result).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("tells ICM blueprints when the bound L1's relayer never came up", async () => {
    const l1 = {
      name: 'Moon Chain',
      rpcUrl: result.rpcUrl,
      evmChainId: 555001,
      blockchainIdHex: `0x${'cd'.repeat(32)}`,
      relayer: 'not-running',
    };
    const icm = (runtime: Record<string, unknown>) =>
      deployment({
        blueprint_id: 'icm-messenger',
        networks: { source: 'fuji-c-chain', destination: 'l1' },
        plan: { manifest: loadBlueprint('icm-messenger').manifest, runtime },
        build: { contracts: [] },
      });

    deploymentFindFirst.mockResolvedValueOnce(icm({ l1 }));
    const down = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(down).toMatchObject({ kind: 'manual', stepId: 'ensure-relayer', canConfirm: true });
    expect((down as { detail: string }).detail).toContain('Moon Chain never came up');

    deploymentFindFirst.mockResolvedValueOnce(icm({ l1: { ...l1, relayer: undefined } }));
    const fine = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect((fine as { detail: string }).detail).not.toContain('never came up');
  });

  describe('the relayer step', () => {
    const L1_ID = '2moonChainBlockchainIdAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const C_CHAIN = loadRegistry().networks['fuji-c-chain'].blockchainId!;
    const l1 = {
      name: 'Moon Chain',
      rpcUrl: result.rpcUrl,
      evmChainId: 555001,
      blockchainId: L1_ID,
      blockchainIdHex: `0x${'cd'.repeat(32)}`,
    };

    function relayerStep(binding: Record<string, unknown>) {
      let current: Record<string, unknown> = deployment({
        blueprint_id: 'icm-messenger',
        networks: { source: 'fuji-c-chain', destination: 'l1' },
        plan: { manifest: loadBlueprint('icm-messenger').manifest, runtime: { l1: binding } },
        build: { contracts: [] },
      });
      deploymentFindFirst.mockImplementation(async () => current);
      deploymentFindUnique.mockImplementation(async () => current);
      deploymentUpdateMany.mockImplementation(async ({ data }) => {
        current = { ...current, ...data, updated_at: new Date() };
        return { count: 1 };
      });
      return () => current;
    }

    it('finishes on its own when a healthy managed relayer serves both chains, and clears the L1 mark', async () => {
      const current = relayerStep({ ...l1, relayer: 'not-running' });
      findRelayer.mockResolvedValue({ status: 'serving', relayerId: '0xabc' });
      const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
      expect(findRelayer).toHaveBeenCalledWith('user-1', [C_CHAIN, L1_ID]);
      expect((current().steps as Record<string, { status: string }>)['ensure-relayer'].status).toBe('done');
      expect(action).not.toMatchObject({ stepId: 'ensure-relayer' });
      expect(markRelayerRunning).toHaveBeenCalledWith('user-1', 'proj-1', 'testnet');
    });

    it('says which chain is missing, and still lets a self-hosted relayer be confirmed', async () => {
      relayerStep(l1);
      findRelayer.mockResolvedValue({ status: 'missing', missing: [L1_ID] });
      const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
      expect(action).toMatchObject({ kind: 'manual', stepId: 'ensure-relayer', canConfirm: true });
      expect((action as { detail: string }).detail).toContain('None of your managed relayers serves Moon Chain');
      expect((action as { detail: string }).detail).toContain('mark this done');
      expect(markRelayerRunning).not.toHaveBeenCalled();
    });

    it('points at an unhealthy relayer', async () => {
      relayerStep(l1);
      findRelayer.mockResolvedValue({
        status: 'unhealthy',
        relayerId: '0x41f19468c694edca6142b5f9e216675661682337',
        unreachable: false,
      });
      const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
      expect((action as { detail: string }).detail).toContain('0x41f19468… serves both chains but is not healthy');
    });
  });

  it('stops with the reason when Quick L1 rejects the request', async () => {
    vi.stubEnv('QUICK_L1_SERVICE_URL', 'https://quick-l1.invalid');
    deploymentFindFirst.mockResolvedValue(
      deployment({
        blueprint_id: 'l1-quickstart',
        networks: { primary: 'fuji-c-chain' },
        params: { chainName: 'moon_chain!', tokenSymbol: 'MOON' },
        plan: { manifest: loadBlueprint('l1-quickstart').manifest, runtime: {} },
        build: { contracts: [] },
      }),
    );
    const action = await nextAction('user-1', 'proj-1', 'dep-1', SIGNER);
    expect(action).toMatchObject({ kind: 'blocked', stepId: 'launch' });
    expect((action as { detail: string }).detail).toContain('chain name');
    expect(startQuickL1).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
