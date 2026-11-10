import { afterEach, describe, expect, it, vi } from 'vitest';

// The tools module imports the MCP tool index, which pulls in the docs; the tests here do not use it.
vi.mock('@/lib/mcp/tools', () => ({ blockchainTools: { handlers: {} } }));

import {
  blockchainLookupChain,
  blockchainLookupSubnet,
  blockchainLookupTransaction,
  blockchainLookupValidator,
} from '@/lib/chat/blockchain-tools';

const PRIMARY_NETWORK = '11111111111111111111111111111111LpoYY';
const P_TX = 'FPHuJUUd3ZFcW8DftsG7YHBqatMXfayDvZ1sWFiNZQw4xdK7r';
const C_TX = `0x${'ab'.repeat(32)}`;
const NODE = 'NodeID-LYWyKf9KaidvWj5ZaWE1sxbrhRtJkCYrz';

type Answer = { result: unknown } | { error: { code: number; message: string } } | { status: number };

/**
 * A public API that answers each method by `answer(network, method, params)`. A missing answer is an RPC "not found"
 * error, as the nodes give for an unknown tx.
 */
function mockApi(answer: (network: 'mainnet' | 'fuji', method: string, params: unknown) => Answer | undefined) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const { method, params, id } = JSON.parse(String(init?.body));
    const network = String(url).includes('avax-test') ? 'fuji' : 'mainnet';
    const a = answer(network, method, params) ?? { error: { code: -32000, message: 'not found' } };
    if ('status' in a) return new Response('error code: 1015', { status: a.status });
    return new Response(JSON.stringify({ jsonrpc: '2.0', id, ...a }), { headers: { 'content-type': 'application/json' } });
  });
}

const callsOf = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.map(([url, init]) => `${url} ${JSON.parse(String(init?.body)).method}`);

const run = <A, R>(t: { execute?: (args: A, opts: never) => R }, args: A) =>
  t.execute!(args, { toolCallId: 'test', messages: [] } as never) as Promise<Record<string, unknown>>;

afterEach(() => vi.restoreAllMocks());

