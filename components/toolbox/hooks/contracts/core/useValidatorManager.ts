import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';

export interface PChainOwner {
  threshold: number;
  addresses: string[];
}

export interface ValidatorRegistrationParams {
  nodeID: string;
  blsPublicKey: string;
  remainingBalanceOwner: PChainOwner;
  disableOwner: PChainOwner;
  weight: bigint;
}

export interface ValidatorData {
  status: number;
  nodeID: string;
  startingWeight: bigint;
  sentNonce: bigint;
  receivedNonce: bigint;
  weight: bigint;
  startTime: bigint;
  endTime: bigint;
}

export interface ValidatorSetParams {
  subnetID: string;
  validatorManagerBlockchainID: string;
  validatorManagerAddress: string;
  initialValidators: Array<{
    nodeID: string;
    blsPublicKey: string;
    weight: bigint;
  }>;
}

export interface InitParams {
  settings: {
    admin: string;
    subnetID: string;
    churnPeriodSeconds: bigint;
    maximumChurnPercentage: number;
  };
}

export interface MigrationParams {
  validationID: string;
  receivedNonce: number;
}

export interface ValidatorManagerHook {
  // Read functions
  getValidator: (validationID: string) => Promise<ValidatorData>;
  owner: () => Promise<string>;
  l1TotalWeight: () => Promise<bigint>;
  subnetID: () => Promise<string>;
  isValidatorSetInitialized: () => Promise<boolean>;
  getNodeValidationID: (nodeID: string) => Promise<string>;

  // Write functions
  initiateValidatorRegistration: (params: ValidatorRegistrationParams) => Promise<string>;
  completeValidatorRegistration: (index: number, accessList?: any[]) => Promise<string>;
  resendRegisterValidatorMessage: (validationID: string) => Promise<string>;
  initiateValidatorRemoval: (validationID: string) => Promise<string>;
  completeValidatorRemoval: (index: number, accessList?: any[]) => Promise<string>;
  resendValidatorRemovalMessage: (validationID: string) => Promise<string>;
  initiateValidatorWeightUpdate: (validationID: string, weight: bigint) => Promise<string>;
  completeValidatorWeightUpdate: (index: number, accessList?: any[]) => Promise<string>;
  initializeValidatorSet: (params: ValidatorSetParams, messageIndex: number, accessList?: any[]) => Promise<string>;
  initialize: (params: InitParams) => Promise<string>;
  transferOwnership: (newOwner: string) => Promise<string>;
  migrateFromV1: (params: MigrationParams) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Hook for interacting with ValidatorManager contracts
 * @param contractAddress - The address of the ValidatorManager contract
 * @param abi - Optional custom ABI (defaults to ValidatorManager.json abi)
 */
export function useValidatorManager(
  contractAddress: string | null,
  abi?: any
): ValidatorManagerHook {
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();

  const contractAbi = abi ?? ValidatorManagerAbi.abi;
  const isReady = Boolean(contractAddress && avalancheWalletClient && viemChain);

  // Read functions
  const getValidator = async (validationID: string): Promise<ValidatorData> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    const result = await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getValidator',
      args: [validationID]
    });

    return result as ValidatorData;
  };

  const owner = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'owner',
      args: []
    }) as string;
  };

  const l1TotalWeight = async (): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'l1TotalWeight',
      args: []
    }) as bigint;
  };

  const subnetID = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'subnetID',
      args: []
    }) as string;
  };

  const isValidatorSetInitialized = async (): Promise<boolean> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'isValidatorSetInitialized',
      args: []
    }) as boolean;
  };

  const getNodeValidationID = async (nodeID: string): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getNodeValidationID',
      args: [nodeID]
    }) as string;
  };

  // Write functions
  const initiateValidatorRegistration = async (params: ValidatorRegistrationParams): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorRegistration',
      args: [
        params.nodeID,
        params.blsPublicKey,
        params.remainingBalanceOwner,
        params.disableOwner,
        params.weight
      ],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Registration'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeValidatorRegistration = async (index: number, accessList?: any[]): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorRegistration',
      args: [index],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = coreWalletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Registration'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const resendRegisterValidatorMessage = async (validationID: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'resendRegisterValidatorMessage',
      args: [validationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Resend Register Validator Message'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initiateValidatorRemoval = async (validationID: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorRemoval',
      args: [validationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Removal'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeValidatorRemoval = async (index: number, accessList?: any[]): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorRemoval',
      args: [index],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = coreWalletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Removal'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const resendValidatorRemovalMessage = async (validationID: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'resendValidatorRemovalMessage',
      args: [validationID],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Resend Validator Removal Message'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initiateValidatorWeightUpdate = async (validationID: string, weight: bigint): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorWeightUpdate',
      args: [validationID, weight],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Weight Update'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const completeValidatorWeightUpdate = async (index: number, accessList?: any[]): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorWeightUpdate',
      args: [index],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = coreWalletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Weight Update'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initializeValidatorSet = async (params: ValidatorSetParams, messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initializeValidatorSet',
      args: [params, messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = coreWalletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Initialize Validator Set'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initialize = async (params: InitParams): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initialize',
      args: [params.settings],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Initialize Validator Manager'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferOwnership = async (newOwner: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'transferOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer Validator Manager Ownership'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const migrateFromV1 = async (params: MigrationParams): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'migrateFromV1',
      args: [params.validationID as `0x${string}`, params.receivedNonce],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Migrate From V1'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions
    getValidator,
    owner,
    l1TotalWeight,
    subnetID,
    isValidatorSetInitialized,
    getNodeValidationID,

    // Write functions
    initiateValidatorRegistration,
    completeValidatorRegistration,
    resendRegisterValidatorMessage,
    initiateValidatorRemoval,
    completeValidatorRemoval,
    resendValidatorRemovalMessage,
    initiateValidatorWeightUpdate,
    completeValidatorWeightUpdate,
    initializeValidatorSet,
    initialize,
    transferOwnership,
    migrateFromV1,

    // Metadata
    contractAddress,
    isReady
  };
}
