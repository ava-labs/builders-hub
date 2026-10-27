import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  StatsApiHttpError,
  getBlockchainInfoForNetwork,
  getPChainTxBlockHeight,
  getSubnetInfoForNetwork,
  listL1Validators,
} from '@/components/toolbox/coreViem/utils/statsApi';
import { GET } from '@/app/api/stats-api/[network]/[...path]/route';

const SUBNET = '2sYMJH1LWdY7QCbnRLeGKx93PiuxKGKcsYtPyFsc5ZaQYRvVxo';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

function validator(validationId: string, weight: string) {
  return {
    validationId,
    validationIdHex: '0x00',
    nodeId: `NodeID-${validationId}`,
    subnetId: SUBNET,
    weight,
    remainingBalance: 1000,
    creationTimestamp: 1,
    blsCredentials: { publicKey: '0x00', proofOfPossession: '0x00' },
    remainingBalanceOwner: { addresses: [], threshold: 1 },
    deactivationOwner: { addresses: [], threshold: 1 },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listL1Validators', () => {
  it('reads every page and keeps the validators that are still in the set', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ validators: [validator('a', '100'), validator('b', '0')], nextPageToken: 'p2' }),
      )
      .mockResolvedValueOnce(jsonResponse({ validators: [validator('c', '9000000000')] }));

    const validators = await listL1Validators('mainnet', SUBNET);

    expect(validators.map((v) => [v.validationId, v.weight])).toEqual([
      ['a', 100],
      ['c', 9000000000],
    ]);
    const first = new URL(fetchMock.mock.calls[0][0]);
    expect(first.pathname).toBe('/v1/networks/mainnet/l1Validators');
    expect(first.searchParams.get('subnetId')).toBe(SUBNET);
    expect(first.searchParams.get('pageSize')).toBe('100');
    expect(first.searchParams.get('includeInactive')).toBe('true');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('pageToken')).toBe('p2');
  });

  it('keeps the removed validators when asked', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ validators: [validator('a', '100'), validator('b', '0')] }));

    const validators = await listL1Validators('fuji', SUBNET, { includeRemoved: true });

    expect(validators.map((v) => v.validationId)).toEqual(['a', 'b']);
  });
});

describe('getSubnetInfoForNetwork', () => {
  it('reads a subnet with no chains as an empty list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ subnetId: SUBNET, isL1: false, blockchains: null }));

    const subnet = await getSubnetInfoForNetwork('testnet', SUBNET);

    expect(subnet.blockchains).toEqual([]);
  });

  it('keeps the HTTP status of a miss', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'subnet not found' }, 404));

    const error = await getSubnetInfoForNetwork('mainnet', SUBNET).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(StatsApiHttpError);
    expect((error as StatsApiHttpError).status).toBe(404);
  });

  it('answers the Primary Network without a request', async () => {
    const subnet = await getSubnetInfoForNetwork('fuji', '11111111111111111111111111111111LpoYY');

    expect(subnet.blockchains.map((b) => b.blockchainName)).toEqual(['P-Chain', 'X-Chain', 'C-Chain']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getBlockchainInfoForNetwork', () => {
  it('answers the C-Chain without a request', async () => {
    const chain = await getBlockchainInfoForNetwork('mainnet', '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5');

    expect(chain.evmChainId).toBe(43114);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not take a Fuji chain for a Mainnet chain', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'blockchain not found' }, 404));

    await expect(
      getBlockchainInfoForNetwork('mainnet', 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp'),
    ).rejects.toBeInstanceOf(StatsApiHttpError);
  });
});

describe('getPChainTxBlockHeight', () => {
  it('reads the block height, or null when the transaction is unknown', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ blockNumber: '303402' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'not found' }, 404));

    expect(await getPChainTxBlockHeight('2HkLpTEB5RPMTtufxpuzbmpeLhvA6EuXXbk5sWjnkES8HKBjTq', 'fuji')).toBe(303402n);
    expect(await getPChainTxBlockHeight('2HkLpTEB5RPMTtufxpuzbmpeLhvA6EuXXbk5sWjnkES8HKBjTq', 'fuji')).toBeNull();
  });
});

describe('the Stats API relay', () => {
  const call = (path: string) =>
    GET(new NextRequest(`http://localhost/api/stats-api/${path}`), {
      params: Promise.resolve({ network: path.split('/')[0], path: path.split('?')[0].split('/').slice(1) }),
    });

  it('forwards a console read with its query', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ validators: [] }));

    const response = await call(`fuji/l1Validators?subnetId=${SUBNET}&pageSize=100`);

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toMatch(
      new RegExp(`/v1/networks/fuji/l1Validators\\?subnetId=${SUBNET}&pageSize=100$`),
    );
  });

  it('passes a miss through', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'subnet not found' }, 404));

    expect((await call(`mainnet/subnets/${SUBNET}`)).status).toBe(404);
  });

  it('refuses a route that the console does not read', async () => {
    expect((await call('mainnet/validators')).status).toBe(404);
    expect((await call('devnet/l1Validators')).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