describe('blockchain_lookup_transaction', () => {
  it('reads a C-Chain tx and its receipt', async () => {
    mockApi((network, method) => {
      if (network !== 'mainnet') return undefined;
      if (method === 'eth_getTransactionByHash')
        return {
          result: {
            hash: C_TX,
            from: '0x00000000000000000000000000000000000000a1',
            to: '0x00000000000000000000000000000000000000b2',
            value: '0x1bc16d674ec80000',
            blockNumber: '0x10',
            blockHash: `0x${'cd'.repeat(32)}`,
            transactionIndex: '0x0',
            nonce: '0x1',
            gas: '0x5208',
            gasPrice: '0x1',
            input: '0x',
            type: '0x0',
            v: '0x1b',
            r: '0x1',
            s: '0x1',
          },
        };
      if (method === 'eth_getTransactionReceipt')
        return {
          result: {
            transactionHash: C_TX,
            status: '0x1',
            gasUsed: '0x5208',
            blockNumber: '0x10',
            blockHash: `0x${'cd'.repeat(32)}`,
            cumulativeGasUsed: '0x5208',
            effectiveGasPrice: '0x1',
            from: '0x00000000000000000000000000000000000000a1',
            to: '0x00000000000000000000000000000000000000b2',
            logs: [],
            logsBloom: `0x${'00'.repeat(256)}`,
            transactionIndex: '0x0',
            type: '0x0',
          },
        };
      return undefined;
    });

    const result = await run(blockchainLookupTransaction, { txHash: C_TX, network: 'mainnet' });

    expect(result).toMatchObject({
      found: true,
      chain: 'C-Chain',
      network: 'Mainnet',
      transaction: { hash: C_TX, value: '2.000000 AVAX', blockNumber: 16, status: 'success', gasUsed: '21000' },
    });
  });

  it('reads a P-Chain tx and its status, and falls back to the other network', async () => {
    const fetchMock = mockApi((network, method) => {
      if (network !== 'fuji') return undefined;
      if (method === 'platform.getTx') return { result: { tx: { unsignedTx: {} }, encoding: 'json' } };
      if (method === 'platform.getTxStatus') return { result: { status: 'Committed' } };
      return undefined;
    });

    const result = await run(blockchainLookupTransaction, { txHash: P_TX, network: 'mainnet' });

    expect(result).toMatchObject({
      found: true,
      chain: 'P-Chain',
      network: 'Fuji Testnet',
      transaction: { txID: P_TX, status: 'Committed' },
    });
    expect(callsOf(fetchMock)).toEqual([
      'https://api.avax.network/ext/bc/P platform.getTx',
      'https://api.avax-test.network/ext/bc/P platform.getTx',
      'https://api.avax-test.network/ext/bc/P platform.getTxStatus',
    ]);
  });

  it('reads an X-Chain tx as accepted, without avm.getTxStatus', async () => {
    const fetchMock = mockApi((network, method) =>
      network === 'mainnet' && method === 'avm.getTx'
        ? { result: { tx: { unsignedTx: { name: 'Avalanche', symbol: 'AVAX' } }, encoding: 'json' } }
        : undefined,
    );

    const result = await run(blockchainLookupTransaction, { txHash: P_TX, network: 'mainnet' });

    expect(result).toMatchObject({ found: true, chain: 'X-Chain', transaction: { status: 'Accepted' } });
    expect(callsOf(fetchMock)).not.toContain('https://api.avax.network/ext/bc/X avm.getTxStatus');
  });

  it('sends each read once on a rate limit, and reports not found', async () => {
    const fetchMock = mockApi(() => ({ status: 429 }));

    const result = await run(blockchainLookupTransaction, { txHash: P_TX, network: 'mainnet' });

    expect(result).toMatchObject({ found: false });
    // platform.getTx and avm.getTx, on both networks: no retry
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('blockchain_lookup_subnet', () => {
  it('lists the validators and the chains of the subnet', async () => {
    mockApi((_network, method) => {
      if (method === 'platform.getCurrentValidators')
        return { result: { validators: [{ nodeID: NODE, weight: '2000000000000', connected: true }] } };
      if (method === 'platform.getBlockchains')
        return {
          result: {
            blockchains: [
              { id: 'chainA', name: 'C-Chain', subnetID: PRIMARY_NETWORK, vmID: 'vm' },
              { id: 'chainB', name: 'other', subnetID: 'otherSubnet', vmID: 'vm' },
            ],
          },
        };
      return undefined;
    });

    const result = await run(blockchainLookupSubnet, { subnetId: PRIMARY_NETWORK, network: 'mainnet' });

    expect(result).toMatchObject({
      isPrimaryNetwork: true,
      validatorCount: 1,
      validators: [{ nodeID: NODE, weight: '2000.0000 AVAX', connected: true }],
      chains: [{ id: 'chainA', name: 'C-Chain', vmID: 'vm' }],
    });
  });
});

describe('blockchain_lookup_chain', () => {
  it('finds a chain on the other network', async () => {
    mockApi((network, method) =>
      network === 'fuji' && method === 'platform.getBlockchains'
        ? { result: { blockchains: [{ id: 'chainA', name: 'dispatch', subnetID: 'subnetA', vmID: 'vmA' }] } }
        : undefined,
    );

    const result = await run(blockchainLookupChain, { chainId: 'chainA', network: 'mainnet' });

    expect(result).toMatchObject({ found: true, name: 'dispatch', subnetId: 'subnetA', network: 'Fuji Testnet' });
  });
});

describe('blockchain_lookup_validator', () => {
  it('reads a current validator', async () => {
    const fetchMock = mockApi((_network, method, params) =>
      method === 'platform.getCurrentValidators'
        ? { result: { validators: [{ nodeID: (params as { nodeIDs: string[] }).nodeIDs[0], weight: '2000000000000' }] } }
        : undefined,
    );

    const result = await run(blockchainLookupValidator, { nodeId: NODE, subnetId: PRIMARY_NETWORK, network: 'mainnet' });

    expect(result).toMatchObject({ found: true, status: 'active', nodeId: NODE, weight: '2000.0000 AVAX' });
    expect(callsOf(fetchMock)).toEqual(['https://api.avax.network/ext/bc/P platform.getCurrentValidators']);
  });

  it('reports a node that does not validate, without platform.getPendingValidators', async () => {
    const fetchMock = mockApi((_network, method) =>
      method === 'platform.getCurrentValidators' ? { result: { validators: [] } } : undefined,
    );

    const result = await run(blockchainLookupValidator, { nodeId: NODE, subnetId: PRIMARY_NETWORK, network: 'mainnet' });

    expect(result).toEqual({ found: false, nodeId: NODE, error: 'Validator not found in current validators' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
