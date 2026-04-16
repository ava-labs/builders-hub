import { createAvalancheWalletClient } from '@avalanche-sdk/client';
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains';
import type { AvalancheWalletClient } from '@avalanche-sdk/client';
import { addChain, CoreWalletAddChainParameters } from './overrides/addChain';
import { isTestnet } from './methods/isTestnet';
import { getPChainAddress } from './methods/getPChainAddress';
import { getCorethAddress } from './methods/getCorethAddress';
import { createSubnet, CreateSubnetParams } from './methods/createSubnet';
import { createChain, CreateChainParams } from './methods/createChain';
import { convertToL1, ConvertToL1Params } from './methods/convertToL1';
import {
  extractWarpMessageFromPChainTx,
  ExtractWarpMessageFromTxParams,
} from './methods/extractWarpMessageFromPChainTx';
import { getEthereumChain, GetEthereumChainResponse } from './methods/getEthereumChain';
import { extractChainInfo, ExtractChainInfoParams } from './methods/extractChainInfo';
import { getPChainBalance } from './methods/getPChainBalance';
import { registerL1Validator } from './methods/registerL1Validator';
import { RegisterL1ValidatorParams } from './methods/registerL1Validator';
import { setL1ValidatorWeight } from './methods/setL1ValidatorWeight';
import { SetL1ValidatorWeightParams } from './methods/setL1ValidatorWeight';
import { increaseL1ValidatorBalance, IncreaseL1ValidatorBalanceParams } from './methods/increaseL1ValidatorBalance';
import { disableL1Validator, DisableL1ValidatorParams } from './methods/disableL1Validator';
import {
  extractL1ValidatorWeightMessage,
  ExtractL1ValidatorWeightMessageParams,
  ExtractL1ValidatorWeightMessageResponse,
} from './methods/extractL1ValidatorWeightMessage';
import {
  extractRegisterL1ValidatorMessage,
  ExtractRegisterL1ValidatorMessageParams,
  ExtractRegisterL1ValidatorMessageResponse,
} from './methods/extractRegisterL1ValidatorMessage';
import { ExtractWarpMessageFromTxResponse } from './methods/extractWarpMessageFromPChainTx';
import { ExtractChainInfoResponse } from './methods/extractChainInfo';

// Re-export custom Avalanche EVM RPC methods that should be called on publicClient
export { getActiveRulesAt } from './methods/getActiveRulesAt';
export type { GetActiveRulesAtResponse } from './methods/getActiveRulesAt';

// Type for the Avalanche wallet client with custom methods at root level
export type CoreWalletClientType = Omit<AvalancheWalletClient, 'addChain'> & {
  // Overridden methods at root level
  addChain: (args: CoreWalletAddChainParameters) => Promise<void>;
  // Custom methods at root level
  isTestnet: () => Promise<boolean>;
  getPChainAddress: () => Promise<string>;
  getCorethAddress: () => Promise<string>;
  createSubnet: (args: CreateSubnetParams) => Promise<string>;
  createChain: (args: CreateChainParams) => Promise<string>;
  convertToL1: (args: ConvertToL1Params) => Promise<string>;
  registerL1Validator: (args: RegisterL1ValidatorParams) => Promise<string>;
  setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => Promise<string>;
  increaseL1ValidatorBalance: (args: IncreaseL1ValidatorBalanceParams) => Promise<string>;
  disableL1Validator: (args: DisableL1ValidatorParams) => Promise<string>;
  extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => Promise<ExtractWarpMessageFromTxResponse>;
  extractL1ValidatorWeightMessage: (
    args: ExtractL1ValidatorWeightMessageParams,
  ) => Promise<ExtractL1ValidatorWeightMessageResponse>;
  extractRegisterL1ValidatorMessage: (
    args: ExtractRegisterL1ValidatorMessageParams,
  ) => Promise<ExtractRegisterL1ValidatorMessageResponse>;
  getEthereumChain: () => Promise<GetEthereumChainResponse>;
  extractChainInfo: (args: ExtractChainInfoParams) => Promise<ExtractChainInfoResponse>;
  getPChainBalance: () => Promise<bigint>;
};

/**
 * Create a CoreWalletClient for P-Chain operations.
 *
 * @param _account  The EVM address of the connected account.
 * @param isTestnetOverride  When provided, forces the SDK client to target
 *   Fuji (true) or Mainnet (false) regardless of what Core Wallet's
 *   `wallet_getEthereumChain` reports.  This is necessary because Core
 *   Wallet has an explicit mainnet/testnet *mode* toggle, and switching
 *   to a custom L1 chain can flip Core into "mainnet mode" even when the
 *   L1 is actually a Fuji testnet.  Callers that already know the correct
 *   network (e.g. chain-change handlers that track testnet state) should
 *   pass this flag.
 */
