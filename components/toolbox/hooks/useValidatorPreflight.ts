import { useState, useEffect } from 'react';
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import ERC20TokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import NativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useBatchRead } from '@/components/toolbox/hooks/contracts/useBatchRead';
import type {
  ValidatorData,
  StakingManagerSettings,
  ValidatorChurnPeriod,
} from '@/components/toolbox/hooks/contracts/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Validator status enum values from the ValidatorManager contract.
 * Maps to `enum ValidatorStatus` in Solidity.
 */
export const ValidatorStatus = {
  Unknown: 0,
  PendingAdded: 1,
  Active: 2,
  PendingRemoved: 3,
  Completed: 4,
  Invalidated: 5,
} as const;

const STATUS_LABELS: Record<number, string> = {
  [ValidatorStatus.Unknown]: 'Unknown',
  [ValidatorStatus.PendingAdded]: 'Pending',
  [ValidatorStatus.Active]: 'Active',
  [ValidatorStatus.PendingRemoved]: 'Removing',
  [ValidatorStatus.Completed]: 'Completed',
  [ValidatorStatus.Invalidated]: 'Invalidated',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreflightCheck {
  /** Matches CheckRequirements icon states */
  status: 'met' | 'not_met' | 'loading' | 'blocked';
  /** Human-readable reason when not met */
  reason: string | null;
  /** Suggestion to navigate the user to the correct flow */
  suggestion: { label: string; path: string } | null;
}

export interface ValidatorPreflightResult {
  // Raw data
  status: number;
  statusLabel: string;
  validatorData: {
    weight: bigint;
    startTime: bigint;
    endTime: bigint;
    sentNonce: bigint;
    receivedNonce: bigint;
    startingWeight: bigint;
    nodeID: string;
  } | null;
  stakingData: {
    owner: string;
    delegationFeeBips: number;
    minStakeDuration: bigint;
    uptimeSeconds: bigint;
  } | null;
  existingValidationID: string | null;
  totalWeight: bigint;
  settings: StakingManagerSettings | null;
  churn: {
    remainingBudget: bigint;
    maxBudget: bigint;
    periodEndsAt: bigint;
    churnPeriodSeconds: bigint;
    maxChurnPercentage: number;
    period: ValidatorChurnPeriod | null;
  } | null;

  // Per-flow eligibility
  checks: {
    register: PreflightCheck;
    initiateRemoval: PreflightCheck;
    completeRemoval: PreflightCheck;
    completeRegistration: PreflightCheck;
  };

  isLoading: boolean;
  error: string | null;
}

export interface ValidatorPreflightInput {
  validationID?: string;
  nodeID?: string;
  stakingManagerAddress: string | null;
  validatorManagerAddress: string | null;
  walletAddress?: string;
  /** Which staking manager ABI to use for staking reads */
  stakingManagerType?: 'erc20' | 'native';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadingCheck(): PreflightCheck {
  return { status: 'loading', reason: null, suggestion: null };
}

function metCheck(): PreflightCheck {
  return { status: 'met', reason: null, suggestion: null };
}

function notMetCheck(reason: string, suggestion?: { label: string; path: string }): PreflightCheck {
  return { status: 'not_met', reason, suggestion: suggestion ?? null };
}

function blockedCheck(reason: string): PreflightCheck {
  return { status: 'blocked', reason, suggestion: null };
}

function deriveChecks(
  status: number,
  existingValidationID: string | null,
  stakingData: ValidatorPreflightResult['stakingData'],
  walletAddress: string | undefined,
  churn: ValidatorPreflightResult['churn'],
  totalWeight: bigint,
  validatorWeight: bigint,
  validatorData: ValidatorPreflightResult['validatorData'],
): ValidatorPreflightResult['checks'] {
  // Check for pending P-Chain operations (sentNonce > receivedNonce)
  const hasPendingPChainOp = validatorData && validatorData.sentNonce > validatorData.receivedNonce;

  return {
    register: deriveRegisterCheck(status, existingValidationID),
    initiateRemoval: hasPendingPChainOp
      ? notMetCheck(
          'There is a pending P-Chain operation for this validator (nonce mismatch). Complete the current operation before starting a new one. If you recently submitted a P-Chain transaction, wait for it to be confirmed.',
        )
      : deriveInitiateRemovalCheck(status, stakingData, walletAddress, churn, totalWeight, validatorWeight),
    completeRemoval: deriveCompleteRemovalCheck(status),
    completeRegistration: deriveCompleteRegistrationCheck(status),
  };
}

function deriveRegisterCheck(status: number, existingValidationID: string | null): PreflightCheck {
  // If no existing validation ID, the node is unregistered and can be registered
  if (!existingValidationID || existingValidationID === ZERO_BYTES32) {
    return metCheck();
  }

  // Node is already known; check its status
  if (status === ValidatorStatus.Active) {
    return notMetCheck('Node is already an active validator. Remove it first before re-registering.', {
      label: 'Go to Remove Validator',
      path: '/console/permissionless-l1s/remove-validator',
    });
  }

  if (status === ValidatorStatus.PendingRemoved) {
    return notMetCheck('Removal is in progress. Complete removal before re-registering.', {
      label: 'Complete Removal',
      path: '/console/permissionless-l1s/remove-validator',
    });
  }

  if (status === ValidatorStatus.PendingAdded) {
    return notMetCheck('Registration is pending. Complete the P-Chain registration step.', {
      label: 'Complete Registration',
      path: '/console/permissionless-l1s/stake',
    });
  }

  if (status === ValidatorStatus.Completed || status === ValidatorStatus.Invalidated) {
    // Node was previously removed or invalidated, can be re-registered
    return metCheck();
  }

  return metCheck();
}

function deriveInitiateRemovalCheck(
  status: number,
  stakingData: ValidatorPreflightResult['stakingData'],
  walletAddress: string | undefined,
  churn: ValidatorPreflightResult['churn'],
  totalWeight: bigint,
  validatorWeight: bigint,
): PreflightCheck {
  if (status !== ValidatorStatus.Active) {
    if (status === ValidatorStatus.PendingAdded) {
      return notMetCheck('Validator is still pending registration. Cannot remove yet.', {
        label: 'Complete Registration',
        path: '/console/permissionless-l1s/stake',
      });
    }
    if (status === ValidatorStatus.PendingRemoved) {
      return notMetCheck('Removal already initiated. Complete the removal.', {
        label: 'Complete Removal',
        path: '/console/permissionless-l1s/remove-validator',
      });
    }
    if (status === ValidatorStatus.Completed) {
      return notMetCheck('Validator has already been removed.');
    }
    if (status === ValidatorStatus.Invalidated) {
      return notMetCheck('Validator registration was invalidated.');
    }
    return blockedCheck('Validator is not active.');
  }

  // Check ownership (PoS only, when staking data is available)
  if (stakingData && walletAddress) {
    const isOwner = stakingData.owner.toLowerCase() === walletAddress.toLowerCase();
    if (!isOwner) {
      return notMetCheck(`Connected wallet is not the validator owner. Owner: ${stakingData.owner}`);
    }
  }

  // Check churn budget
  if (churn && churn.maxBudget > 0n && validatorWeight > 0n) {
    if (validatorWeight > churn.remainingBudget) {
      return notMetCheck(
        `Removing this validator (weight: ${validatorWeight}) exceeds the remaining churn budget (${churn.remainingBudget}). Wait for the next churn period.`,
      );
    }
  }

  return metCheck();
}

function deriveCompleteRemovalCheck(status: number): PreflightCheck {
  if (status === ValidatorStatus.PendingRemoved) {
    return metCheck();
  }

  if (status === ValidatorStatus.Active) {
    return notMetCheck('Removal has not been initiated yet. Initiate removal first.', {
      label: 'Initiate Removal',
      path: '/console/permissionless-l1s/remove-validator',
    });
  }

  if (status === ValidatorStatus.PendingAdded) {
    return notMetCheck('Validator is still pending registration, not pending removal.', {
      label: 'Complete Registration',
      path: '/console/permissionless-l1s/stake',
    });
  }

  if (status === ValidatorStatus.Completed) {
    return notMetCheck('Validator has already been fully removed.');
  }

  if (status === ValidatorStatus.Invalidated) {
    return notMetCheck('Validator registration was invalidated.');
  }

  return blockedCheck('Validator status is unknown.');
}

function deriveCompleteRegistrationCheck(status: number): PreflightCheck {
  if (status === ValidatorStatus.PendingAdded) {
    return metCheck();
  }

  if (status === ValidatorStatus.Active) {
    return notMetCheck('Validator is already active. No registration to complete.');
  }

  if (status === ValidatorStatus.PendingRemoved) {
    return notMetCheck('Validator is pending removal, not pending registration.', {
      label: 'Complete Removal',
      path: '/console/permissionless-l1s/remove-validator',
    });
  }

  if (status === ValidatorStatus.Completed) {
    return notMetCheck('Validator was previously removed. Register again to create a new validation.');
  }

  if (status === ValidatorStatus.Invalidated) {
    return notMetCheck('Validator registration was invalidated. Register again to create a new validation.');
  }

  return blockedCheck('Validator status is unknown. Provide a valid validation ID.');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const defaultResult: ValidatorPreflightResult = {
  status: ValidatorStatus.Unknown,
  statusLabel: 'Unknown',
  validatorData: null,
  stakingData: null,
  existingValidationID: null,
  totalWeight: 0n,
  settings: null,
  churn: null,
  checks: {
    register: loadingCheck(),
    initiateRemoval: loadingCheck(),
    completeRemoval: loadingCheck(),
    completeRegistration: loadingCheck(),
  },
  isLoading: false,
  error: null,
};

/**
 * Core preflight hook. Reads all validator on-chain state via deployless
 * multicall (single RPC call) and returns structured readiness checks
 * for every console flow.
 *
 * @param input - Validator identifiers and contract addresses
 */
export function useValidatorPreflight(input: ValidatorPreflightInput): ValidatorPreflightResult {
  const {
    validationID,
    nodeID,
    stakingManagerAddress,
    validatorManagerAddress,
    walletAddress,
    stakingManagerType = 'native',
  } = input;

  const publicClient = useChainPublicClient();
  const batchRead = useBatchRead(publicClient);

  const [result, setResult] = useState<ValidatorPreflightResult>(defaultResult);

  useEffect(() => {
    let cancelled = false;

    const fetchPreflight = async () => {
      // Need at least one identifier and one contract address
      if (!validatorManagerAddress || (!validationID && !nodeID)) {
        setResult({
          ...defaultResult,
          checks: {
            register: validatorManagerAddress ? metCheck() : blockedCheck('No validator manager address'),
            initiateRemoval: blockedCheck('No validator identifier provided'),
            completeRemoval: blockedCheck('No validator identifier provided'),
            completeRegistration: blockedCheck('No validator identifier provided'),
          },
        });
        return;
      }

      if (!publicClient) {
        setResult({
          ...defaultResult,
          error: 'Public client not available',
          checks: {
            register: blockedCheck('Chain not connected'),
            initiateRemoval: blockedCheck('Chain not connected'),
            completeRemoval: blockedCheck('Chain not connected'),
            completeRegistration: blockedCheck('Chain not connected'),
          },
        });
        return;
      }

      setResult((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        checks: {
          register: loadingCheck(),
          initiateRemoval: loadingCheck(),
          completeRemoval: loadingCheck(),
          completeRegistration: loadingCheck(),
        },
      }));

      try {
        const vmcAddr = validatorManagerAddress as `0x${string}`;
        const stakingAbi =
          stakingManagerType === 'erc20' ? ERC20TokenStakingManagerAbi.abi : NativeTokenStakingManagerAbi.abi;
        const smAddr = (stakingManagerAddress ?? validatorManagerAddress) as `0x${string}`;

        // Build the batch of reads
        const contracts = [
          // [0] getNodeValidationID — resolve nodeID to validationID
          ...(nodeID
            ? [
                {
                  address: vmcAddr,
                  abi: ValidatorManagerAbi.abi,
                  functionName: 'getNodeValidationID' as const,
                  args: [nodeID],
                },
              ]
            : []),
          // [1 or 0] getValidator — read validator struct
          ...(validationID || nodeID
            ? [
                {
                  address: vmcAddr,
                  abi: ValidatorManagerAbi.abi,
                  functionName: 'getValidator' as const,
                  args: [validationID ?? ZERO_BYTES32], // placeholder if using nodeID; re-read below
                },
              ]
            : []),
          // [next] l1TotalWeight
          {
            address: vmcAddr,
            abi: ValidatorManagerAbi.abi,
            functionName: 'l1TotalWeight' as const,
          },
          // [next] getChurnTracker
          {
            address: vmcAddr,
            abi: ValidatorManagerAbi.abi,
            functionName: 'getChurnTracker' as const,
          },
          // [next] getStakingManagerSettings (may fail if PoA)
          {
            address: smAddr,
            abi: stakingAbi,
            functionName: 'getStakingManagerSettings' as const,
          },
        ];

        const batchResults = await batchRead(contracts);

        if (cancelled) return;

        // Parse results based on what was requested
        let offset = 0;

        // Parse getNodeValidationID result
        let resolvedValidationID = validationID ?? null;
        if (nodeID) {
          const nodeResult = batchResults[offset];
          if (nodeResult?.status === 'success' && nodeResult.result) {
            resolvedValidationID = nodeResult.result as string;
          }
          offset++;
        }

        // If we used a placeholder for getValidator and now have a resolved ID,
        // we need to re-read. For now, parse what we got.
        let validatorData: ValidatorPreflightResult['validatorData'] = null;
        let validatorStatus: number = ValidatorStatus.Unknown;

        if (validationID || nodeID) {
          const validatorResult = batchResults[offset];
          // Only parse if we used a real validationID (not a ZERO_BYTES32 placeholder).
          // When only nodeID was provided, the batch used a placeholder and the result
          // is meaningless — we'll do a follow-up read after resolving the nodeID.
          if (validationID && validatorResult?.status === 'success' && validatorResult.result) {
            const v = validatorResult.result as ValidatorData;
            validatorStatus = v.status;
            validatorData = {
              weight: v.weight,
              startTime: v.startTime,
              endTime: v.endTime,
              sentNonce: v.sentNonce,
              receivedNonce: v.receivedNonce,
              startingWeight: v.startingWeight,
              nodeID: v.nodeID,
            };
          }
          offset++;
        }

        // l1TotalWeight
        const weightResult = batchResults[offset];
        const totalWeight = weightResult?.status === 'success' ? (weightResult.result as bigint) : 0n;
        offset++;

        // getChurnTracker
        const churnResult = batchResults[offset];
        let churnData: ValidatorPreflightResult['churn'] = null;
        if (churnResult?.status === 'success' && churnResult.result) {
          const [churnPeriodSeconds, maxChurnPercentage, period] = churnResult.result as [
            bigint,
            number,
            ValidatorChurnPeriod,
          ];
          const maxBudget = maxChurnPercentage > 0 ? (period.initialWeight * BigInt(maxChurnPercentage)) / 100n : 0n;
          // Check if the churn period has expired — if so, budget resets to full
          const now = BigInt(Math.floor(Date.now() / 1000));
          const periodEnd = churnPeriodSeconds > 0n ? period.startTime + churnPeriodSeconds : 0n;
          const isWithinPeriod = periodEnd > 0n && now < periodEnd;
          const usedBudget = isWithinPeriod ? period.churnAmount : 0n;
          const remainingBudget = maxBudget > usedBudget ? maxBudget - usedBudget : 0n;
          churnData = {
            remainingBudget,
            maxBudget,
            periodEndsAt: churnPeriodSeconds > 0n ? period.startTime + churnPeriodSeconds : 0n,
            churnPeriodSeconds,
            maxChurnPercentage,
            period,
          };
        }
        offset++;

        // getStakingManagerSettings
        const settingsResult = batchResults[offset];
        const settings =
          settingsResult?.status === 'success' ? (settingsResult.result as StakingManagerSettings) : null;

        // Staking data — may be populated from follow-up batch or separate read
        let stakingData: ValidatorPreflightResult['stakingData'] = null;

        // If we resolved a new validationID via nodeID and had used a placeholder,
        // do a follow-up read for the actual validator data
        if (nodeID && resolvedValidationID && resolvedValidationID !== ZERO_BYTES32 && !validationID) {
          try {
            const followUpResults = await batchRead([
              {
                address: vmcAddr,
                abi: ValidatorManagerAbi.abi,
                functionName: 'getValidator',
                args: [resolvedValidationID],
              },
              // Also try staking validator data
              {
                address: smAddr,
                abi: stakingAbi,
                functionName: 'getStakingValidator',
                args: [resolvedValidationID],
              },
            ]);

            if (cancelled) return;

            if (followUpResults[0]?.status === 'success' && followUpResults[0].result) {
              const v = followUpResults[0].result as ValidatorData;
              validatorStatus = v.status;
              validatorData = {
                weight: v.weight,
                startTime: v.startTime,
                endTime: v.endTime,
                sentNonce: v.sentNonce,
                receivedNonce: v.receivedNonce,
                startingWeight: v.startingWeight,
                nodeID: v.nodeID,
              };
            }

            // Also parse the staking data from the same batch (avoid redundant RPC)
            if (followUpResults[1]?.status === 'success' && followUpResults[1].result) {
              const sv = followUpResults[1].result as {
                owner: string;
                delegationFeeBips: number;
                minStakeDuration: bigint;
                uptimeSeconds: bigint;
              };
              stakingData = {
                owner: sv.owner,
                delegationFeeBips: sv.delegationFeeBips,
                minStakeDuration: sv.minStakeDuration,
                uptimeSeconds: sv.uptimeSeconds,
              };
            }
          } catch {
            // Follow-up read failed; proceed with what we have
          }
        }

        // Get staking data if not already loaded from the follow-up batch
        const effectiveValidationID = resolvedValidationID ?? validationID;
        if (!stakingData && effectiveValidationID && effectiveValidationID !== ZERO_BYTES32 && stakingManagerAddress) {
          try {
            const stakingResults = await batchRead([
              {
                address: smAddr,
                abi: stakingAbi,
                functionName: 'getStakingValidator',
                args: [effectiveValidationID],
              },
            ]);

            if (cancelled) return;

            if (stakingResults[0]?.status === 'success' && stakingResults[0].result) {
              const sv = stakingResults[0].result as {
                owner: string;
                delegationFeeBips: number;
                minStakeDuration: bigint;
                uptimeSeconds: bigint;
              };
              stakingData = {
                owner: sv.owner,
                delegationFeeBips: sv.delegationFeeBips,
                minStakeDuration: sv.minStakeDuration,
                uptimeSeconds: sv.uptimeSeconds,
              };
            }
          } catch {
            // Staking read failed; may be PoA, which is fine
          }
        }

        if (cancelled) return;

        const existingValidationID =
          resolvedValidationID && resolvedValidationID !== ZERO_BYTES32 ? resolvedValidationID : null;

        const statusLabel = STATUS_LABELS[validatorStatus] ?? 'Unknown';
        const validatorWeight = validatorData?.weight ?? 0n;

        const checks = deriveChecks(
          validatorStatus,
          existingValidationID,
          stakingData,
          walletAddress,
          churnData,
          totalWeight,
          validatorWeight,
          validatorData,
        );

        setResult({
          status: validatorStatus,
          statusLabel,
          validatorData,
          stakingData,
          existingValidationID,
          totalWeight,
          settings,
          churn: churnData,
          checks,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        const errorMessage = err instanceof Error ? err.message : 'Failed to read validator state';
        setResult({
          ...defaultResult,
          isLoading: false,
          error: errorMessage,
          checks: {
            register: blockedCheck(errorMessage),
            initiateRemoval: blockedCheck(errorMessage),
            completeRemoval: blockedCheck(errorMessage),
            completeRegistration: blockedCheck(errorMessage),
          },
        });
      }
    };

    fetchPreflight();
    return () => {
      cancelled = true;
    };
  }, [
    validationID,
    nodeID,
    stakingManagerAddress,
    validatorManagerAddress,
    walletAddress,
    stakingManagerType,
    publicClient,
    batchRead,
  ]);

  return result;
}
