import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  ExecutionRevertedError,
  isAddress,
  parseAbi,
  type PublicClient,
} from 'viem';
import type { SavedProxyAdmin } from '@/components/toolbox/stores/createChainStore';
import { PRIMARY_NETWORK_SUBNET_ID } from '@/lib/console/my-l1/types';

const OWNER_ABI = parseAbi(['function owner() view returns (address)']);

/**
 * The L1 that a ProxyAdmin deployed now belongs to. A wallet on an L1 names
 * it. On the C-Chain, the subnet of the create flow names it (empty outside
 * that flow).
 */
export function proxyAdminSubnetId(walletSubnetId: string | undefined, flowSubnetId: string): string {
  return walletSubnetId && walletSubnetId !== PRIMARY_NETWORK_SUBNET_ID ? walletSubnetId : flowSubnetId;
}

/** The saved ProxyAdmin address when it is on this chain and for this L1, else null. */
export function savedProxyAdminFor(
  saved: SavedProxyAdmin | null | undefined,
  evmChainId: number,
  subnetId: string,
): string | null {
  if (!saved || !evmChainId) return null;
  return saved.evmChainId === evmChainId && saved.subnetId === subnetId ? saved.address : null;
}

/** True when the call reached the contract and the contract refused it. */
const isRevert = (err: unknown) =>
  err instanceof BaseError &&
  !!err.walk(
    (e) =>
      e instanceof ContractFunctionRevertedError ||
      e instanceof ContractFunctionZeroDataError ||
      e instanceof ExecutionRevertedError,
  );

export interface SavedProxyAdminProblem {
  /** The text for the user. */
  message: string;
  /**
   * True when the saved address stays: the ProxyAdmin is valid, and another account owns it. When the owner
   * connects again, the page uses it. False when the address can never be used, so the page removes it.
   */
  keepSaved: boolean;
}

/**
 * Why Proxy Setup must not use the saved ProxyAdmin, or null when it can.
 * A contract must exist at the address, and its owner() must be the
 * connected wallet. A failed read of the chain throws, so a network error
 * does not remove the saved address.
 */
export async function savedProxyAdminProblem(
  client: PublicClient,
  address: string,
  wallet: string,
): Promise<SavedProxyAdminProblem | null> {
  const lead = `This page does not use the ProxyAdmin that it deployed earlier (${address}).`;
  const next = 'Deploy a new ProxyAdmin.';
  const unusable = (reason: string): SavedProxyAdminProblem => ({
    message: `${lead} ${reason} ${next}`,
    keepSaved: false,
  });
  if (!isAddress(address)) return unusable('The saved address is not valid.');
  const code = await client.getCode({ address });
  if (!code || code === '0x') return unusable('No contract exists at this address on this chain.');
  let owner: string;
  try {
    owner = await client.readContract({ address, abi: OWNER_ABI, functionName: 'owner' });
  } catch (err) {
    if (isRevert(err)) return unusable('The contract at this address is not a ProxyAdmin.');
    throw err;
  }
  if (owner.toLowerCase() !== wallet.toLowerCase()) {
    return {
      message:
        `This page deployed a ProxyAdmin earlier (${address}). Its owner is ${owner}, not the connected wallet. ` +
        'Connect that account, or deploy a new ProxyAdmin.',
      keepSaved: true,
    };
  }
  return null;
}