export async function createCoreWalletClient(
  _account: `0x${string}`,
  isTestnetOverride?: boolean,
): Promise<CoreWalletClientType | null> {
  // Check if we're in a browser environment
  const isClient = typeof window !== 'undefined';

  // Only create a wallet client if we're in a browser
  if (!isClient) {
    return null; // Return null for SSR
  }

  // Check if window.avalanche exists and is an object
  if (!window.avalanche || typeof window.avalanche !== 'object') {
    return null; // Return null if Core wallet is not found
  }

  // Determine testnet status: prefer the explicit override, fall back to
  // Core Wallet's own report (which is unreliable for custom L1 chains).
  let useTestnet: boolean;
  if (typeof isTestnetOverride === 'boolean') {
    useTestnet = isTestnetOverride;
  } else {
    const chain = await window.avalanche.request<GetEthereumChainResponse>({
      method: 'wallet_getEthereumChain',
    });
    useTestnet = chain.isTestnet;
  }

  // Create the Avalanche SDK wallet client
  const baseClient = createAvalancheWalletClient({
    chain: useTestnet ? avalancheFuji : avalanche,
    transport: {
      type: 'custom',
      provider: window.avalanche,
    },
    account: _account,
  });

  // Add all custom methods at root level
  const clientWithCustomMethods = {
    ...baseClient,
    // Overridden methods at root level
    addChain: (args: CoreWalletAddChainParameters) => addChain(baseClient, args),
    // Custom methods at root level
    isTestnet: () => isTestnet(baseClient),
    getPChainAddress: () => getPChainAddress(baseClient),
    getCorethAddress: () => getCorethAddress(baseClient),
    createSubnet: (args: CreateSubnetParams) => createSubnet(baseClient, args),
    createChain: (args: CreateChainParams) => createChain(baseClient, args),
    convertToL1: (args: ConvertToL1Params) => convertToL1(baseClient, args),
    registerL1Validator: (args: RegisterL1ValidatorParams) => registerL1Validator(baseClient, args),
    setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => setL1ValidatorWeight(baseClient, args),
    increaseL1ValidatorBalance: (args: IncreaseL1ValidatorBalanceParams) =>
      increaseL1ValidatorBalance(baseClient, args),
    disableL1Validator: (args: DisableL1ValidatorParams) => disableL1Validator(baseClient, args),
    extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) =>
      extractWarpMessageFromPChainTx(baseClient, args),
    extractL1ValidatorWeightMessage: (args: ExtractL1ValidatorWeightMessageParams) =>
      extractL1ValidatorWeightMessage(baseClient, args),
    extractRegisterL1ValidatorMessage: (args: ExtractRegisterL1ValidatorMessageParams) =>
      extractRegisterL1ValidatorMessage(baseClient, args),
    getEthereumChain: () => getEthereumChain(baseClient),
    extractChainInfo: (args: ExtractChainInfoParams) => extractChainInfo(baseClient, args),
    getPChainBalance: () => getPChainBalance(baseClient),
  } as CoreWalletClientType;

  return clientWithCustomMethods;
}

/**
 * Ensures Core Wallet is in the correct network mode (testnet / mainnet)
 * before submitting P-Chain transactions.
 *
 * Core Wallet has an internal mainnet/testnet toggle that determines which
 * P-Chain it routes `avalanche_sendTransaction` to.  When the user is
 * connected to a custom L1 chain, Core can silently flip into mainnet mode
 * even though the L1 is actually a Fuji testnet.  This function detects the
 * mismatch and requests a chain switch to the matching C-Chain (43113 Fuji
 * or 43114 Mainnet), which toggles Core's mode.
 *
 * @param expectedTestnet  Whether we expect Core to be in testnet mode.
 * @returns The hex chain ID that was active before switching, or `null` if
 *   no switch was needed.  Callers can use {@link restoreCoreChain} to
 *   switch back after the P-Chain operation.
 */
export async function ensureCoreNetworkMode(expectedTestnet: boolean): Promise<string | null> {
  if (typeof window === 'undefined' || !window.avalanche) return null;

  const chain = await window.avalanche.request<GetEthereumChainResponse>({
    method: 'wallet_getEthereumChain',
    params: [],
  });

  if (chain.isTestnet === expectedTestnet) return null; // already correct

  // Switch to the matching C-Chain to toggle Core's mode
  const targetChainId = expectedTestnet ? '0xa869' : '0xa86a'; // 43113 / 43114
  await window.avalanche.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: targetChainId }],
  });

  return chain.chainId; // previous chain ID for restoration
}

/**
 * Restores the EVM chain that was active before {@link ensureCoreNetworkMode}
 * switched it.  Best-effort — silently swallows errors.
 */
export async function restoreCoreChain(previousChainIdHex: string): Promise<void> {
  if (typeof window === 'undefined' || !window.avalanche) return;
  try {
    await window.avalanche.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: previousChainIdHex }],
    });
  } catch {
    /* best effort */
  }
}
