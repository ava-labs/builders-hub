import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export type IcmPhase = 'messenger' | 'registry' | 'relayer' | 'demo' | 'live';

export const ICM_PHASE_ORDER: readonly IcmPhase[] = ['messenger', 'registry', 'relayer', 'demo', 'live'] as const;

export type IcmPhaseStatus = 'idle' | 'in-progress' | 'complete' | 'error';

export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type L1Id = string;

export interface IcmChainStatus {
  l1Id: L1Id;
  /** ms timestamp when Messenger was confirmed deployed (via bytecode probe or local deploy). */
  messengerDeployedAt: number | null;
  registryAddress: Address | null;
  demoAddress: Address | null;
}

export type RelayerMode = 'self-hosted' | 'managed';

export interface RelayerConfig {
  mode: RelayerMode;
  sources: L1Id[];
  destinations: L1Id[];
  /** Private key for the relayer signer. Persisted to localStorage so the
   *  user doesn't lose it on tab close. Optional — managed mode doesn't
   *  use a local key. */
  relayerKey: Hex | null;
  logLevel: 'info' | 'debug' | 'warn' | 'error';
  storageLocation: string;
  apiPort: number;
  processMissedBlocks: boolean;
  savedAt: number | null;
}

export type IcmActivityKind =
  | 'messenger-deploy'
  | 'registry-deploy'
  | 'relayer-config-saved'
  | 'demo-deploy'
  | 'message-sent'
  | 'message-delivered';

export type IcmActivityStatus = 'pending' | 'confirmed' | 'delivered' | 'failed';

export interface IcmActivityEvent {
  id: string;
  kind: IcmActivityKind;
  status: IcmActivityStatus;
  l1Id: L1Id;
  /** Counterpart chain for message events (sender ↔ receiver). */
  counterpartL1Id?: L1Id;
  txHash?: Hex;
  icmMessageId?: Hex;
  /** For paired send↔delivered events. */
  pairedWith?: string;
  label: string;
  sublabel?: string;
  createdAt: number;
  updatedAt: number;
}

export interface IcmContextValue {
  phase: IcmPhase;
  activeL1: L1ListItem | null;
  activeL1Status: IcmChainStatus | null;
  counterpartL1: L1ListItem | null;
  relayer: RelayerConfig;
  relayerSourceL1s: L1ListItem[];
  relayerDestinationL1s: L1ListItem[];
  /** Union of sources + destinations + chains with anything deployed. */
  relayerNetworkL1s: L1ListItem[];
  events: IcmActivityEvent[];
  highestReachablePhase: IcmPhase;
  migrationReady: boolean;
  setActiveL1: (l1Id: L1Id | null) => void;
  setCounterpartL1: (l1Id: L1Id | null) => void;
}

export const ICM_PHASE_LABEL: Record<IcmPhase, string> = {
  messenger: 'Messenger',
  registry: 'Registry',
  relayer: 'Relayer',
  demo: 'Demo',
  live: 'Live',
};

export const ICM_PHASE_DESCRIPTION: Record<IcmPhase, string> = {
  messenger: 'Deploy the Teleporter messenger contract on your L1',
  registry: 'Deploy the Teleporter registry that anchors versioned protocols',
  relayer: 'Configure a relayer to route messages between chains',
  demo: 'Deploy the ICM Demo contract on sender and receiver chains',
  live: 'Send and monitor cross-chain messages',
};

export function isValidIcmPhase(s: string): s is IcmPhase {
  return ICM_PHASE_ORDER.includes(s as IcmPhase);
}
