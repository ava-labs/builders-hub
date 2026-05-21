import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

export type BridgePhase = 'token' | 'home' | 'remote' | 'register' | 'collateral' | 'live';

export const BRIDGE_PHASE_ORDER: readonly BridgePhase[] = [
  'token',
  'home',
  'remote',
  'register',
  'collateral',
  'live',
] as const;

export type BridgeStatus = 'idle' | 'in-progress' | 'complete' | 'error';

export type HomeKind = 'erc20-home' | 'native-home';
export type RemoteKind = 'erc20-remote' | 'native-remote';

export type BridgeId = `bridge-${string}`;
export type RemoteId = `remote-${string}`;

export type Address = `0x${string}`;

export interface Bridge {
  id: BridgeId;
  kind: HomeKind;
  homeL1Id: string;
  homeAddress: Address;
  /** ERC-20 underlying token (only for erc20-home). */
  underlyingTokenAddress?: Address;
  symbol?: string;
  decimals?: number;
  createdAt: number;
  /** Soft-deleted entries are hidden from the UI but kept for migration safety. */
  archivedAt?: number;
  remotes: Remote[];
}

export interface Remote {
  id: RemoteId;
  kind: RemoteKind;
  l1Id: string;
  address: Address;
  registeredAt?: number;
  collateralizedAt?: number;
  /** Optional last-seen native minter precompile flag for native-remote. */
  minterPrecompileActive?: boolean;
}

export type ActivityKind = 'deploy' | 'register-sent' | 'register-received' | 'collateral' | 'send' | 'receive' | 'icm';

/**
 * 4-state activity lifecycle:
 *   pending   — tx broadcast, awaiting source-chain receipt
 *   confirmed — source-chain receipt mined (locally final)
 *   delivered — paired destination event observed (cross-chain final)
 *   failed    — tx reverted or watcher gave up
 *
 * Only `send` and `register-sent` rows ever reach `delivered`. Standalone
 * activity (`deploy`, `collateral`) skips the delivered state — `confirmed`
 * is terminal for them. Paired receive rows (`receive`, `register-received`)
 * are created with `status: 'delivered'` directly.
 */
export type ActivityStatus = 'pending' | 'confirmed' | 'delivered' | 'failed';

export interface ActivityEvent {
  id: string;
  bridgeId: BridgeId;
  remoteId?: RemoteId;
  kind: ActivityKind;
  label: string;
  sublabel?: string;
  timestampMs: number;
  /** Chain on which the tx occurred (numeric EVM chainId or P-Chain id). */
  chainId?: string | number;
  txHash?: Address;
  icmMessageId?: string;
  status: ActivityStatus;
  /**
   * For paired send↔receive / register-sent↔register-received events.
   * Set on both sides when {@link useDeliveryWatcher} matches a destination
   * `ReceiveCrossChainMessage` to a pending source row.
   */
  pairedWith?: string;
}

/**
 * Aggregated state shape kept around for consumers that still reference
 * BridgePhase + BridgeStatus tuples. Originally returned by useBridgeState
 * (removed in the v2 cleanup) but the interface stays because
 * `derive-status.ts` still exposes the same shape via `derivePhaseStatus`.
 */
export interface BridgeState {
  homeL1: L1ListItem | null;
  remoteL1: L1ListItem | null;
  bridge: Bridge | null;
  remote: Remote | null;
  /** Computed per-phase status for the current (home, remote) pair. */
  phaseStatus: Record<BridgePhase, BridgeStatus>;
  /** Highest phase the user can reach without skipping prerequisites. */
  highestReachablePhase: BridgePhase;
  /** True while the initial on-chain reads are in flight. */
  isLoading: boolean;
  /** Last error from on-chain reads (best-effort, surfaced in UI). */
  error: Error | null;
  /** Manually re-fetch on-chain state (e.g. after a write). */
  refresh: () => void;
}

export const PHASE_LABEL: Record<BridgePhase, string> = {
  token: 'Token',
  home: 'Home',
  remote: 'Remote',
  register: 'Register',
  collateral: 'Collateral',
  live: 'Live',
};

export const PHASE_DESCRIPTION: Record<BridgePhase, string> = {
  token: 'Source token on the Home chain',
  home: 'TokenHome contract on the origin chain',
  remote: 'TokenRemote on a destination L1',
  register: 'Pair Remote ↔ Home over Interchain Messaging',
  collateral: 'Fund the bridge with the underlying token',
  live: 'Send tokens cross-chain',
};
