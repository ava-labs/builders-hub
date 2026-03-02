import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import { useWalletClient } from 'wagmi';
import NativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';

export interface StakingManagerSettings {
  manager: string;
  minimumStakeAmount: bigint;
  maximumStakeAmount: bigint;
  minimumStakeDuration: bigint;
  minimumDelegationFeeBips: number;
  maximumStakeMultiplier: number;
  weightToValueFactor: bigint;
  rewardCalculator: string;
  uptimeBlockchainID: string;
}

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
  completeDelegatorRegistration: (delegationID: string, messageIndex: number, accessList?: any[]) => Promise<string>;
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
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();
  const { data: walletClient } = useWalletClient();

  const contractAbi = abi ?? NativeTokenStakingManagerAbi.abi;
  const isReady = Boolean(contractAddress && avalancheWalletClient && viemChain);

  // Read functions
  const getStakingManagerSettings = async (): Promise<StakingManagerSettings> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    const result = await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getStakingManagerSettings',
      args: []
    });

    return result as StakingManagerSettings;
  };

  const getStakingValidator = async (validationID: string): Promise<any> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getStakingValidator',
      args: [validationID]
    });
  };

  const getDelegatorInfo = async (delegationID: string): Promise<any> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getDelegatorInfo',
      args: [delegationID]
    });
  };

  const valueToWeight = async (value: bigint): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'valueToWeight',
      args: [value]
    }) as bigint;
  };

  const weightToValue = async (weight: bigint): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'weightToValue',
      args: [weight]
    }) as bigint;
  };

  // Write functions - Validator operations
  const initiateValidatorRegistration = async (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: any,
    disableOwner: any,
    delegationFeeBips: number,
    minStakeDuration: bigint,
    rewardRecipient: string,
    stakeAmount: bigint
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorRegistration',
      args: [nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, delegationFeeBips, minStakeDuration, rewardRecipient],
      value: stakeAmount,
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Registration (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeValidatorRegistration = async (messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorRegistration',
      args: [messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = walletClient!.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Registration (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initiateValidatorRemoval = async (validationID: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorRemoval',
      args: [validationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeValidatorRemoval = async (messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorRemoval',
      args: [messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = walletClient!.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const forceInitiateValidatorRemoval = async (validationID: string, includeUptime: boolean, messageIndex: number): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'forceInitiateValidatorRemoval',
      args: [validationID, includeUptime, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Force Initiate Validator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  // Write functions - Delegator operations
  const initiateDelegatorRegistration = async (validationID: string, rewardRecipient: string, delegationAmount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateDelegatorRegistration',
      args: [validationID, rewardRecipient],
      value: delegationAmount,
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Delegator Registration (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeDelegatorRegistration = async (delegationID: string, messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeDelegatorRegistration',
      args: [delegationID, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = walletClient!.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Delegator Registration (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initiateDelegatorRemoval = async (delegationID: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateDelegatorRemoval',
      args: [delegationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Delegator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeDelegatorRemoval = async (delegationID: string, messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeDelegatorRemoval',
      args: [delegationID as `0x${string}`, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = walletClient!.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Delegator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const forceInitiateDelegatorRemoval = async (delegationID: string, includeUptime: boolean, messageIndex: number): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'forceInitiateDelegatorRemoval',
      args: [delegationID, includeUptime, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Force Initiate Delegator Removal (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const resendUpdateDelegator = async (delegationID: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'resendUpdateDelegator',
      args: [delegationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Resend Update Delegator (Native Staking)'
    }, writePromise, viemChain);

    return await writePromise;
  };

  // Write functions - Reward operations
  const changeValidatorRewardRecipient = async (validationID: string, rewardRecipient: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'changeValidatorRewardRecipient',
      args: [validationID, rewardRecipient],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Change Validator Reward Recipient'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const changeDelegatorRewardRecipient = async (delegationID: string, rewardRecipient: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'changeDelegatorRewardRecipient',
      args: [delegationID, rewardRecipient],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Change Delegator Reward Recipient'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const claimDelegationFees = async (validationID: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'claimDelegationFees',
      args: [validationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Claim Delegation Fees'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const submitUptimeProof = async (validationID: string, messageIndex: number): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'submitUptimeProof',
      args: [validationID, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Submit Uptime Proof'
    }, writePromise, viemChain);

    return await writePromise;
  };

  // Write functions - Setup
  const initialize = async (settings: StakingManagerSettings): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initialize',
      args: [settings],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initialize Native Token Staking Manager'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions
    getStakingManagerSettings,
    getStakingValidator,
    getDelegatorInfo,
    valueToWeight,
    weightToValue,

    // Write functions - Validator operations
    initiateValidatorRegistration,
    completeValidatorRegistration,
    initiateValidatorRemoval,
    completeValidatorRemoval,
    forceInitiateValidatorRemoval,

    // Write functions - Delegator operations
    initiateDelegatorRegistration,
    completeDelegatorRegistration,
    initiateDelegatorRemoval,
    completeDelegatorRemoval,
    forceInitiateDelegatorRemoval,
    resendUpdateDelegator,

    // Write functions - Reward operations
    changeValidatorRewardRecipient,
    changeDelegatorRewardRecipient,
    claimDelegationFees,
    submitUptimeProof,

    // Write functions - Setup
    initialize,

    // Metadata
    contractAddress,
    isReady
  };
}
