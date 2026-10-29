import { afterEach, describe, expect, it, vi } from 'vitest';

// The chat tools import the @/lib/mcp/tools index, whose docs tools pull MDX through @/lib/source: stub it, as
// handler-validation.test.ts does.
vi.mock('@/lib/source', () => {
  const empty = { getPages: () => [] };
  return {
    documentation: empty,
    academy: empty,
    integration: empty,
    blog: empty,
  };
});

vi.mock('@/lib/llm-utils', () => ({
  getLLMText: vi.fn(async () => ''),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

import { blockchainLookupTransaction } from '@/lib/chat/blockchain-tools';
import { blockchainTools } from '@/lib/mcp/tools/blockchain';

/** avalanchego's own avm.getTx example: an X-Chain ExportTx on Mainnet. */
const TX_ID = '2oJCbb8pfdxEHAf9A8CdN4Afj9VSR3xzyzNkf8tDv7aM1sfNFL';
const AVAX = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z';
const SECP_FX = 'spdxUxVJQbX85MGxMHbKw1sHxMnSqJ3QBzDyDYEP3h6TLuxqQ';

/** Mainnet's avm.getTx answer for TX_ID with encoding json, its credential emptied. */
const AVM_GET_TX = {
  tx: {
    unsignedTx: {
      networkID: 1,
      blockchainID: '2oYMBNV4eNHyqk2fjjV5nVQLDbtmNJzq5s3qs3Lo6ftnC6FByM',
      outputs: [],
      inputs: [
        {
          txID: '2jbZUvi6nHy3Pgmk8xcMpSg5cW6epkPqdKkHSCweb4eRXtq4k9',
          outputIndex: 1,
          assetID: AVAX,
          fxID: SECP_FX,
          input: { amount: 2570382395, signatureIndices: [0] },
        },
      ],
      memo: '0x',
      destinationChain: '11111111111111111111111111111111LpoYY',
      exportedOutputs: [
        {
          assetID: AVAX,
          fxID: SECP_FX,
          output: {
            addresses: ['X-avax1tnuesf6cqwnjw7fxjyk7lhch0vhf0v95wj5jvy'],
            amount: 2569382395,
            locktime: 0,
            threshold: 1,
          },
        },
      ],
    },
    credentials: [],
    id: TX_ID,
  },
  encoding: 'json',
};

/**
 * The public API's answers when only the X-Chain knows the tx: platform.getTx says "not found", avm.getTx returns the
 * tx, and any other method is gone, as avm.getTxStatus will be once avalanchego removes it.
 */
function mockNodes() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { method, id } = JSON.parse(String(init?.body));
    const body =
      method === 'avm.getTx'
        ? { jsonrpc: '2.0', result: AVM_GET_TX, id }
        : method === 'platform.getTx'
          ? { jsonrpc: '2.0', error: { code: -32000, message: "couldn't get tx: not found", data: null }, id }
          : { jsonrpc: '2.0', id, error: { code: -32601, message: `the method ${method} does not exist` } };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
}

const methodsOf = (fetchMock: ReturnType<typeof mockNodes>) =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method);

const ACCEPTED_X_CHAIN_TX = {
  found: true,
  chain: 'X-Chain',
  network: 'Mainnet',
  transaction: { txID: TX_ID, status: 'Accepted' },
};

afterEach(() => vi.restoreAllMocks());

describe('X-Chain transaction lookups', () => {
  it('MCP blockchain_lookup_transaction reports an X-Chain tx as Accepted without avm.getTxStatus', async () => {
    const fetchMock = mockNodes();

    const result = await blockchainTools.handlers.blockchain_lookup_transaction({ txHash: TX_ID, network: 'mainnet' });

    expect(JSON.parse(result.content[0]?.text ?? '')).toMatchObject(ACCEPTED_X_CHAIN_TX);
    expect(methodsOf(fetchMock)).toContain('avm.getTx');
    expect(methodsOf(fetchMock)).not.toContain('avm.getTxStatus');
  });

  it('chat blockchainLookupTransaction reports an X-Chain tx as Accepted without avm.getTxStatus', async () => {
    const fetchMock = mockNodes();

    // execute() skips the zod defaults, so every field is passed.
    const result = await blockchainLookupTransaction.execute?.(
      { txHash: TX_ID, network: 'mainnet' },
      { toolCallId: 'xchain-tx-status', messages: [] },
    );

    expect(result).toMatchObject(ACCEPTED_X_CHAIN_TX);
    expect(methodsOf(fetchMock)).toContain('avm.getTx');
    expect(methodsOf(fetchMock)).not.toContain('avm.getTxStatus');
  });
});
