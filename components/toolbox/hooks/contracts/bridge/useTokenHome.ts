import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeAbi from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';

export type TokenType = 'erc20' | 'native';

export interface SendTokensInput {
  destinationBlockchainID: string;
  destinationTokenTransferrerAddress: string;
  recipient: string;
  primaryFeeTokenAddress: string;
  primaryFee: bigint;
  secondaryFee: bigint;
  requiredGasLimit: bigint;
  multiHopFallback: string;
}

export interface RemoteTokenTransferrerSettings {
  registered: boolean;
  collateralNeeded: bigint;
  tokenMultiplierNumerator: bigint;
  tokenMultiplierDenominator: bigint;
}

export interface TokenHomeHook {
  // Read functions
  getTokenAddress: () => Promise<string>;
  getRemoteTokenTransferrerSettings: (blockchainID: string) => Promise<RemoteTokenTransferrerSettings>;
  getTransferredBalance: (blockchainID: string) => Promise<bigint>;
  getBlockchainID: () => Promise<string>;
  owner: () => Promise<string>;
  getMinTeleporterVersion: () => Promise<bigint>;
  isTeleporterAddressPaused: (address: string) => Promise<boolean>;

  // Write functions
  send: (input: SendTokensInput, amount: bigint) => Promise<string>;
  sendAndCall: (input: any, amount: bigint) => Promise<string>;
  addCollateral: (blockchainID: string, remoteContractAddress: string, amount: bigint) => Promise<string>;
  initialize: (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenContractAddress: string,
    decimals: number
  ) => Promise<string>;
  transferOwnership: (newOwner: string) => Promise<string>;
  updateMinTeleporterVersion: (minTeleporterVersion: bigint) => Promise<string>;
  pauseTeleporterAddress: (address: string) => Promise<string>;
  unpauseTeleporterAddress: (address: string) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  tokenType: TokenType;
  isReady: boolean;
}

/**
 * Hook for interacting with TokenHome contracts (both ERC20 and Native)
 * @param contractAddress - The address of the TokenHome contract
 * @param tokenType - The type of token ('erc20' or 'native')
 * @param abi - Optional custom ABI (defaults based on tokenType)
 */
export function useTokenHome(
  contractAddress: string | null,
  tokenType: TokenType,
  customAbi?: any
): TokenHomeHook {
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();

  // Auto-select ABI based on token type if not provided
  const abi = customAbi ?? (
    tokenType === 'erc20'
      ? ERC20TokenHomeAbi.abi
      : NativeTokenHomeAbi.abi
  );

  const isReady = Boolean(contractAddress && avalancheWalletClient && viemChain);

  // Read functions
  const getTokenAddress = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getTokenAddress',
      args: []
    }) as string;
  };

  const getRemoteTokenTransferrerSettings = async (blockchainID: string): Promise<RemoteTokenTransferrerSettings> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    const result = await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getRemoteTokenTransferrerSettings',
      args: [blockchainID]
    });

    return result as RemoteTokenTransferrerSettings;
  };

  const getTransferredBalance = async (blockchainID: string): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getTransferredBalance',
      args: [blockchainID]
    }) as bigint;
  };

  const getBlockchainID = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getBlockchainID',
      args: []
    }) as string;
  };

  const owner = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'owner',
      args: []
    }) as string;
  };

  const getMinTeleporterVersion = async (): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getMinTeleporterVersion',
      args: []
    }) as bigint;
  };

  const isTeleporterAddressPaused = async (address: string): Promise<boolean> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'isTeleporterAddressPaused',
      args: [address]
    }) as boolean;
  };

  // Write functions
  const send = async (input: SendTokensInput, amount: bigint): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    // For native tokens, we need to send the amount as value
    const config: any = {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'send',
      args: [input, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (tokenType === 'native') {
      config.value = amount;
    }

    const writePromise = coreWalletClient.writeContract(config);

    notify({
      type: 'call',
      name: `Send ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const sendAndCall = async (input: any, amount: bigint): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const config: any = {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'sendAndCall',
      args: [input, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    if (tokenType === 'native') {
      config.value = amount;
    }

    const writePromise = coreWalletClient.writeContract(config);

    notify({
      type: 'call',
      name: `Send And Call ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const addCollateral = async (blockchainID: string, remoteContractAddress: string, amount: bigint): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'addCollateral',
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    };

    // For native tokens, amount is sent as value; for ERC20, as an argument
    if (tokenType === 'native') {
      txConfig.args = [blockchainID as `0x${string}`, remoteContractAddress as `0x${string}`];
      txConfig.value = amount;
    } else {
      txConfig.args = [blockchainID as `0x${string}`, remoteContractAddress as `0x${string}`, amount];
    }

    const writePromise = coreWalletClient.writeContract(txConfig);

    notify({
      type: 'call',
      name: 'Add Collateral to Token Home'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initialize = async (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenContractAddress: string,
    decimals: number
  ): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'initialize',
      args: [teleporterRegistryAddress, teleporterManager, tokenContractAddress, decimals],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: `Initialize ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferOwnership = async (newOwner: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'transferOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer Token Home Ownership'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const updateMinTeleporterVersion = async (minTeleporterVersion: bigint): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'updateMinTeleporterVersion',
      args: [minTeleporterVersion],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Update Min Teleporter Version'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const pauseTeleporterAddress = async (address: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'pauseTeleporterAddress',
      args: [address],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Pause Teleporter Address'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const unpauseTeleporterAddress = async (address: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'unpauseTeleporterAddress',
      args: [address],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Unpause Teleporter Address'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions
    getTokenAddress,
    getRemoteTokenTransferrerSettings,
    getTransferredBalance,
    getBlockchainID,
    owner,
    getMinTeleporterVersion,
    isTeleporterAddressPaused,

    // Write functions
    send,
    sendAndCall,
    addCollateral,
    initialize,
    transferOwnership,
    updateMinTeleporterVersion,
    pauseTeleporterAddress,
    unpauseTeleporterAddress,

    // Metadata
    contractAddress,
    tokenType,
    isReady
  };
}
