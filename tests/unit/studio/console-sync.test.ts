import { describe, expect, it } from 'vitest';
import type { DeploymentView } from '@/components/studio/api';
import { syncDeployedRegistry, syncLaunchedL1 } from '@/components/studio/console-sync';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';

const REGISTRY = '0x1111111111111111111111111111111111111111';
const MANAGER = '0x2222222222222222222222222222222222222222';
const REMOTE = '0x3333333333333333333333333333333333333333';
const RELAYER = '0x4444444444444444444444444444444444444444';

const SIGNED = [{ label: 'Convert subnet to L1', chain: 'P-Chain', hash: '2txHash', url: null }];

/** `evidence: null` leaves it off the step entirely, as in runs recorded before Studio stored it. */
function launch(
  outputs: Record<string, unknown>,
  { blueprintId = 'l1-quickstart', evidence = SIGNED as unknown[] | null } = {},
) {
  return {
    blueprintId,
    params: { chainName: 'Moon Chain', tokenSymbol: 'MOON' },
    steps: [
      { id: 'launch', kind: 'offchain', state: { status: 'done', outputs: { jobId: 'job-1' }, at: '' } },
      {
        id: 'wait-launch',
        kind: 'wait',
        state: { status: 'done', outputs, ...(evidence ? { evidence } : {}), at: '' },
      },
    ],
  } as unknown as DeploymentView;
}

const outputs = {
  blockchainId: '2moonChainBlockchainId',
  evmChainId: 555001,
  rpcUrl: 'https://nodes.example/ext/bc/2moon/rpc',
  subnetId: 'moonSubnetId',
  validatorManager: MANAGER,
  teleporterRegistry: REGISTRY,
  tokenRemote: REMOTE,
  relayer: RELAYER,
  explorerUrl: 'https://2moonchai.firn.gg',
};

const listed = () =>
  (getL1ListStore(true).getState().l1List as L1ListItem[]).filter((l) => l.id === outputs.blockchainId);

describe('syncDeployedRegistry', () => {
  const registryView = (state: Record<string, unknown>, blueprintId = 'l1-icm-setup') =>
    ({ blueprintId, steps: [{ id: 'deploy-registry', kind: 'deploy', state }] }) as unknown as DeploymentView;
  const chain = { ...outputs, blockchainId: '2registryChainId', evmChainId: 555010 };
  const listedChain = () =>
    (getL1ListStore(true).getState().l1List as L1ListItem[]).find((l) => l.id === chain.blockchainId);

  it("copies a registry deployed after launch into the console's L1 list and ICM stores", () => {
    syncLaunchedL1(launch({ ...chain, teleporterRegistry: null }, { evidence: SIGNED }));
    expect(listedChain()?.wellKnownTeleporterRegistryAddress).toBeFalsy();

    expect(syncDeployedRegistry(registryView({ status: 'done', address: REGISTRY, chainId: 555010 }))).toEqual({
      name: 'Moon Chain',
    });
    expect(listedChain()?.wellKnownTeleporterRegistryAddress).toBe(REGISTRY);
    expect(getToolboxStore(chain.blockchainId).getState().teleporterRegistryAddress).toBe(REGISTRY);
    expect(useIcmSetupStore.getState().chains[chain.blockchainId]?.registryAddress).toBe(REGISTRY);
    expect(useIcmSetupStore.getState().chains[chain.blockchainId]?.messengerDeployedAt).toBeGreaterThan(0);
  });

  it('does not replace a registry the console already has, or act on other blueprints and unfinished steps', () => {
    const other = '0x5555555555555555555555555555555555555555';
    expect(syncDeployedRegistry(registryView({ status: 'done', address: other, chainId: 555010 }))).toBeNull();
    expect(listedChain()?.wellKnownTeleporterRegistryAddress).toBe(REGISTRY);
    expect(
      syncDeployedRegistry(registryView({ status: 'done', address: other, chainId: 555010 }, 'usdc-checkout')),
    ).toBeNull();
    expect(syncDeployedRegistry(registryView({ status: 'sent', address: other, chainId: 555010 }))).toBeNull();
  });
});

describe('syncLaunchedL1', () => {
  it('adds a launched L1 to the console with its Validator Manager and interop addresses', () => {
    expect(syncLaunchedL1(launch(outputs))).toEqual({ added: true, name: 'Moon Chain', relayer: true });
    expect(listed()).toEqual([
      expect.objectContaining({
        name: 'Moon Chain',
        evmChainId: 555001,
        coinName: 'MOON',
        isTestnet: true,
        rpcUrl: outputs.rpcUrl,
        subnetId: 'moonSubnetId',
        validatorManagerAddress: MANAGER,
        wellKnownTeleporterRegistryAddress: REGISTRY,
        explorerUrl: outputs.explorerUrl,
      }),
    ]);
    expect(getToolboxStore(outputs.blockchainId).getState()).toMatchObject({
      teleporterRegistryAddress: REGISTRY,
      erc20TokenRemoteAddress: REMOTE,
    });
    expect(useIcmSetupStore.getState().chains[outputs.blockchainId]?.registryAddress).toBe(REGISTRY);
  });

  it('adds nothing twice and keeps what the builder changed', () => {
    getL1ListStore(true).getState().updateL1(555001, { name: 'Renamed by me' });
    expect(syncLaunchedL1(launch(outputs))).toEqual({ added: false, name: 'Moon Chain', relayer: true });
    expect(listed()).toHaveLength(1);
    expect(listed()[0].name).toBe('Renamed by me');
  });

  it('adds an L1 whose managed relayer never came up, and says it has none', () => {
    const kept = {
      ...outputs,
      blockchainId: '2keptChainBlockchainId',
      evmChainId: 555003,
      relayer: null,
      explorerUrl: null,
    };
    expect(syncLaunchedL1(launch(kept))).toEqual({ added: true, name: 'Moon Chain', relayer: false });
    expect(
      (getL1ListStore(true).getState().l1List as L1ListItem[]).find((l) => l.id === '2keptChainBlockchainId'),
    ).toMatchObject({
      evmChainId: 555003,
      wellKnownTeleporterRegistryAddress: REGISTRY,
    });
  });

  it('ignores anything that is not a finished Quick L1 launch', () => {
    expect(syncLaunchedL1(launch(outputs, { blueprintId: 'usdc-checkout' }))).toBeNull();
    expect(syncLaunchedL1(launch({ ...outputs, rpcUrl: '' }))).toBeNull();
  });

  it('ignores launches with no signed transactions on record, like the old simulated runs', () => {
    const simulated = { ...outputs, blockchainId: '2simulatedChain', evmChainId: 555002 };
    expect(syncLaunchedL1(launch(simulated, { evidence: null }))).toBeNull();
    expect(syncLaunchedL1(launch(simulated, { evidence: [] }))).toBeNull();
    expect((getL1ListStore(true).getState().l1List as L1ListItem[]).some((l) => l.id === '2simulatedChain')).toBe(
      false,
    );
  });
});
