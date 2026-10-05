import { describe, expect, it } from 'vitest';
import { parseContractError } from '@/components/toolbox/hooks/contracts/parseContractError';

const NONCE_TEXT = /^Transaction nonce error/;
const INVALID_STATUS_TEXT =
  'Invalid validator status. The validator may already have a pending operation or may not be active.';

// The shape of a viem error dump: the revert data, then the request arguments, which can include a nonce.
const revertDump = (selector: string) =>
  [
    `The contract function "initiateValidatorRemoval" reverted with the following signature:`,
    selector,
    '',
    'Request Arguments:',
    '  from:   0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC',
    '  to:     0x0Feedc0de0000000000000000000000000000000',
    '  data:   0xb6e6a2ca',
    '  nonce:  5',
    '',
    'Version: viem@2.37.0',
  ].join('\n');

describe('parseContractError', () => {
  it('maps a known selector in a dump that lists a nonce argument to the selector text', () => {
    expect(parseContractError(new Error(revertDump('0x5c3324cc')))).toBe(INVALID_STATUS_TEXT);
  });

  it('maps a known error name before the nonce check', () => {
    expect(parseContractError(new Error('reverted with InvalidNonce(); nonce: 5'))).toMatch(/^Invalid nonce\./);
  });

  it('maps the node nonce phrases to the nonce text', () => {
    expect(parseContractError(new Error('nonce too low'))).toMatch(NONCE_TEXT);
    expect(parseContractError(new Error('Details: nonce too high'))).toMatch(NONCE_TEXT);
    expect(parseContractError(new Error('invalid nonce'))).toMatch(NONCE_TEXT);
    expect(parseContractError(new Error('nonce has already been used'))).toMatch(NONCE_TEXT);
    expect(parseContractError(new Error('Nonce Too Low'))).toMatch(NONCE_TEXT);
  });

  it("maps viem's nonce errors to the nonce text, also when the node said 'already known'", () => {
    // viem maps 'already known' and 'transaction already imported' to NonceTooLowError. Its message tells the user to
    // increase the nonce, which the Console text contradicts.
    const alreadyKnown = [
      'Nonce provided for the transaction (5) is lower than the current nonce of the account.',
      'Try increasing the nonce or find the latest nonce with `getTransactionCount`.',
      '',
      'Request Arguments:',
      '  from:   0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC',
      '  nonce:  5',
      '',
      'Details: already known',
      'Version: viem@2.37.0',
    ].join('\n');
    expect(parseContractError(new Error(alreadyKnown))).toMatch(NONCE_TEXT);
    expect(
      parseContractError(new Error('Nonce provided for the transaction is higher than the next one expected.')),
    ).toMatch(NONCE_TEXT);
  });

  it('does not read a nonce argument alone as a nonce error', () => {
    const dump = revertDump('0x12345678');
    expect(parseContractError(new Error(dump))).toBe(`Transaction reverted: ${dump}`);
    expect(parseContractError(new Error('could not send: nonce: 5'))).toBe('could not send: nonce: 5');
  });

  it('keeps wallet rejections and missing funds ahead of the selector table', () => {
    expect(parseContractError(new Error(`User rejected the request. ${revertDump('0x5c3324cc')}`))).toBe(
      'Transaction was rejected by user',
    );
    expect(parseContractError(new Error('insufficient funds for gas * price + value'))).toBe(
      'Insufficient funds for transaction',
    );
  });
});
