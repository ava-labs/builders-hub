import { describe, expect, it } from 'vitest';
import {
  SIGNING_SUBNET_LOADING,
  signingSubnetErrorText,
  signingSubnetWaitText,
} from '@/components/toolbox/console/shared/SigningSubnetStatus';
import { NO_L1_SELECTED } from '@/components/toolbox/utils/vmcLookupText';

describe('signingSubnetWaitText', () => {
  it('returns null when the signing subnet is known, also with a stale error', () => {
    expect(signingSubnetWaitText('11111111111111111111111111111111LpoYY', false, null)).toBeNull();
    expect(signingSubnetWaitText('11111111111111111111111111111111LpoYY', false, 'old error')).toBeNull();
  });

  it('returns the loading text while useVMCAddress loads, also when an old error is still set', () => {
    expect(signingSubnetWaitText('', true, null)).toBe(SIGNING_SUBNET_LOADING);
    expect(signingSubnetWaitText(undefined, true, 'old error')).toBe(SIGNING_SUBNET_LOADING);
  });

  it('returns the instruction as is when no L1 is selected', () => {
    expect(signingSubnetWaitText('', false, NO_L1_SELECTED)).toBe('Select an L1.');
    expect(signingSubnetErrorText(NO_L1_SELECTED)).toBe('Select an L1.');
  });

  it('returns the error text when the lookup failed', () => {
    expect(signingSubnetWaitText('', false, 'Glacier returned 500')).toBe(
      'Could not load the Validator Manager details: Glacier returned 500. Reload the page to try again, or select ' +
        'another L1.',
    );
  });
});

describe('signingSubnetErrorText', () => {
  it('does not double the full stop of an error that ends with one', () => {
    expect(signingSubnetErrorText('This is not an L1, or it has no Validator Manager.')).toBe(
      'Could not load the Validator Manager details: This is not an L1, or it has no Validator Manager. Reload the ' +
        'page to try again, or select another L1.',
    );
  });

  it('drops the empty status text of a Glacier error that ends with a colon', () => {
    expect(signingSubnetErrorText('Failed to fetch subnet info: ')).toBe(
      'Could not load the Validator Manager details: Failed to fetch subnet info. Reload the page to try again, or ' +
        'select another L1.',
    );
  });
});
