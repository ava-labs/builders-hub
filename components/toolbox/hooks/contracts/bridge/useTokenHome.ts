import { useContractActions } from '../useContractActions';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeAbi from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import type { TokenType, SendTokensInput, RemoteTokenTransferrerSettings } from '../types';

export type { TokenType, SendTokensInput, RemoteTokenTransferrerSettings } from '../types';

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
    decimals: number,
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
export function useTokenHome(contractAddress: string | null, tokenType: TokenType, customAbi?: any): TokenHomeHook {
  const abi = customAbi ?? (tokenType === 'erc20' ? ERC20TokenHomeAbi.abi : NativeTokenHomeAbi.abi);

  const contract = useContractActions(contractAddress, abi);

  // Read functions
  const getTokenAddress = () => contract.read('getTokenAddress') as Promise<string>;

  const getRemoteTokenTransferrerSettings = (blockchainID: string) =>
    contract.read('getRemoteTokenTransferrerSettings', [blockchainID]) as Promise<RemoteTokenTransferrerSettings>;

  const getTransferredBalance = (blockchainID: string) =>
    contract.read('getTransferredBalance', [blockchainID]) as Promise<bigint>;

  const getBlockchainID = () => contract.read('getBlockchainID') as Promise<string>;

  const owner = () => contract.read('owner') as Promise<string>;

  const getMinTeleporterVersion = () => contract.read('getMinTeleporterVersion') as Promise<bigint>;

  const isTeleporterAddressPaused = (address: string) =>
    contract.read('isTeleporterAddressPaused', [address]) as Promise<boolean>;

  // Write functions
  const send = (input: SendTokensInput, amount: bigint) =>
    contract.write(
      'send',
      [input, amount],
      `Send ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`,
      tokenType === 'native' ? { value: amount } : undefined,
    );

  const sendAndCall = (input: any, amount: bigint) =>
    contract.write(
      'sendAndCall',
      [input, amount],
      `Send And Call ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`,
      tokenType === 'native' ? { value: amount } : undefined,
    );

  const addCollateral = (blockchainID: string, remoteContractAddress: string, amount: bigint) => {
    if (tokenType === 'native') {
      return contract.write(
        'addCollateral',
        [blockchainID as `0x${string}`, remoteContractAddress as `0x${string}`],
        'Add Collateral to Token Home',
        { value: amount },
      );
    }
    return contract.write(
      'addCollateral',
      [blockchainID as `0x${string}`, remoteContractAddress as `0x${string}`, amount],
      'Add Collateral to Token Home',
    );
  };

  const initialize = (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenContractAddress: string,
    decimals: number,
  ) =>
    contract.write(
      'initialize',
      [teleporterRegistryAddress, teleporterManager, tokenContractAddress, decimals],
      `Initialize ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Home`,
    );

  const transferOwnership = (newOwner: string) =>
    contract.write('transferOwnership', [newOwner], 'Transfer Token Home Ownership');

  const updateMinTeleporterVersion = (minTeleporterVersion: bigint) =>
    contract.write('updateMinTeleporterVersion', [minTeleporterVersion], 'Update Min Teleporter Version');

  const pauseTeleporterAddress = (address: string) =>
    contract.write('pauseTeleporterAddress', [address], 'Pause Teleporter Address');

  const unpauseTeleporterAddress = (address: string) =>
    contract.write('unpauseTeleporterAddress', [address], 'Unpause Teleporter Address');

  return {
    getTokenAddress,
    getRemoteTokenTransferrerSettings,
    getTransferredBalance,
    getBlockchainID,
    owner,
    getMinTeleporterVersion,
    isTeleporterAddressPaused,
    send,
    sendAndCall,
    addCollateral,
    initialize,
    transferOwnership,
    updateMinTeleporterVersion,
    pauseTeleporterAddress,
    unpauseTeleporterAddress,
    contractAddress,
    tokenType,
    isReady: contract.isReady,
  };
}
