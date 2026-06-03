import { describe, it, expect } from 'vitest';
import { parsePChainError } from './parsePChainError';

// The createSubnet/createChain "internal error" surfaced as raw viem boilerplate
// (DevRel weekly, Jun 01 2026). These pin the user-facing translation and, just
// as importantly, the ordering: specific rejects (nonce/funds/rejected) must win
// over the generic internal-error fallback.
describe('parsePChainError', () => {
  it('translates the viem InternalRpcError boilerplate into an honest RPC message', () => {
    const viemBoilerplate =
      'An internal error was received.\n' +
      'Details: Unable to create transaction: The error is mostly returned when the client requests\n' +
      'with either mistyped URL, or the passed resource is moved or deleted, or the resource doesn’t exist.\n' +
      'Version: viem@2.50.4';
    const out = parsePChainError(new Error(viemBoilerplate));
    expect(out).not.toBe(viemBoilerplate);
    expect(out).toMatch(/internal error/i);
    expect(out).toMatch(/endpoint/i);
  });

  it('prefers the specific nonce reason even when wrapped in an internal error', () => {
    const wrappedNonce =
      'An internal error was received.\nDetails: Unable to broadcast transaction: invalid nonce\nVersion: viem@2.50.4';
    expect(parsePChainError(new Error(wrappedNonce))).toBe('Transaction nonce error. Please try again.');
  });

  it('maps the common user/expected rejects', () => {
    expect(parsePChainError(new Error('User rejected the request'))).toBe('Transaction was rejected by user');
    expect(parsePChainError(new Error('insufficient funds for tx'))).toBe(
      'Insufficient P-Chain balance for transaction',
    );
  });

  it('passes through an unrecognized message unchanged', () => {
    expect(parsePChainError(new Error('some bespoke failure'))).toBe('some bespoke failure');
  });
});
