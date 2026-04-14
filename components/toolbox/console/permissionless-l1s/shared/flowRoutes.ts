/**
 * Centralized route mapping for permissionless L1 validator flows.
 * Used by useValidatorPreflight to suggest the correct flow when a user
 * is in the wrong one.
 */
export const FLOW_ROUTES = {
  stakeNative: '/console/permissionless-l1s/stake/native',
  stakeERC20: '/console/permissionless-l1s/stake/erc20',
  removeValidator: '/console/permissionless-l1s/remove-validator',
  removeValidatorUptime: '/console/permissionless-l1s/remove-validator-uptime',
  delegateNative: '/console/permissionless-l1s/delegate/native',
  delegateERC20: '/console/permissionless-l1s/delegate/erc20',
  removeDelegation: '/console/permissionless-l1s/remove-delegation',
  faucet: '/console/primary-network/faucet',
} as const;

export type FlowRouteKey = keyof typeof FLOW_ROUTES;

/**
 * Validator lifecycle statuses as defined in the ValidatorManager contract.
 *
 *   0 = Unknown
 *   1 = PendingAdded
 *   2 = Active
 *   3 = PendingRemoved
 *   4 = Completed
 *   5 = Invalidated
 */
type ValidatorStatus = 0 | 1 | 2 | 3 | 4 | 5;

export type CurrentFlow = 'register' | 'initiate-removal' | 'complete-removal' | 'complete-registration';

export interface FlowSuggestion {
  label: string;
  path: string;
}

/**
 * Get a suggestion for the correct flow based on the validator's on-chain
 * status and the flow the user is currently in.
 *
 * Returns null when:
 *  - The user is already in the correct flow
 *  - The validator status is terminal (Completed / Invalidated) with no action needed
 *  - The status is Unknown and no routing is possible
 */
export function getFlowSuggestion(status: ValidatorStatus, currentFlow: CurrentFlow): FlowSuggestion | null {
  if (currentFlow === 'register') {
    if (status === 2) {
      return { label: 'Go to Remove Validator', path: FLOW_ROUTES.removeValidator };
    }
    if (status === 3) {
      return { label: 'Complete Pending Removal', path: FLOW_ROUTES.removeValidator };
    }
    if (status === 1) {
      return { label: 'Complete Registration', path: FLOW_ROUTES.stakeNative };
    }
  }

  if (currentFlow === 'initiate-removal') {
    if (status === 1) {
      return { label: 'Complete Registration First', path: FLOW_ROUTES.stakeNative };
    }
    if (status === 3) {
      return { label: 'Complete Removal', path: FLOW_ROUTES.removeValidator };
    }
    // Status 4 (Completed) — already done, nothing to suggest
    if (status === 4) return null;
  }

  if (currentFlow === 'complete-removal') {
    if (status === 2) {
      return { label: 'Initiate Removal First', path: FLOW_ROUTES.removeValidator };
    }
    if (status === 1) {
      return { label: 'Complete Registration First', path: FLOW_ROUTES.stakeNative };
    }
  }

  if (currentFlow === 'complete-registration') {
    // Already active — no action needed
    if (status === 2) return null;
    if (status === 3) {
      return { label: 'Complete Removal', path: FLOW_ROUTES.removeValidator };
    }
  }

  return null;
}
