import { useContractActions } from '../useContractActions';
import NativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import type { StakingManagerSettings } from '../types';

export type { StakingManagerSettings } from '../types';

export interface NativeTokenStakingManagerHook {
  // Read functions
  getStakingManagerSettings: () => Promise<StakingManagerSettings>;
  getStakingValidator: (validationID: string) => Promise<any>;
  getDelegatorInfo: (delegationID: string) => Promise<any>;
  valueToWeight: (value: bigint) => Promise<bigint>;
  weightToValue: (weight: bigint) => Promise<bigint>;

  // Write functions - Validator operations
  initiateValidatorRegistration: (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: any,
    disableOwner: any,
    delegationFeeBips: number,
    minStakeDuration: bigint,
    rewardRecipient: string,
    stakeAmount: bigint
  ) => Promise<string>;
  completeValidatorRegistration: (messageIndex: number, accessList?: any[]) => Promise<string>;
  initiateValidatorRemoval: (validationID: string) => Promise<string>;
  completeValidatorRemoval: (messageIndex: number, accessList?: any[]) => Promise<string>;
  forceInitiateValidatorRemoval: (validationID: string, includeUptime: boolean, messageIndex: number) => Promise<string>;

  // Write functions - Delegator operations
  initiateDelegatorRegistration: (validationID: string, rewardRecipient: string, delegationAmount: bigint) => Promise<string>;
  completeDelegatorRegistration: (messageIndex: number, delegationID: string, accessList?: any[]) => Promise<string>;
  initiateDelegatorRemoval: (delegationID: string) => Promise<string>;
  completeDelegatorRemoval: (delegationID: string, messageIndex: number, accessList?: any[]) => Promise<string>;
  forceInitiateDelegatorRemoval: (delegationID: string, includeUptime: boolean, messageIndex: number) => Promise<string>;
  resendUpdateDelegator: (delegationID: string) => Promise<string>;

  // Write functions - Reward operations
  changeValidatorRewardRecipient: (validationID: string, rewardRecipient: string) => Promise<string>;
  changeDelegatorRewardRecipient: (delegationID: string, rewardRecipient: string) => Promise<string>;
  claimDelegationFees: (validationID: string) => Promise<string>;
  submitUptimeProof: (validationID: string, messageIndex: number) => Promise<string>;

