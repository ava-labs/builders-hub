import { useContractActions } from '../useContractActions';
import { useWalletStore } from '../../../stores/walletStore';
import { useChainPublicClient } from '../../useChainPublicClient';
import ERC20TokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import type { StakingManagerSettings, RewardInfo } from '../types';

export interface ERC20TokenStakingManagerHook {
  // Read functions
  getStakingManagerSettings: () => Promise<StakingManagerSettings>;
  getStakingValidator: (validationID: string) => Promise<any>;
  getDelegatorInfo: (delegationID: string) => Promise<any>;
  valueToWeight: (value: bigint) => Promise<bigint>;
  weightToValue: (weight: bigint) => Promise<bigint>;
  erc20: () => Promise<string>;
  getValidatorRewardInfo: (validationID: string) => Promise<RewardInfo>;
  getDelegatorRewardInfo: (delegationID: string) => Promise<RewardInfo>;
  maximumDelegationFeeBips: () => Promise<number>;

  // Write functions - Validator operations
  initiateValidatorRegistration: (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: any,
    disableOwner: any,
    delegationFeeBips: number,
    minStakeDuration: bigint,
    stakeAmount: bigint,
    rewardRecipient: string,
  ) => Promise<string>;
  completeValidatorRegistration: (messageIndex: number, accessList?: any[]) => Promise<string>;
  initiateValidatorRemoval: (
    validationID: string,
    includeUptimeProof: boolean,
    messageIndex: number,
    accessList?: any[],
  ) => Promise<string>;
  completeValidatorRemoval: (messageIndex: number, accessList?: any[]) => Promise<string>;
  forceInitiateValidatorRemoval: (
    validationID: string,
    includeUptime: boolean,
    messageIndex: number,
    accessList?: any[],
  ) => Promise<string>;

  // Write functions - Delegator operations
  initiateDelegatorRegistration: (
    validationID: string,
    delegationAmount: bigint,
    rewardRecipient: string,
  ) => Promise<string>;
  completeDelegatorRegistration: (messageIndex: number, delegationID: string, accessList?: any[]) => Promise<string>;
  initiateDelegatorRemoval: (delegationID: string) => Promise<string>;
  completeDelegatorRemoval: (delegationID: string, messageIndex: number, accessList?: any[]) => Promise<string>;
  forceInitiateDelegatorRemoval: (
    delegationID: string,
    includeUptime: boolean,
    messageIndex: number,
  ) => Promise<string>;
  resendUpdateDelegator: (delegationID: string) => Promise<string>;

  // Write functions - Reward operations
  changeValidatorRewardRecipient: (validationID: string, rewardRecipient: string) => Promise<string>;
  changeDelegatorRewardRecipient: (delegationID: string, rewardRecipient: string) => Promise<string>;
  claimDelegationFees: (validationID: string) => Promise<string>;
  submitUptimeProof: (validationID: string, messageIndex: number, accessList?: any[]) => Promise<string>;

  // Write functions - Setup
  initialize: (settings: StakingManagerSettings, tokenAddress: string) => Promise<string>;

