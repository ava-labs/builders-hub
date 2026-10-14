import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import type { L1ListPatch } from '@/components/toolbox/stores/l1ListPatch';
import { getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { ICM_SETUP_BLUEPRINT, L1_BLUEPRINT, type DeploymentView } from './api';

/** Fuji C-Chain, where Quick L1 deploys the Validator Manager. */
const FUJI_C_CHAIN = 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp';

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

type ListState = {
  l1List: L1ListItem[];
  addL1: (item: L1ListItem) => void;
  updateL1: (evmChainId: number, patch: L1ListPatch) => void;
};

/**
 * Copies a registry that "Finish ICM on your L1" deployed into the console's
 * L1 list and ICM and ICTT stores, where the launch would have put it. Only
 * fills a registry the console doesn't have yet.
 */
export function syncDeployedRegistry(view: DeploymentView): { name: string } | null {
  if (view.blueprintId !== ICM_SETUP_BLUEPRINT) return null;
  const step = view.steps.find((s) => s.id === 'deploy-registry');
  const registry = text(step?.state?.address);
  const evmChainId = step?.state?.chainId;
  if (step?.state?.status !== 'done' || !registry || !evmChainId) return null;

  const list = getL1ListStore(true).getState() as ListState;
  const l1 = list.l1List.find((l) => l.evmChainId === evmChainId);
  if (!l1 || l1.wellKnownTeleporterRegistryAddress) return null;

  list.updateL1(evmChainId, { wellKnownTeleporterRegistryAddress: registry } as L1ListPatch);
  const icm = useIcmSetupStore.getState();
  // The messenger is preinstalled at genesis, so an L1 that reached this step already had one.
  icm.upsertChain(l1.id, {
    messengerDeployedAt: icm.chains[l1.id]?.messengerDeployedAt ?? Date.now(),
    registryAddress: registry as `0x${string}`,
  });
  const toolbox = getToolboxStore(l1.id).getState();
  if (!toolbox.teleporterRegistryAddress) toolbox.setTeleporterRegistryAddress(registry);
  return { name: l1.name };
}

/**
 * Puts an L1 that Studio launched through Quick L1 where the rest of the console
 * looks for it: the testnet L1 list (chain switcher, toolbox, My L1 details) and
 * the new chain's ICM and ICTT stores. Quick L1 registers the managed node and
 * relayer server-side on its own. Only fills gaps, so it never overwrites what
 * the builder changed in the console.
 */
export function syncLaunchedL1(view: DeploymentView): { added: boolean; name: string; relayer: boolean } | null {
  if (view.blueprintId !== L1_BLUEPRINT) return null;
  const launched = view.steps.find(
    (s) => s.kind === 'wait' && s.state?.status === 'done' && s.state.outputs?.rpcUrl,
  )?.state;
  // Launches recorded without the service's signed transactions may come from the old simulator.
  if (!launched?.evidence?.length) return null;
  const out = launched.outputs;
  const blockchainId = text(out?.blockchainId);
  const rpcUrl = text(out?.rpcUrl);
  const evmChainId = Number(out?.evmChainId);
  if (!out || !blockchainId || !rpcUrl || !Number.isInteger(evmChainId)) return null;

  const symbol = text(view.params.tokenSymbol) ?? 'TOKEN';
  const name = text(view.params.chainName) ?? `Chain ${evmChainId}`;
  const registry = text(out.teleporterRegistry);
  const item: L1ListItem = {
    id: blockchainId,
    name,
    rpcUrl,
    evmChainId,
    coinName: symbol,
    isTestnet: true,
    subnetId: text(out.subnetId) ?? '',
    wrappedTokenAddress: '',
    validatorManagerAddress: text(out.validatorManager) ?? '',
    validatorManagerBlockchainId: FUJI_C_CHAIN,
    logoUrl: '',
    wellKnownTeleporterRegistryAddress: registry,
    explorerUrl: text(out.explorerUrl),
    nativeCurrency: { name: symbol, symbol, decimals: 18 },
  };

  const list = getL1ListStore(true).getState() as ListState;
  const existing = list.l1List.find((l) => l.id === blockchainId);
  if (!existing) {
    list.addL1(item);
  } else {
    const current = existing as unknown as Record<string, unknown>;
    const gaps = Object.fromEntries(
      Object.entries(item).filter(([key, value]) => value !== undefined && value !== '' && !current[key]),
    );
    if (Object.keys(gaps).length > 0) list.updateL1(evmChainId, gaps as L1ListPatch);
  }

  if (registry) {
    const icm = useIcmSetupStore.getState();
    if (!icm.chains[blockchainId]?.registryAddress) {
      icm.upsertChain(blockchainId, { messengerDeployedAt: Date.now(), registryAddress: registry as `0x${string}` });
    }
  }
  const toolbox = getToolboxStore(blockchainId).getState();
  if (registry && !toolbox.teleporterRegistryAddress) toolbox.setTeleporterRegistryAddress(registry);
  const tokenRemote = text(out.tokenRemote);
  if (tokenRemote && !toolbox.erc20TokenRemoteAddress) toolbox.setErc20TokenRemoteAddress(tokenRemote);

  return { added: !existing, name, relayer: !!text(out.relayer) };
}
