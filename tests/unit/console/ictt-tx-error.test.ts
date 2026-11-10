import { describe, expect, it } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  TransactionExecutionError,
  UserRejectedRequestError,
  parseAbi,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import { describeTokenReadError, describeTxError } from '@/components/toolbox/console/ictt/bridge/utils/tx-error';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

const FROM = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x1111111111111111111111111111111111111111';
// A deploy's calldata is the contract bytecode: the rejection dump of the ExampleERC20 deploy had 6,546 characters.
const BYTECODE = `0x6080604052${'ab'.repeat(3200)}` as const;
const ERC20_ABI = parseAbi(['function name() view returns (string)']);

/** The error viem's deployContract throws when the wallet answers 4001. */
function deployRejection() {
  return new TransactionExecutionError(new UserRejectedRequestError(new Error('User rejected the request.')), {
    account: { address: FROM, type: 'json-rpc' },
    chain: avalancheFuji,
    data: BYTECODE,
  });
}

/** The error viem's readContract throws for a call to `name()` at TOKEN. */
function readFailure(cause: ConstructorParameters<typeof ContractFunctionExecutionError>[0]) {
  return new ContractFunctionExecutionError(cause, { abi: ERC20_ABI, functionName: 'name', contractAddress: TOKEN });
}

describe('describeTxError', () => {
  it('shows the rejection text, not the request dump, for a rejected deploy', () => {
    const err = deployRejection();
    expect(err.message.length).toBeGreaterThan(6000);
    expect(describeTxError(err)).toBe(WALLET_REJECTED_TEXT);
  });

  it('shows the rejection text for a plain 4001 error', () => {
    expect(describeTxError(Object.assign(new Error('User rejected the request.'), { code: 4001 }))).toBe(
      WALLET_REJECTED_TEXT,
    );
  });

  it('shows the parseContractError text for a known failure', () => {
    expect(describeTxError(new Error('insufficient funds for gas * price + value'))).toBe(
      'Insufficient funds for transaction',
    );
  });

  it('shows only the first paragraph of an unknown error', () => {
    const dump = `Something failed.\n\nRequest Arguments:\n  data: ${BYTECODE}\n\nVersion: viem@2.45.3`;
    expect(describeTxError(new Error(dump))).toBe('Something failed.');
  });

  it('cuts a long one-paragraph error to 300 characters', () => {
    const text = describeTxError(new Error(`Something failed: ${BYTECODE}`));
    expect(text).toHaveLength(303);
    expect(text.endsWith('...')).toBe(true);
  });
});

describe('describeTokenReadError', () => {
  it('says that no ERC-20 contract is at an address with no code', () => {
    const err = readFailure(new ContractFunctionZeroDataError({ functionName: 'name' }));
    expect(describeTokenReadError(err, 'C-Chain')).toBe(
      'No ERC-20 contract is at this address on C-Chain. Check the address.',
    );
  });

  it('says that no ERC-20 contract is at a contract that reverts the call', () => {
    const err = readFailure(new ContractFunctionRevertedError({ abi: ERC20_ABI, functionName: 'name' }));
    expect(describeTokenReadError(err, 'C-Chain')).toBe(
      'No ERC-20 contract is at this address on C-Chain. Check the address.',
    );
  });

  it('does not blame the address when the RPC fails', () => {
    const err = readFailure(
      new HttpRequestError({ url: 'https://api.avax-test.network/ext/bc/C/rpc', details: 'Failed to fetch' }),
    );
    expect(describeTokenReadError(err, 'C-Chain')).toBe('Could not read the token on C-Chain. HTTP request failed.');
  });
});
