import { describe, expect, it } from 'vitest';
import { buildCastCommand, CAST_COMMANDS } from '@/components/toolbox/console/shared/pchainCommands';

const WARP_PRECOMPILE = '0x0200000000000000000000000000000000000005';

/** A signed-message stand-in: `length` bytes 0x01, 0x02, ... as hex without 0x. */
function messageHex(length: number): string {
  return Array.from({ length }, (_, i) => ((i % 255) + 1).toString(16).padStart(2, '0')).join('');
}

function castFor(signedWarpMessage?: string): string {
  return buildCastCommand({
    contractAddress: '0x1111111111111111111111111111111111111111',
    functionSig: 'submitUptimeProof(bytes32,uint32)',
    args: ['0xabc', '0'],
    rpcUrl: 'http://127.0.0.1:9650/ext/bc/test/rpc',
    signedWarpMessage,
  });
}

function accessListOf(command: string): { address: string; storageKeys: string[] }[] {
  const match = command.match(/--access-list '([^']*)'/);
  if (!match) throw new Error(`no --access-list in: ${command}`);
  return JSON.parse(match[1]);
}

describe('buildCastCommand access list', () => {
  it('packs a signed message into 32-byte storage keys on the Warp precompile', () => {
    const message = messageHex(150);
    const [entry, ...rest] = accessListOf(castFor(`0x${message}`));

    expect(rest).toHaveLength(0);
    expect(entry.address).toBe(WARP_PRECOMPILE);
    for (const key of entry.storageKeys) expect(key).toMatch(/^0x[0-9a-f]{64}$/);

    const joined = entry.storageKeys.map((key) => key.slice(2)).join('');
    expect(joined.startsWith(message)).toBe(true);
    expect(joined.slice(message.length)).toMatch(/^ff0*$/);
    expect(entry.storageKeys).toHaveLength(Math.ceil((150 + 1) / 32));
  });

  it('accepts the message with or without 0x', () => {
    const message = messageHex(64);
    expect(castFor(message)).toBe(castFor(`0x${message}`));
  });

  it('adds a key for the 0xff terminator when the message fills its last key', () => {
    expect(accessListOf(castFor(messageHex(31)))[0].storageKeys).toHaveLength(1);
    expect(accessListOf(castFor(messageHex(32)))[0].storageKeys).toHaveLength(2);
  });

  it('keeps a placeholder as one placeholder key that says how to pack it', () => {
    const [entry] = accessListOf(castFor('<signed-uptime-proof-hex>'));
    expect(entry.address).toBe(WARP_PRECOMPILE);
    expect(entry.storageKeys).toEqual(['<signed-uptime-proof-hex packed into 32-byte keys>']);
  });

  it('omits the access list when there is no message', () => {
    expect(castFor()).not.toContain('--access-list');
  });
});

describe('CAST_COMMANDS', () => {
  it('packs the message for a manager call', () => {
    const message = messageHex(40);
    const command = CAST_COMMANDS.completeValidatorRegistration({
      managerAddress: '0x2222222222222222222222222222222222222222',
      rpcUrl: 'http://127.0.0.1:9650/ext/bc/test/rpc',
      signedWarpMessage: message,
    });

    expect(command).toMatch(
      /^cast send 0x2222222222222222222222222222222222222222 "completeValidatorRegistration\(uint32\)" 0 /,
    );
    const keys = accessListOf(command)[0].storageKeys;
    expect(keys).toHaveLength(2);
    expect(
      keys
        .map((key) => key.slice(2))
        .join('')
        .startsWith(message),
    ).toBe(true);
  });
});
