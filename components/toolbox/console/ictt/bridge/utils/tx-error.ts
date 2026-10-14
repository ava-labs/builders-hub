import { parseContractError } from '@/components/toolbox/hooks/contracts/parseContractError';
import { classifyEvmTxError } from '@/components/toolbox/lib/evmErrors';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

// The longest error text a panel shows. A wallet or node error without viem's structure can hold the full calldata,
// and a deploy's calldata is the contract bytecode.
const MAX_LENGTH = 300;

// The viem errors that say the address answered the call with no data or a revert: no contract with that function is
// at the address.
const NO_CONTRACT_ERRORS = new Set([
  'ContractFunctionZeroDataError',
  'ContractFunctionRevertedError',
  'AbiDecodingZeroDataError',
]);

/** The first paragraph of an error text. viem puts the request arguments, the docs link and the version after it. */
function firstParagraph(text: string): string {
  const head = text.split(/\n\s*\n/)[0].trim();
  return head.length > MAX_LENGTH ? `${head.slice(0, MAX_LENGTH)}...` : head;
}

/** The names of the error and of each error in its cause chain. */
function causeNames(err: unknown): string[] {
  const names: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current instanceof Error && depth < 10; depth++) {
    names.push(current.name);
    current = current.cause;
  }
  return names;
}

/**
 * The text a panel shows for a failed deploy or contract write. A wallet rejection gets the Console's rejection text.
 * The wallet RPC, page RPC and receipt time-out cases get the classifyEvmTxError text. A known revert gets the
 * parseContractError text. Any other error shows only its first paragraph, not viem's dump of the request.
 */
export function describeTxError(err: unknown): string {
  const { kind, message } = classifyEvmTxError(err);
  if (kind === 'user-rejected') return WALLET_REJECTED_TEXT;
  if (kind === 'wallet-rpc-unreachable' || kind === 'rpc-unreachable' || kind === 'receipt-timeout') return message;
  return firstParagraph(parseContractError(err));
}

/** The text the token check shows when it cannot read the ERC-20 name, symbol or decimals at an address. */
export function describeTokenReadError(err: unknown, chainName: string): string {
  if (causeNames(err).some((name) => NO_CONTRACT_ERRORS.has(name))) {
    return `No ERC-20 contract is at this address on ${chainName}. Check the address.`;
  }
  const message = err instanceof Error ? err.message : String(err);
  return `Could not read the token on ${chainName}. ${firstParagraph(message)}`;
}
