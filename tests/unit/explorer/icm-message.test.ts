import { describe, expect, it } from 'vitest';

import { ICM_EVENT_BY_TOPIC, TELEPORTER_ADDRESS, icmTxHref, normalizeMessageId, resolveIcmChain } from '@/lib/icm-message';

const SOURCE_CB58 = '2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB';
const SOURCE_HEX = '0xaf6a974f467006d94388f438014162dd12ec2d1475c48faf09ffe7222d59e478';

describe('resolveIcmChain', () => {
  it('names a chain from its EVM chain ID', () => {
    expect(resolveIcmChain(43114)).toMatchObject({
      name: 'Avalanche C-Chain',
      href: '/explorer/mainnet/c-chain',
    });
  });

  it('resolves a CB58 blockchain ID against a catalog entry stored as hex', () => {
    expect(resolveIcmChain(undefined, SOURCE_CB58)).toMatchObject({
      evmChainId: 68414,
      name: 'Henesys',
    });
  });

  it('resolves the same chain from the hex form of that ID', () => {
    expect(resolveIcmChain(undefined, SOURCE_HEX)?.name).toBe('Henesys');
  });

  it('keeps the blockchain ID for a chain absent from the catalog', () => {
    const unknown = 'X'.repeat(49);
    expect(resolveIcmChain(undefined, unknown)).toEqual({
      name: 'Unknown chain',
      blockchainId: unknown,
    });
  });

  it('falls back to the bare EVM id rather than inventing a name', () => {
    expect(resolveIcmChain(999999999)?.name).toBe('Chain 999999999');
  });

  it('returns null when neither identifier is reported', () => {
    expect(resolveIcmChain(undefined, undefined)).toBeNull();
  });
});

describe('icmTxHref', () => {
  it('links a transaction on a chain we index', () => {
    expect(icmTxHref(resolveIcmChain(43114), '0xabc')).toBe('/explorer/mainnet/c-chain/tx/0xabc');
  });

  // A chain with no explorer route here must not produce a dead link.
  it('gives no link when the chain has no explorer route', () => {
    expect(icmTxHref({ name: 'Unknown chain' }, '0xabc')).toBeUndefined();
  });

  it('gives no link without a transaction hash', () => {
    expect(icmTxHref(resolveIcmChain(43114), undefined)).toBeUndefined();
  });
});

describe('normalizeMessageId', () => {
  const id = '912457f600e3c421d48f64c25960aa4a616bbf0eb1b0c68716c16b5e07f99605';

  it('accepts a bare hash and a 0x-prefixed one alike', () => {
    expect(normalizeMessageId(id)).toBe(`0x${id}`);
    expect(normalizeMessageId(`0x${id.toUpperCase()}`)).toBe(`0x${id}`);
    expect(normalizeMessageId(`  ${id}  `)).toBe(`0x${id}`);
  });

  it('rejects anything that is not 32 bytes of hex', () => {
    expect(normalizeMessageId('0x1234')).toBeNull();
    expect(normalizeMessageId(`0x${'z'.repeat(64)}`)).toBeNull();
    expect(normalizeMessageId('')).toBeNull();
  });
});

describe('ICM log constants', () => {
  // These must stay in step with stats-api/icm; a drifted topic0 would silently
  // stop transactions from naming the messages they carry.
  it('carries the four lifecycle topics, lowercase and 0x-prefixed', () => {
    const topics = Object.keys(ICM_EVENT_BY_TOPIC);
    expect(topics).toHaveLength(4);
    for (const t of topics) expect(t).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Object.values(ICM_EVENT_BY_TOPIC)).toEqual(
      expect.arrayContaining([
        'SendCrossChainMessage',
        'ReceiveCrossChainMessage',
        'MessageExecuted',
        'MessageExecutionFailed',
      ]),
    );
  });

  it('holds the messenger address lowercased, so log comparisons match', () => {
    expect(TELEPORTER_ADDRESS).toBe(TELEPORTER_ADDRESS.toLowerCase());
    expect(TELEPORTER_ADDRESS).toMatch(/^0x[0-9a-f]{40}$/);
  });
});
