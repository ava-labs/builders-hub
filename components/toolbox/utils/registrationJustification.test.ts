import { describe, expect, it } from 'vitest';
import { hexToBytes, sha256 } from 'viem';
import { readAddressedCallPayload } from './registrationJustification';

// Unsigned warp message emitted by initiateValidatorRegistration on Numi (mainnet), block 821,770.
const REGISTER_WARP_MESSAGE =
  '0x000000000001d32cc4660bcf8fa7971589f666fddb5ab22aee7e75dcb30b19829a65d4fb0063000000d8000000000001000000140feedc0de0000000000000000000000000000000000000b6000000000001ea57e490f3e85ae544f77a1af26f62c4d5d4d37564812f68e96ba8829140e67800000014e8ef321b99b033010a5ddb4767ee272e3a68043cb86bebda511c196fdcea37947a34a7c434fe0ec093b765a4d298cb29672bc6550a7e7a76cf63b9483206bb81369da8c3000000006a0517f1000000010000000141e0488180e1a2e1ddff25b4cc5fd705def396e8000000010000000141e0488180e1a2e1ddff25b4cc5fd705def396e800000000000003e8';
const VALIDATION_ID = '0x363116b0c42313dfc3081711a1dca9f005a169d79b36f333afaa8fba057c3728';

describe('readAddressedCallPayload', () => {
  it('extracts the RegisterL1ValidatorMessage whose hash is the validation ID', () => {
    const payload = readAddressedCallPayload(hexToBytes(REGISTER_WARP_MESSAGE));
    expect(payload).not.toBeNull();
    expect(sha256(payload!)).toBe(VALIDATION_ID);
  });

  it('returns null for truncated messages', () => {
    const bytes = hexToBytes(REGISTER_WARP_MESSAGE);
    expect(readAddressedCallPayload(bytes.subarray(0, 40))).toBeNull();
    expect(readAddressedCallPayload(bytes.subarray(0, bytes.length - 1))).toBeNull();
  });
});
