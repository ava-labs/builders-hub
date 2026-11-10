import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findRelayer } from '@/server/services/studio/relayers';

const C_CHAIN = 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp';
const ECHO = '98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp';
const ECHO_HEX = '0x1278d1be4b987e847be3465940eb5066c4604a7fbd6e086900823597d81af4c1';

/** Health as the service reports it and the console's relayer card reads it; `null` when it cannot reach the relayer. */
const relayer = (id: string, label: string, chains: string[], healthy: boolean | null) => ({
  relayerId: id,
  label,
  configs: chains.map((blockchainId) => ({ subnetId: 's', blockchainId, rpcUrl: 'r', wsUrl: 'w' })),
  health: healthy === null ? null : { status: healthy ? 'up' : 'down', details: {} },
});

function answer(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

beforeEach(() => vi.stubEnv('MANAGED_TESTNET_NODE_SERVICE_PASSWORD', 'test-password'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('findRelayer', () => {
  it("finds the builder's healthy relayer that lists both chains, in any ID form", async () => {
    answer({
      relayers: [
        relayer('0xother', 'someone-else', [C_CHAIN, ECHO], true),
        relayer('0xmine', 'User-1', [C_CHAIN, ECHO_HEX], true),
      ],
    });
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({ status: 'serving', relayerId: '0xmine' });
  });

  it('reports a covering relayer that is not healthy, and whether the service can reach it at all', async () => {
    answer([relayer('0xmine', 'user-1', [C_CHAIN, ECHO], false)]);
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({
      status: 'unhealthy',
      relayerId: '0xmine',
      unreachable: false,
    });
    answer([relayer('0xmine', 'user-1', [C_CHAIN, ECHO], null)]);
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({
      status: 'unhealthy',
      relayerId: '0xmine',
      unreachable: true,
    });
  });

  it('also accepts health reported as healthy: true', async () => {
    answer([{ ...relayer('0xmine', 'user-1', [C_CHAIN, ECHO], null), health: { healthy: true } }]);
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({ status: 'serving', relayerId: '0xmine' });
  });

  it('names the chains the closest relayer is missing', async () => {
    answer({ a: relayer('0xa', 'user-1', [C_CHAIN], true) });
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({ status: 'missing', missing: [ECHO] });
    answer([]);
    expect(await findRelayer('user-1', [C_CHAIN, ECHO])).toEqual({ status: 'missing', missing: [C_CHAIN, ECHO] });
  });

  it('says why it could not check', async () => {
    answer({}, 502);
    expect(await findRelayer('user-1', [C_CHAIN])).toEqual({
      status: 'unavailable',
      reason: 'the managed relayer service answered 502',
    });
    vi.stubEnv('MANAGED_TESTNET_NODE_SERVICE_PASSWORD', '');
    expect((await findRelayer('user-1', [C_CHAIN])).status).toBe('unavailable');
  });
});
