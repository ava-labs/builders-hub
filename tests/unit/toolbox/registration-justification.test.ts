import { describe, expect, it } from 'vitest';
import { decodeEventLog, hexToBytes, parseAbiItem, sha256 } from 'viem';
import { marshalRegisterMessageJustification } from '@avalanche-sdk/interchain/warp';
import {
  justificationFromRegisterMessage,
  readAddressedCallPayload,
} from '@/components/toolbox/utils/registrationJustification';

// Validator V1 of the nightly Console chain test, tier1, on Fuji (run 40657322229, 2026-10-28). The P-Chain
// RegisterL1ValidatorTx 888e5ax1Xe3YrELgn5KoFoJPjsWM8v7GwY8AfhDpBBbUg2SwN holds REGISTER_MESSAGE. The C-Chain initiate
// tx 0x03137e19...48a0 (block 60141864) emitted WARP_LOG and the manager's InitiatedValidatorRegistration.
const VALIDATION_ID = '0x6e67f57807b673618ef7ca3e12dd4564b5b22e08fb3f42b312999f578edc0572';
const REGISTER_MESSAGE =
  '0x0000000000010e19d3cdbaf2ab373fdbbb44b3804bb31895e92c825d688c24a1d46d64fb6190000000146e2df2b222af77bab6947a5431daf81d682b9364b3065692c362c155afd54961fec26c6e08b1b0f7a784e15dd714be90378b1c2e237c8916bb6f2a214c571dc9d9a645ba000000006ae3056c00000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c9900000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c99000000000000000a';
const WARP_LOG = {
  address: '0x0200000000000000000000000000000000000005',
  topics: [
    '0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d',
    '0x00000000000000000000000037f7684bc983575929ad859db621ce28c5eee1b9',
    '0x81d07cbbc6cc4174de2850858feebe4c7ffcdbadcb17c4b372550723693e8620',
  ],
  data: '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000001020000000000057fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5000000d80000000000010000001437f7684bc983575929ad859db621ce28c5eee1b9000000b60000000000010e19d3cdbaf2ab373fdbbb44b3804bb31895e92c825d688c24a1d46d64fb6190000000146e2df2b222af77bab6947a5431daf81d682b9364b3065692c362c155afd54961fec26c6e08b1b0f7a784e15dd714be90378b1c2e237c8916bb6f2a214c571dc9d9a645ba000000006ae3056c00000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c9900000001000000018af8e40ad0bb9a523c8adda7dbf9bcc148927c99000000000000000a000000000000000000000000000000000000000000000000000000000000',
} as const;
const EXPECTED = marshalRegisterMessageJustification(hexToBytes(REGISTER_MESSAGE));

const SEND_WARP_MESSAGE_EVENT = parseAbiItem(
  'event SendWarpMessage(address indexed sourceAddress, bytes32 indexed unsignedMessageID, bytes message)',
);

describe('justificationFromRegisterMessage', () => {
  it('builds the 185-byte justification from the 10-28 P-Chain message, which hashes to the validation ID', () => {
    expect(sha256(hexToBytes(REGISTER_MESSAGE))).toBe(VALIDATION_ID);
    const justification = justificationFromRegisterMessage(REGISTER_MESSAGE, VALIDATION_ID);
    expect(justification.length).toBe(185);
    expect(justification).toEqual(EXPECTED);
  });

  it('gives the same bytes as the C-Chain warp log of the initiate tx', () => {
    const { args } = decodeEventLog({
      abi: [SEND_WARP_MESSAGE_EVENT],
      data: WARP_LOG.data,
      topics: [...WARP_LOG.topics],
    });
    const fromLog = marshalRegisterMessageJustification(readAddressedCallPayload(hexToBytes(args.message))!);
    expect(justificationFromRegisterMessage(REGISTER_MESSAGE, VALIDATION_ID)).toEqual(fromLog);
  });

  it('names a P-Chain tx of another registration of the node, and shows the contract validation ID', () => {
    const contractId = `0x${'ab'.repeat(32)}` as const;
    expect(() => justificationFromRegisterMessage(REGISTER_MESSAGE, contractId)).toThrow(
      `The P-Chain transaction belongs to another registration of this node. Its message has validation ID ${VALIDATION_ID}, but the validator manager has validation ID ${contractId} for the node.`,
    );
  });
});
