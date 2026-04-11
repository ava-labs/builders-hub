import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useResolvedWalletClient } from '../../useResolvedWalletClient';
import PoAManagerAbi from '@/contracts/icm-contracts/compiled/PoAManager.json';
import { useChainPublicClient } from '../../useChainPublicClient';
import { parseContractError } from '../parseContractError';
import { PChainOwner, ValidatorData } from '../core/useValidatorManager';

export interface PoAManagerHook {
  // Read functions
  owner: () => Promise<string>;
  getValidator: (validationID: string) => Promise<ValidatorData>;

  // Write functions - PoA specific
  completeValidatorRegistration: (messageIndex: number, accessList?: any[]) => Promise<string>;
  completeValidatorRemoval: (messageIndex: number, accessList?: any[]) => Promise<string>;
  completeValidatorWeightUpdate: (messageIndex: number, accessList?: any[]) => Promise<string>;
  initiateValidatorRegistration: (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: PChainOwner,
    disableOwner: PChainOwner,
    weight: bigint
  ) => Promise<string>;
  initiateValidatorRemoval: (validationID: string) => Promise<string>;
  initiateValidatorWeightUpdate: (validationID: string, weight: bigint) => Promise<string>;
  transferOwnership: (newOwner: string) => Promise<string>;
  transferValidatorManagerOwnership: (newOwner: string) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
  isReadReady: boolean;
}

/**
 * Hook for interacting with PoAManager contracts (Proof of Authority Manager)
 * @param contractAddress - The address of the PoAManager contract
 * @param abi - Optional custom ABI (defaults to PoAManager.json abi)
 */
export function usePoAManager(
  contractAddress: string | null,
  abi?: any
): PoAManagerHook {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const walletClient = useResolvedWalletClient();
  const chainPublicClient = useChainPublicClient();

  const contractAbi = abi ?? PoAManagerAbi.abi;
  const isReady = Boolean(contractAddress && walletClient && viemChain);
  const isReadReady = Boolean(contractAddress && chainPublicClient);

  const write = async <T>(fn: () => Promise<T>): Promise<T> => {
    try { return await fn(); } catch (err) { throw new Error(parseContractError(err)); }
  };

  // Read functions
  const owner = async (): Promise<string> => {
    if (!chainPublicClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(chainPublicClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'owner',
      args: []
    }) as string;
  };

  const getValidator = async (validationID: string): Promise<ValidatorData> => {
    if (!chainPublicClient || !contractAddress) throw new Error('Contract not ready');

    const result = await readContract(chainPublicClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getValidator',
      args: [validationID]
    });

    return result as ValidatorData;
  };

  // Write functions
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

    const writePromise = walletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Registration'
    }, writePromise, viemChain);

    return await write(() => writePromise);
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

    const writePromise = walletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Removal'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const completeValidatorWeightUpdate = async (messageIndex: number, accessList?: any[]): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'completeValidatorWeightUpdate',
      args: [messageIndex],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    if (accessList) {
      txConfig.accessList = accessList;
    }

    const writePromise = walletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Complete Validator Weight Update'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const initiateValidatorRegistration = async (
    nodeID: string,
    blsPublicKey: string,
    remainingBalanceOwner: PChainOwner,
    disableOwner: PChainOwner,
    weight: bigint
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorRegistration',
      args: [nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, weight],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Registration (PoA)'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const initiateValidatorRemoval = async (validationID: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient.writeContract({
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
      name: 'Initiate Validator Removal (PoA)'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const initiateValidatorWeightUpdate = async (validationID: string, weight: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'initiateValidatorWeightUpdate',
      args: [validationID, weight],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Initiate Validator Weight Update (PoA)'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const transferOwnership = async (newOwner: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'transferOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer PoA Manager Ownership'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  const transferValidatorManagerOwnership = async (newOwner: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'transferValidatorManagerOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer Validator Manager Ownership (via PoA)'
    }, writePromise, viemChain);

    return await write(() => writePromise);
  };

  return {
    // Read functions
    owner,
    getValidator,

    // Write functions
    completeValidatorRegistration,
    completeValidatorRemoval,
    completeValidatorWeightUpdate,
    initiateValidatorRegistration,
    initiateValidatorRemoval,
    initiateValidatorWeightUpdate,
    transferOwnership,
    transferValidatorManagerOwnership,

    // Metadata
    contractAddress,
    isReady,
    isReadReady
  };
}
