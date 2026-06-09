import { describe, expect, it } from 'vitest';
import { validateL1UpgradeSelection } from '@/lib/console/l1-upgrade-selection';

describe('l1 upgrade selection validation', () => {
  it('accepts a known L1 selection', () => {
    expect(
      validateL1UpgradeSelection({
        subnetId: 'i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK',
        blockchainId: '98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp',
        rpcUrl: 'https://subnets.avax.network/echo/testnet/rpc',
        chainName: 'Echo',
      }),
    ).toEqual([]);
  });

  it('rejects malformed ids and rpc urls', () => {
    const errors = validateL1UpgradeSelection({
      subnetId: 'bad-subnet',
      blockchainId: 'bad-chain',
      rpcUrl: 'not-a-url',
      chainName: 'Valid Name',
    });

    expect(errors).toContain('Subnet ID must be a valid Avalanche CB58 ID.');
    expect(errors).toContain('Blockchain ID must be a valid Avalanche CB58 ID.');
    expect(errors).toContain('RPC URL must be a valid URL.');
  });
});
