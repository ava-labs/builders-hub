import { BRIDGE_PHASE_ORDER, type Bridge, type BridgePhase, type BridgeStatus, type Remote } from '../types';

export interface DeriveStatusInput {
  bridge: Bridge | null;
  remote: Remote | null;
  /** Activity events filtered to this (bridge, remote) pair. Used to detect
   *  in-progress writes that haven't yet reflected in the store. */
  pendingKinds?: Set<string>;
}

/**
 * Pure function: compute the per-phase status from the current bridge graph
 * and any in-flight activity. Has no side effects and no on-chain reads —
 * those are handled by `useBridgeState`, which calls into here.
 */
export function derivePhaseStatus({
  bridge,
  remote,
  pendingKinds,
}: DeriveStatusInput): Record<BridgePhase, BridgeStatus> {
  const pending = pendingKinds ?? new Set<string>();

  const tokenComplete = Boolean(bridge && (bridge.kind === 'native-home' || bridge.underlyingTokenAddress));
  const homeComplete = Boolean(bridge?.homeAddress);
  const remoteComplete = Boolean(remote?.address);
  const registerComplete = Boolean(remote?.registeredAt);
  const collateralComplete = Boolean(remote?.collateralizedAt || (bridge?.kind === 'native-home' && registerComplete));

  const phase = (complete: boolean, previousComplete: boolean, pendingKey: string): BridgeStatus => {
    if (complete) return 'complete';
    if (pending.has(pendingKey)) return 'in-progress';
    if (!previousComplete) return 'idle';
    return 'in-progress';
  };

  return {
    token: phase(tokenComplete, true, 'deploy-token'),
    home: phase(homeComplete, tokenComplete, 'deploy-home'),
    remote: phase(remoteComplete, homeComplete, 'deploy-remote'),
    register: phase(registerComplete, remoteComplete, 'register-sent'),
    collateral: phase(collateralComplete, registerComplete, 'collateral'),
    // Live is "complete" while the bridge is usable; otherwise it inherits
    // the readiness of collateral.
    live: collateralComplete ? 'complete' : phase(false, collateralComplete, 'send'),
  };
}

/**
 * Highest phase the user can navigate to without skipping a prerequisite.
 * Walks the canonical phase order and stops at the first non-complete phase
 * (which is the one that becomes the "current" phase).
 */
export function highestReachablePhase(status: Record<BridgePhase, BridgeStatus>): BridgePhase {
  let highest: BridgePhase = BRIDGE_PHASE_ORDER[0];
  for (const phase of BRIDGE_PHASE_ORDER) {
    highest = phase;
    if (status[phase] !== 'complete') break;
  }
  return highest;
}