  // Write functions - Setup
  initialize: (settings: StakingManagerSettings) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Hook for interacting with NativeTokenStakingManager contracts
 * @param contractAddress - The address of the NativeTokenStakingManager contract
 * @param abi - Optional custom ABI (defaults to NativeTokenStakingManager.json abi)
 */
export function useNativeTokenStakingManager(
  contractAddress: string | null,
  abi?: any
): NativeTokenStakingManagerHook {
  const contract = useContractActions(contractAddress, abi ?? NativeTokenStakingManagerAbi.abi);

  // Read functions
  const getStakingManagerSettings = () =>
    contract.read('getStakingManagerSettings') as Promise<StakingManagerSettings>;

  const getStakingValidator = (validationID: string) =>
    contract.read('getStakingValidator', [validationID]);

  const getDelegatorInfo = (delegationID: string) =>
    contract.read('getDelegatorInfo', [delegationID]);

  const valueToWeight = (value: bigint) =>
    contract.read('valueToWeight', [value]) as Promise<bigint>;

  const weightToValue = (weight: bigint) =>
    contract.read('weightToValue', [weight]) as Promise<bigint>;

  // Write functions - Validator operations
  const initiateValidatorRegistration = (
    nodeID: string, blsPublicKey: string, remainingBalanceOwner: any, disableOwner: any,
    delegationFeeBips: number, minStakeDuration: bigint, rewardRecipient: string, stakeAmount: bigint
  ) => contract.write(
    'initiateValidatorRegistration',
    [nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, delegationFeeBips, minStakeDuration, rewardRecipient],
    'Initiate Validator Registration (Native Staking)',
    { value: stakeAmount }
  );

  const completeValidatorRegistration = (messageIndex: number, accessList?: any[]) =>
    contract.write('completeValidatorRegistration', [messageIndex], 'Complete Validator Registration (Native Staking)', { accessList });

  const initiateValidatorRemoval = (validationID: string) =>
    contract.write('initiateValidatorRemoval', [validationID], 'Initiate Validator Removal (Native Staking)');

  const completeValidatorRemoval = (messageIndex: number, accessList?: any[]) =>
    contract.write('completeValidatorRemoval', [messageIndex], 'Complete Validator Removal (Native Staking)', { accessList });

  const forceInitiateValidatorRemoval = (validationID: string, includeUptime: boolean, messageIndex: number) =>
    contract.write('forceInitiateValidatorRemoval', [validationID, includeUptime, messageIndex], 'Force Initiate Validator Removal (Native Staking)');

  // Write functions - Delegator operations
  const initiateDelegatorRegistration = (validationID: string, rewardRecipient: string, delegationAmount: bigint) =>
    contract.write('initiateDelegatorRegistration', [validationID, rewardRecipient], 'Initiate Delegator Registration (Native Staking)', { value: delegationAmount });

  const completeDelegatorRegistration = (messageIndex: number, delegationID: string, accessList?: any[]) =>
    contract.write('completeDelegatorRegistration', [delegationID, messageIndex], 'Complete Delegator Registration (Native Staking)', { accessList });

  const initiateDelegatorRemoval = (delegationID: string) =>
    contract.write('initiateDelegatorRemoval', [delegationID], 'Initiate Delegator Removal (Native Staking)');

  const completeDelegatorRemoval = (delegationID: string, messageIndex: number, accessList?: any[]) =>
    contract.write('completeDelegatorRemoval', [delegationID as `0x${string}`, messageIndex], 'Complete Delegator Removal (Native Staking)', { accessList });

  const forceInitiateDelegatorRemoval = (delegationID: string, includeUptime: boolean, messageIndex: number) =>
    contract.write('forceInitiateDelegatorRemoval', [delegationID, includeUptime, messageIndex], 'Force Initiate Delegator Removal (Native Staking)');

  const resendUpdateDelegator = (delegationID: string) =>
    contract.write('resendUpdateDelegator', [delegationID], 'Resend Update Delegator (Native Staking)');

  // Write functions - Reward operations
  const changeValidatorRewardRecipient = (validationID: string, rewardRecipient: string) =>
    contract.write('changeValidatorRewardRecipient', [validationID, rewardRecipient], 'Change Validator Reward Recipient');

  const changeDelegatorRewardRecipient = (delegationID: string, rewardRecipient: string) =>
    contract.write('changeDelegatorRewardRecipient', [delegationID, rewardRecipient], 'Change Delegator Reward Recipient');

  const claimDelegationFees = (validationID: string) =>
    contract.write('claimDelegationFees', [validationID], 'Claim Delegation Fees');

  const submitUptimeProof = (validationID: string, messageIndex: number) =>
    contract.write('submitUptimeProof', [validationID, messageIndex], 'Submit Uptime Proof');

  // Write functions - Setup
  const initialize = (settings: StakingManagerSettings) =>
    contract.write('initialize', [settings], 'Initialize Native Token Staking Manager');

  return {
    getStakingManagerSettings,
    getStakingValidator,
    getDelegatorInfo,
    valueToWeight,
    weightToValue,
    initiateValidatorRegistration,
    completeValidatorRegistration,
    initiateValidatorRemoval,
    completeValidatorRemoval,
    forceInitiateValidatorRemoval,
    initiateDelegatorRegistration,
    completeDelegatorRegistration,
    initiateDelegatorRemoval,
    completeDelegatorRemoval,
    forceInitiateDelegatorRemoval,
    resendUpdateDelegator,
    changeValidatorRewardRecipient,
    changeDelegatorRewardRecipient,
    claimDelegationFees,
    submitUptimeProof,
    initialize,
    contractAddress,
    isReady: contract.isReady,
  };
}
