import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import { useResolvedWalletClient } from '../../useResolvedWalletClient';
import ERC20TokenRemoteAbi from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemoteAbi from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import { TokenType, SendTokensInput } from './useTokenHome';

export interface TokenMultiplier {
  numerator: bigint;
  denominator: bigint;
}

export interface TokenRemoteHook {
  // Read functions - ERC20-like
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  decimals: () => Promise<number>;
  balanceOf: (account: string) => Promise<bigint>;
  totalSupply: () => Promise<bigint>;
  allowance: (owner: string, spender: string) => Promise<bigint>;

  // Read functions - Remote-specific
  getTokenHomeAddress: () => Promise<string>;
  getTokenHomeBlockchainID: () => Promise<string>;
  getBlockchainID: () => Promise<string>;
  getTokenMultiplier: () => Promise<TokenMultiplier>;
  getInitialReserveImbalance: () => Promise<bigint>;
  getIsCollateralized: () => Promise<boolean>;
  getMultiplyOnRemote: () => Promise<boolean>;
  owner: () => Promise<string>;
  getMinTeleporterVersion: () => Promise<bigint>;
  isTeleporterAddressPaused: (address: string) => Promise<boolean>;

  // Write functions - ERC20-like
  transfer: (to: string, amount: bigint) => Promise<string>;
  approve: (spender: string, amount: bigint) => Promise<string>;
  transferFrom: (from: string, to: string, amount: bigint) => Promise<string>;

  // Write functions - Remote-specific
  send: (input: SendTokensInput, amount: bigint) => Promise<string>;
  sendAndCall: (input: any, amount: bigint) => Promise<string>;
  registerWithHome: (
    feeInfo: readonly [`0x${string}`, bigint]
  ) => Promise<string>;
  initialize: (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenHomeBlockchainID: string,
    tokenHomeAddress: string,
    tokenHomeDecimals: number,
    tokenName: string,
    tokenSymbol: string,
    tokenDecimals: number
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
 * Hook for interacting with TokenRemote contracts (both ERC20 and Native)
 * @param contractAddress - The address of the TokenRemote contract
 * @param tokenType - The type of token ('erc20' or 'native')
 * @param abi - Optional custom ABI (defaults based on tokenType)
 */
export function useTokenRemote(
  contractAddress: string | null,
  tokenType: TokenType,
  customAbi?: any
): TokenRemoteHook {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();
  const walletClient = useResolvedWalletClient();

  // Auto-select ABI based on token type if not provided
  const abi = customAbi ?? (
    tokenType === 'erc20'
      ? ERC20TokenRemoteAbi.abi
      : NativeTokenRemoteAbi.abi
  );

  const isReady = Boolean(contractAddress && walletClient && viemChain);

  // Read functions - ERC20-like
  const name = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'name',
      args: []
    }) as string;
  };

  const symbol = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'symbol',
      args: []
    }) as string;
  };

  const decimals = async (): Promise<number> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'decimals',
      args: []
    }) as number;
  };

  const balanceOf = async (account: string): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'balanceOf',
      args: [account]
    }) as bigint;
  };

  const totalSupply = async (): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'totalSupply',
      args: []
    }) as bigint;
  };

  const allowance = async (owner: string, spender: string): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'allowance',
      args: [owner, spender]
    }) as bigint;
  };

  // Read functions - Remote-specific
  const getTokenHomeAddress = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getTokenHomeAddress',
      args: []
    }) as string;
  };

  const getTokenHomeBlockchainID = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getTokenHomeBlockchainID',
      args: []
    }) as string;
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

  const getTokenMultiplier = async (): Promise<TokenMultiplier> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    const result = await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getTokenMultiplier',
      args: []
    });

    return result as TokenMultiplier;
  };

  const getInitialReserveImbalance = async (): Promise<bigint> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getInitialReserveImbalance',
      args: []
    }) as bigint;
  };

  const getIsCollateralized = async (): Promise<boolean> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getIsCollateralized',
      args: []
    }) as boolean;
  };

  const getMultiplyOnRemote = async (): Promise<boolean> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'getMultiplyOnRemote',
      args: []
    }) as boolean;
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

  // Write functions - ERC20-like
  const transfer = async (to: string, amount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'transfer',
      args: [to, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer Token Remote'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const approve = async (spender: string, amount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'approve',
      args: [spender, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Approve Token Remote'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferFrom = async (from: string, to: string, amount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'transferFrom',
      args: [from, to, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer From Token Remote'
    }, writePromise, viemChain);

    return await writePromise;
  };

  // Write functions - Remote-specific
  const send = async (input: SendTokensInput, amount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'send',
      args: [input, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: `Send ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const sendAndCall = async (input: any, amount: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'sendAndCall',
      args: [input, amount],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: `Send And Call ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const registerWithHome = async (
    feeInfo: readonly [`0x${string}`, bigint]
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const config: any = {
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'registerWithHome',
      args: [feeInfo],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    };

    const writePromise = walletClient!.writeContract(config);

    notify({
      type: 'call',
      name: 'Register Token Remote With Home'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const initialize = async (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenHomeBlockchainID: string,
    tokenHomeAddress: string,
    tokenHomeDecimals: number,
    tokenName: string,
    tokenSymbol: string,
    tokenDecimals: number
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'initialize',
      args: [
        teleporterRegistryAddress,
        teleporterManager,
        tokenHomeBlockchainID,
        tokenHomeAddress,
        tokenHomeDecimals,
        tokenName,
        tokenSymbol,
        tokenDecimals
      ],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: `Initialize ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferOwnership = async (newOwner: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'transferOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer Token Remote Ownership'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const updateMinTeleporterVersion = async (minTeleporterVersion: bigint): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'updateMinTeleporterVersion',
      args: [minTeleporterVersion],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Update Min Teleporter Version'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const pauseTeleporterAddress = async (address: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'pauseTeleporterAddress',
      args: [address],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Pause Teleporter Address'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const unpauseTeleporterAddress = async (address: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: abi,
      functionName: 'unpauseTeleporterAddress',
      args: [address],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Unpause Teleporter Address'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions - ERC20-like
    name,
    symbol,
    decimals,
    balanceOf,
    totalSupply,
    allowance,

    // Read functions - Remote-specific
    getTokenHomeAddress,
    getTokenHomeBlockchainID,
    getBlockchainID,
    getTokenMultiplier,
    getInitialReserveImbalance,
    getIsCollateralized,
    getMultiplyOnRemote,
    owner,
    getMinTeleporterVersion,
    isTeleporterAddressPaused,

    // Write functions - ERC20-like
    transfer,
    approve,
    transferFrom,

    // Write functions - Remote-specific
    send,
    sendAndCall,
    registerWithHome,
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
