import { describe, expect, it } from 'vitest';
import { utils } from '@avalabs/avalanchejs';
import { firstOwnerProblem, pChainOwnerProblem } from '@/components/toolbox/coreViem/utils/pchainOwner';
import { ownerWithAddresses } from '@/components/toolbox/components/OwnerAddressesInput';

const ADDRESS = utils.format('P', 'fuji', new Uint8Array(20).fill(1));
const OTHER = utils.format('P', 'fuji', new Uint8Array(20).fill(2));
const ZERO = new Uint8Array(20);
const broken = (address: string) => address.slice(0, -1) + (address.endsWith('q') ? 'p' : 'q');

describe('pChainOwnerProblem', () => {
  it('passes real addresses with a threshold from 1 to their number', () => {
    expect(pChainOwnerProblem({ addresses: [ADDRESS], threshold: 1 })).toBeNull();
    expect(pChainOwnerProblem({ addresses: [ADDRESS, OTHER], threshold: 2 })).toBeNull();
    expect(pChainOwnerProblem({ addresses: [ADDRESS.slice('P-'.length)], threshold: 1 })).toBeNull();
    expect(pChainOwnerProblem({ addresses: [`0x${'01'.repeat(20)}`], threshold: 1 })).toBeNull();
  });

  it('refuses an owner that needs no signature', () => {
    expect(pChainOwnerProblem({ addresses: [], threshold: 0 })).toMatch(/at least one P-Chain address/);
    expect(pChainOwnerProblem({ addresses: [], threshold: 1 })).toMatch(/at least one P-Chain address/);
    expect(pChainOwnerProblem({ addresses: [ADDRESS], threshold: 0 })).toMatch(/threshold from 1 to 1/);
  });

  it('refuses a threshold above the number of addresses', () => {
    expect(pChainOwnerProblem({ addresses: [ADDRESS, OTHER], threshold: 3 })).toMatch(/threshold from 1 to 2/);
  });

  it('refuses the zero address, in bech32 on either network or in hex', () => {
    for (const address of [utils.format('P', 'fuji', ZERO), utils.format('P', 'avax', ZERO), `0x${'00'.repeat(20)}`]) {
      expect(pChainOwnerProblem({ addresses: [address], threshold: 1 })).toMatch(/zero address/);
    }
  });

  it('refuses an address that does not decode to 20 bytes', () => {
    expect(pChainOwnerProblem({ addresses: [''], threshold: 1 })).toMatch(/not a P-Chain address: \(empty\)/);
    expect(pChainOwnerProblem({ addresses: [broken(ADDRESS)], threshold: 1 })).toMatch(/not a P-Chain address/);
    expect(pChainOwnerProblem({ addresses: ['0x1234'], threshold: 1 })).toMatch(/not a P-Chain address/);
  });
});

describe('firstOwnerProblem', () => {
  it('names the first owner with a problem', () => {
    const ok = { addresses: [ADDRESS], threshold: 1 };
    expect(
      firstOwnerProblem([
        [ok, 'remaining balance owner'],
        [{ addresses: [], threshold: 0 }, 'deactivation owner'],
      ]),
    ).toBe('The deactivation owner needs at least one P-Chain address.');
    expect(
      firstOwnerProblem([
        [ok, 'remaining balance owner'],
        [ok, 'deactivation owner'],
      ]),
    ).toBeNull();
  });
});

describe('the owner input', () => {
  it('keeps the threshold at 1 when the last address is removed', () => {
    expect(ownerWithAddresses({ addresses: [ADDRESS], threshold: 1 }, [])).toEqual({ addresses: [], threshold: 1 });
  });

  it('keeps the threshold from 1 to the number of addresses', () => {
    expect(ownerWithAddresses({ addresses: [ADDRESS, OTHER], threshold: 2 }, [ADDRESS])).toEqual({
      addresses: [ADDRESS],
      threshold: 1,
    });
    expect(ownerWithAddresses({ addresses: [ADDRESS], threshold: 1 }, [ADDRESS, OTHER])).toEqual({
      addresses: [ADDRESS, OTHER],
      threshold: 1,
    });
  });
});
