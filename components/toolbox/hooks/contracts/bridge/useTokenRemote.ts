import { useContractActions } from '../useContractActions';
import ERC20TokenRemoteAbi from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemoteAbi from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import type { TokenType, SendTokensInput, TokenMultiplier } from '../types';

export type { TokenMultiplier } from '../types';

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
  registerWithHome: (feeInfo: readonly [`0x${string}`, bigint]) => Promise<string>;
  initialize: (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenHomeBlockchainID: string,
    tokenHomeAddress: string,
    tokenHomeDecimals: number,
    tokenName: string,
    tokenSymbol: string,
    tokenDecimals: number,
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
export function useTokenRemote(contractAddress: string | null, tokenType: TokenType, customAbi?: any): TokenRemoteHook {
  const abi = customAbi ?? (tokenType === 'erc20' ? ERC20TokenRemoteAbi.abi : NativeTokenRemoteAbi.abi);

  const contract = useContractActions(contractAddress, abi);

  // Read functions - ERC20-like
  const name = () => contract.read('name') as Promise<string>;
  const symbol = () => contract.read('symbol') as Promise<string>;
  const decimals = () => contract.read('decimals') as Promise<number>;
  const balanceOf = (account: string) => contract.read('balanceOf', [account]) as Promise<bigint>;
  const totalSupply = () => contract.read('totalSupply') as Promise<bigint>;
  const allowance = (ownerAddr: string, spender: string) =>
    contract.read('allowance', [ownerAddr, spender]) as Promise<bigint>;

  // Read functions - Remote-specific
  const getTokenHomeAddress = () => contract.read('getTokenHomeAddress') as Promise<string>;
  const getTokenHomeBlockchainID = () => contract.read('getTokenHomeBlockchainID') as Promise<string>;
  const getBlockchainID = () => contract.read('getBlockchainID') as Promise<string>;
  const getTokenMultiplier = () => contract.read('getTokenMultiplier') as Promise<TokenMultiplier>;
  const getInitialReserveImbalance = () => contract.read('getInitialReserveImbalance') as Promise<bigint>;
  const getIsCollateralized = () => contract.read('getIsCollateralized') as Promise<boolean>;
  const getMultiplyOnRemote = () => contract.read('getMultiplyOnRemote') as Promise<boolean>;
  const owner = () => contract.read('owner') as Promise<string>;
  const getMinTeleporterVersion = () => contract.read('getMinTeleporterVersion') as Promise<bigint>;
  const isTeleporterAddressPaused = (address: string) =>
    contract.read('isTeleporterAddressPaused', [address]) as Promise<boolean>;

  // Write functions - ERC20-like
  const transfer = (to: string, amount: bigint) => contract.write('transfer', [to, amount], 'Transfer Token Remote');

  const approve = (spender: string, amount: bigint) =>
    contract.write('approve', [spender, amount], 'Approve Token Remote');

  const transferFrom = (from: string, to: string, amount: bigint) =>
    contract.write('transferFrom', [from, to, amount], 'Transfer From Token Remote');

  // Write functions - Remote-specific
  const send = (input: SendTokensInput, amount: bigint) =>
    contract.write('send', [input, amount], `Send ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`);

  const sendAndCall = (input: any, amount: bigint) =>
    contract.write(
      'sendAndCall',
      [input, amount],
      `Send And Call ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`,
    );

  const registerWithHome = (feeInfo: readonly [`0x${string}`, bigint]) =>
    contract.write('registerWithHome', [feeInfo], 'Register Token Remote With Home');

  const initialize = (
    teleporterRegistryAddress: string,
    teleporterManager: string,
    tokenHomeBlockchainID: string,
    tokenHomeAddress: string,
    tokenHomeDecimals: number,
    tokenName: string,
    tokenSymbol: string,
    tokenDecimals: number,
  ) =>
    contract.write(
      'initialize',
      [
        teleporterRegistryAddress,
        teleporterManager,
        tokenHomeBlockchainID,
        tokenHomeAddress,
        tokenHomeDecimals,
        tokenName,
        tokenSymbol,
        tokenDecimals,
      ],
      `Initialize ${tokenType === 'erc20' ? 'ERC20' : 'Native'} Token Remote`,
    );

  const transferOwnership = (newOwner: string) =>
    contract.write('transferOwnership', [newOwner], 'Transfer Token Remote Ownership');

  const updateMinTeleporterVersion = (minTeleporterVersion: bigint) =>
    contract.write('updateMinTeleporterVersion', [minTeleporterVersion], 'Update Min Teleporter Version');

  const pauseTeleporterAddress = (address: string) =>
    contract.write('pauseTeleporterAddress', [address], 'Pause Teleporter Address');

  const unpauseTeleporterAddress = (address: string) =>
    contract.write('unpauseTeleporterAddress', [address], 'Unpause Teleporter Address');

  return {
    name,
    symbol,
    decimals,
    balanceOf,
    totalSupply,
    allowance,
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
    transfer,
    approve,
    transferFrom,
    send,
    sendAndCall,
    registerWithHome,
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