  // Gas estimation
  estimateInitialize: (settings: StakingManagerSettings, tokenAddress: string) => Promise<bigint>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Hook for interacting with ERC20TokenStakingManager contracts
 * @param contractAddress - The address of the ERC20TokenStakingManager contract
 * @param abi - Optional custom ABI (defaults to ERC20TokenStakingManager.json abi)
 */
export function useERC20TokenStakingManager(contractAddress: string | null, abi?: any): ERC20TokenStakingManagerHook {
  const contractAbi = abi ?? ERC20TokenStakingManagerAbi.abi;
  const contract = useContractActions(contractAddress, contractAbi);
  const { walletEVMAddress } = useWalletStore();
  const publicClient = useChainPublicClient();

  // Read functions
  const getStakingManagerSettings = () => contract.read('getStakingManagerSettings') as Promise<StakingManagerSettings>;

  const getStakingValidator = (validationID: string) => contract.read('getStakingValidator', [validationID]);

  const getDelegatorInfo = (delegationID: string) => contract.read('getDelegatorInfo', [delegationID]);

  const valueToWeight = (value: bigint) => contract.read('valueToWeight', [value]) as Promise<bigint>;

  const weightToValue = (weight: bigint) => contract.read('weightToValue', [weight]) as Promise<bigint>;

  const erc20 = () => contract.read('erc20') as Promise<string>;

  const getValidatorRewardInfo = (validationID: string): Promise<RewardInfo> =>
    contract.read('getValidatorRewardInfo', [validationID]).then((result) => {
      const [rewardRecipient, rewardAmount] = result as [string, bigint];
      return { rewardRecipient, rewardAmount };
    });

  const getDelegatorRewardInfo = (delegationID: string): Promise<RewardInfo> =>
    contract.read('getDelegatorRewardInfo', [delegationID]).then((result) => {
      const [rewardRecipient, rewardAmount] = result as [string, bigint];
      return { rewardRecipient, rewardAmount };
    });

  const maximumDelegationFeeBips = () => contract.read('MAXIMUM_DELEGATION_FEE_BIPS') as Promise<number>;

  // Write functions - Validator operations
  const initiateValidatorRegistration = (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: any,
    disableOwner: any,
    delegationFeeBips: number,
    minStakeDuration: bigint,
    stakeAmount: bigint,
    rewardRecipient: string,
  ) =>
    contract.write(
      'initiateValidatorRegistration',
      [
        nodeID,
        blsPublicKey,
        remainingBalanceOwner,
        disableOwner,
        delegationFeeBips,
        minStakeDuration,
        stakeAmount,
        rewardRecipient,
      ],
      'Initiate Validator Registration (ERC20 Staking)',
    );

  const completeValidatorRegistration = (messageIndex: number, accessList?: any[]) =>
    contract.write('completeValidatorRegistration', [messageIndex], 'Complete Validator Registration (ERC20 Staking)', {
      accessList,
    });

  const initiateValidatorRemoval = (
    validationID: string,
    includeUptimeProof: boolean,
    messageIndex: number,
    accessList?: any[],
  ) =>
    contract.write(
      'initiateValidatorRemoval',
      [validationID, includeUptimeProof, messageIndex],
      'Initiate Validator Removal (ERC20 Staking)',
      { accessList },
    );

  const completeValidatorRemoval = (messageIndex: number, accessList?: any[]) =>
    contract.write('completeValidatorRemoval', [messageIndex], 'Complete Validator Removal (ERC20 Staking)', {
      accessList,
    });

  const forceInitiateValidatorRemoval = (
    validationID: string,
    includeUptime: boolean,
    messageIndex: number,
    accessList?: any[],
  ) =>
    contract.write(
      'forceInitiateValidatorRemoval',
      [validationID, includeUptime, messageIndex],
      'Force Initiate Validator Removal (ERC20 Staking)',
      { accessList },
    );

  // Write functions - Delegator operations
  const initiateDelegatorRegistration = (validationID: string, delegationAmount: bigint, rewardRecipient: string) =>
    contract.write(
      'initiateDelegatorRegistration',
      [validationID, delegationAmount, rewardRecipient],
      'Initiate Delegator Registration (ERC20 Staking)',
    );

  const completeDelegatorRegistration = (messageIndex: number, delegationID: string, accessList?: any[]) =>
    contract.write(
      'completeDelegatorRegistration',
      [delegationID, messageIndex],
      'Complete Delegator Registration (ERC20 Staking)',
      { accessList },
    );

  const initiateDelegatorRemoval = (delegationID: string) =>
    contract.write('initiateDelegatorRemoval', [delegationID], 'Initiate Delegator Removal (ERC20 Staking)');

  const completeDelegatorRemoval = (delegationID: string, messageIndex: number, accessList?: any[]) =>
    contract.write(
      'completeDelegatorRemoval',
      [delegationID as `0x${string}`, messageIndex],
      'Complete Delegator Removal (ERC20 Staking)',
      { accessList },
    );

  const forceInitiateDelegatorRemoval = (delegationID: string, includeUptime: boolean, messageIndex: number) =>
    contract.write(
      'forceInitiateDelegatorRemoval',
      [delegationID, includeUptime, messageIndex],
      'Force Initiate Delegator Removal (ERC20 Staking)',
    );

  const resendUpdateDelegator = (delegationID: string) =>
    contract.write('resendUpdateDelegator', [delegationID], 'Resend Update Delegator (ERC20 Staking)');

  // Write functions - Reward operations
  const changeValidatorRewardRecipient = (validationID: string, rewardRecipient: string) =>
    contract.write(
      'changeValidatorRewardRecipient',
      [validationID, rewardRecipient],
      'Change Validator Reward Recipient',
    );

  const changeDelegatorRewardRecipient = (delegationID: string, rewardRecipient: string) =>
    contract.write(
      'changeDelegatorRewardRecipient',
      [delegationID, rewardRecipient],
      'Change Delegator Reward Recipient',
    );

  const claimDelegationFees = (validationID: string) =>
    contract.write('claimDelegationFees', [validationID], 'Claim Delegation Fees');

  const submitUptimeProof = (validationID: string, messageIndex: number, accessList?: any[]) =>
    contract.write('submitUptimeProof', [validationID, messageIndex], 'Submit Uptime Proof', { accessList });

  // Write functions - Setup
  const initialize = (settings: StakingManagerSettings, tokenAddress: string) =>
    contract.write('initialize', [settings, tokenAddress], 'Initialize ERC20 Token Staking Manager');

  // Gas estimation
  const estimateInitialize = async (settings: StakingManagerSettings, tokenAddress: string): Promise<bigint> => {
    if (!publicClient || !contractAddress || !walletEVMAddress) {
      throw new Error('Client not ready or contract not ready');
    }

    return await publicClient.estimateContractGas({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initialize',
      args: [settings, tokenAddress],
      account: walletEVMAddress as `0x${string}`,
    });
  };

  return {
    getStakingManagerSettings,
    getStakingValidator,
    getDelegatorInfo,
    valueToWeight,
    weightToValue,
    erc20,
    getValidatorRewardInfo,
    getDelegatorRewardInfo,
    maximumDelegationFeeBips,
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
    estimateInitialize,
    contractAddress,
    isReady: contract.isReady,
  };
}
