import { isAddress, type PublicClient } from 'viem';
import { utils } from '@avalabs/avalanchejs';
import { CB58ToHex, hexToCB58 } from '@avalanche-sdk/client/utils';
import ValidatorManagerABI from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import type { ConvertToL1Validator } from '@/components/toolbox/coreViem/methods/convertToL1';
import { pChainOwnerProblem } from '@/components/toolbox/coreViem/utils/pchainOwner';

/* Checks that must pass before a ConvertSubnetToL1Tx is signed. The
   conversion is permanent, and the P-Chain checks none of its manager
   fields: a chain ID with a typo, a manager address on the wrong chain or
   an owner that needs no signature all commit, and the validator set can
   then never be managed. */

/** The C-Chain of each network, by Avalanche blockchain ID. */
export const C_CHAIN_IDS = {
  testnet: 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp',
  mainnet: '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5',
} as const;

/**
 * A CB58 ID of `bytes` bytes with a valid checksum. base58check.decode
 * strips the checksum without verifying it, so re-encode and compare, as
 * nodeCredentials.ts does for NodeIDs.
 */
export function isCB58Id(id: string, bytes = 32): boolean {
  if (!id || id.length > 64) return false;
  try {
    const payload = utils.base58check.decode(id);
    return payload.length === bytes && utils.base58check.encode(payload) === id;
  } catch {
    return false;
  }
}

export function isNodeId(nodeId: string): boolean {
  return nodeId.startsWith('NodeID-') && isCB58Id(nodeId.slice('NodeID-'.length), 20);
}

/** What the manager address holds on the C-Chain. */
export type CChainManager =
  | { kind: 'none' } // no code at the address
  | { kind: 'other' } // code, but no Validator Manager
  | { kind: 'unset' } // a Validator Manager with no subnet yet
  | { kind: 'bound'; initialized: boolean } // a Validator Manager set up for this subnet
  | { kind: 'foreign'; subnetId: string }; // a Validator Manager set up for another subnet

export async function readCChainManager(
  client: PublicClient,
  address: `0x${string}`,
  subnetId: string,
): Promise<CChainManager> {
  const code = await client.getCode({ address });
  if (!code || code === '0x') return { kind: 'none' };
  let bound: string;
  try {
    bound = (await client.readContract({ address, abi: ValidatorManagerABI.abi, functionName: 'subnetID' })) as string;
  } catch {
    return { kind: 'other' };
  }
  if (/^0x0*$/.test(bound)) return { kind: 'unset' };
  if (bound.toLowerCase() !== CB58ToHex(subnetId).toLowerCase()) {
    return { kind: 'foreign', subnetId: hexToCB58(bound as `0x${string}`) };
  }
  const initialized = (await client.readContract({
    address,
    abi: ValidatorManagerABI.abi,
    functionName: 'isValidatorSetInitialized',
  })) as boolean;
  return { kind: 'bound', initialized };
}

/** Whether a genesis JSON puts code at `address`; null when the genesis cannot be read. */
export function genesisHasCode(genesis: string, address: string): boolean | null {
  let alloc: Record<string, { code?: string }>;
  try {
    alloc = JSON.parse(genesis).alloc ?? {};
  } catch {
    return null;
  }
  const want = address.toLowerCase().replace(/^0x/, '');
  const entry = Object.entries(alloc).find(([key]) => key.toLowerCase().replace(/^0x/, '') === want)?.[1];
  return Boolean(entry?.code && entry.code !== '0x');
}

export interface ConversionInput {
  managerChainId: string;
  managerAddress: string;
  validators: ConvertToL1Validator[];
  /** The network's C-Chain blockchain ID. */
  cChainId: string;
  /** Blockchain IDs of the subnet, as Glacier lists them; null while the subnet loads. */
  subnetChainIds: string[] | null;
  /** What the address holds on the C-Chain; null until the read returns. */
  cChainManager: CChainManager | null;
  /** The genesis of the manager chain, when the create flow made that chain. */
  managerChainGenesis?: string | null;
}

/** Every reason the conversion must not be signed. Empty when it may be. */
export function conversionProblems(input: ConversionInput): string[] {
  const { managerChainId: chain, managerAddress: address, cChainId, cChainManager: onCChain } = input;
  const problems: string[] = [];

  const chainOk = isCB58Id(chain);
  if (!chainOk) {
    problems.push('Manager Chain ID is not a valid blockchain ID. Check every character.');
  } else if (chain !== cChainId && input.subnetChainIds && !input.subnetChainIds.includes(chain)) {
    problems.push('Manager Chain ID must be the C-Chain or a chain of this subnet.');
  }
  const addressOk = isAddress(address);
  if (!addressOk) problems.push('Manager Contract Address is not a valid EVM address.');

  if (chainOk && addressOk && onCChain) {
    if (chain === cChainId) {
      if (onCChain.kind === 'none') problems.push(`No contract exists at ${address} on the C-Chain.`);
      if (onCChain.kind === 'other')
        problems.push(`The contract at ${address} on the C-Chain is not a Validator Manager.`);
      if (onCChain.kind === 'foreign') {
        problems.push(`The Validator Manager at ${address} on the C-Chain is set up for subnet ${onCChain.subnetId}.`);
      }
      if (onCChain.kind === 'bound' && onCChain.initialized) {
        problems.push(`The Validator Manager at ${address} on the C-Chain already has a validator set.`);
      }
    } else if (onCChain.kind === 'bound') {
      problems.push(
        `The Validator Manager at ${address} is on the C-Chain and set up for this subnet. Set Manager Chain ID to the C-Chain.`,
      );
    } else if (onCChain.kind === 'unset') {
      problems.push(`A Validator Manager exists at ${address} on the C-Chain. Set Manager Chain ID to the C-Chain.`);
    } else if (input.managerChainGenesis && genesisHasCode(input.managerChainGenesis, address) === false) {
      problems.push(`The genesis of the manager chain has no contract at ${address}.`);
    }
  }

  input.validators.forEach((v, i) => {
    const which = `Validator ${i + 1}`;
    if (!isNodeId(v.nodeID.trim()))
      problems.push(`${which}: the NodeID is not valid. Copy it again from info.getNodeID.`);
    for (const [owner, label] of [
      [v.remainingBalanceOwner, 'remaining balance owner'],
      [v.deactivationOwner, 'deactivation owner'],
    ] as const) {
      const problem = pChainOwnerProblem(owner);
      if (problem) problems.push(`${which}: the ${label} ${problem}.`);
    }
  });
  return problems;
}
