import { describe, it, expect } from 'vitest';
import { utils, secp256k1 } from '@avalabs/avalanchejs';
import { normalizePChainFaucetAddress } from './pchainFaucetAddress';

// A real, checksum-valid Fuji address ("fuji1…") derived from a random key.
const fuji = utils.formatBech32(
  'fuji',
  secp256k1.publicKeyBytesToAddress(secp256k1.getPublicKey(secp256k1.randomPrivateKey())),
);

describe('normalizePChainFaucetAddress', () => {
  it('keeps a canonical P-fuji1… address', () => {
    expect(normalizePChainFaucetAddress(`P-${fuji}`)).toEqual({ address: `P-${fuji}` });
  });

  it('adds P- to a bare fuji1… without doubling the HRP (the prod bug)', () => {
    // Old code produced `P-fuji1fuji1…` here → "Invalid checksum".
    expect(normalizePChainFaucetAddress(fuji)).toEqual({ address: `P-${fuji}` });
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePChainFaucetAddress(`  P-${fuji}  `)).toEqual({ address: `P-${fuji}` });
  });

  it('rejects empty input with a clear message', () => {
    expect(normalizePChainFaucetAddress('   ')).toEqual({
      error: 'Please enter a P-Chain address.',
    });
  });

  it('rejects malformed input instead of surfacing a raw bech32 error', () => {
    // "Unknown letter: b" / "Wrong string length" class from the report.
    expect(normalizePChainFaucetAddress('P-fuji1bbbb')).toHaveProperty('error');
    expect(normalizePChainFaucetAddress('not-an-address')).toHaveProperty('error');
  });
});
