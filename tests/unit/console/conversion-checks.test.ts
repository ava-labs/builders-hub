import { describe, expect, it } from 'vitest';
import type { PublicClient } from 'viem';
import { CB58ToHex } from '@avalanche-sdk/client/utils';

import {
  C_CHAIN_IDS,
  conversionProblems,
  genesisHasCode,
  isCB58Id,
  isNodeId,
  readCChainManager,
  type CChainManager,
  type ConversionInput,
} from '@/components/toolbox/console/layer-1/create/conversionChecks';
import type { ConvertToL1Validator } from '@/components/toolbox/coreViem/methods/convertToL1';

const C_CHAIN = C_CHAIN_IDS.testnet;
const L1_CHAIN = '98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp'; // Echo
const SUBNET = 'i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK';
const OTHER_SUBNET = '2QBurQNZuE1WpmqTZCvWThCvhVJZozjkEWkEfMTciMAvxBKbq4';
const PROXY = '0x755f6ba3290a3366c8aa4431e0afefbff5a7b7c8';
const NODE = 'NodeID-PTEhrdQJ9iqx5paHwgWB1TUVP1jSLUnp6';
const OWNER = { addresses: ['P-fuji1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqurvdp9'], threshold: 1 };

const validator = (over: Partial<ConvertToL1Validator> = {}): ConvertToL1Validator => ({
  nodeID: NODE,
  nodePOP: { publicKey: '0x', proofOfPossession: '0x' },
  validatorWeight: 100n,
  validatorBalance: 100_000_000n,
  remainingBalanceOwner: OWNER,
  deactivationOwner: OWNER,
  ...over,
});

const input = (over: Partial<ConversionInput> = {}): ConversionInput => ({
  managerChainId: C_CHAIN,
  managerAddress: PROXY,
  validators: [validator()],
  cChainId: C_CHAIN,
  subnetChainIds: [L1_CHAIN],
  cChainManager: { kind: 'bound', initialized: false },
  ...over,
});

describe('isCB58Id and isNodeId', () => {
  it('accepts real IDs and rejects a one-character change', () => {
    expect(isCB58Id(C_CHAIN)).toBe(true);
    expect(isCB58Id(C_CHAIN.slice(0, -1) + 'q')).toBe(false);
    expect(isCB58Id('')).toBe(false);
    expect(isNodeId(NODE)).toBe(true);
    expect(isNodeId(NODE.slice(0, -1) + '7')).toBe(false);
    expect(isNodeId(NODE.slice('NodeID-'.length))).toBe(false);
  });
});

describe('conversionProblems', () => {
  it('passes a C-Chain manager set up for this subnet', () => {
    expect(conversionProblems(input())).toEqual([]);
    expect(conversionProblems(input({ cChainManager: { kind: 'unset' } }))).toEqual([]);
  });

  it('refuses the L1 chain for a manager that lives on the C-Chain for this subnet', () => {
    // the pattern of four converted Fuji L1s whose validator sets can never be managed
    const problems = conversionProblems(input({ managerChainId: L1_CHAIN }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Set Manager Chain ID to the C-Chain/);
    const unset = conversionProblems(input({ managerChainId: L1_CHAIN, cChainManager: { kind: 'unset' } }));
    expect(unset[0]).toMatch(/exists at .* on the C-Chain/);
  });

  it('refuses an empty, mistyped or foreign chain ID', () => {
    expect(conversionProblems(input({ managerChainId: '' }))[0]).toMatch(/not a valid blockchain ID/);
    expect(conversionProblems(input({ managerChainId: L1_CHAIN.slice(0, -1) + 'q' }))[0]).toMatch(/not a valid/);
    expect(conversionProblems(input({ managerChainId: '11111111111111111111111111111111LpoYY' }))[0]).toMatch(
      /C-Chain or a chain of this subnet/,
    );
  });

  it('refuses a C-Chain address that cannot manage this subnet', () => {
    const on = (m: CChainManager) => conversionProblems(input({ cChainManager: m }));
    expect(on({ kind: 'none' })[0]).toMatch(/No contract exists/);
    expect(on({ kind: 'other' })[0]).toMatch(/not a Validator Manager/);
    expect(on({ kind: 'foreign', subnetId: OTHER_SUBNET })[0]).toMatch(OTHER_SUBNET);
    expect(on({ kind: 'bound', initialized: true })[0]).toMatch(/already has a validator set/);
  });

  it('checks an L1 manager against the genesis of its chain', () => {
    const genesis = (alloc: object) => JSON.stringify({ alloc });
    const onL1 = (g: string) =>
      conversionProblems(input({ managerChainId: L1_CHAIN, cChainManager: { kind: 'none' }, managerChainGenesis: g }));
    expect(onL1(genesis({ [PROXY.slice(2)]: { code: '0x6080', balance: '0x0' } }))).toEqual([]);
    expect(onL1(genesis({ [PROXY.toUpperCase().replace('0X', '0x')]: { code: '0x6080' } }))).toEqual([]);
    expect(onL1(genesis({}))[0]).toMatch(/genesis of the manager chain has no contract/);
    expect(genesisHasCode('not json', PROXY)).toBeNull();
  });

  it('refuses an owner that needs no signature, and a bad NodeID', () => {
    const empty = { addresses: [], threshold: 0 };
    expect(conversionProblems(input({ validators: [validator({ deactivationOwner: empty })] }))[0]).toMatch(
      /deactivation owner/,
    );
    expect(
      conversionProblems(input({ validators: [validator({ remainingBalanceOwner: { ...OWNER, threshold: 2 } })] }))[0],
    ).toMatch(/remaining balance owner/);
    expect(conversionProblems(input({ validators: [validator({ nodeID: NODE + 'x' })] }))[0]).toMatch(/NodeID/);
    expect(conversionProblems(input({ managerAddress: '0x1234' }))[0]).toMatch(/not a valid EVM address/);
  });
});

describe('readCChainManager', () => {
  const client = (code: string, subnetID?: string, initialized = false) =>
    ({
      getCode: async () => code,
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'subnetID') {
          if (subnetID === undefined) throw new Error('execution reverted');
          return subnetID;
        }
        return initialized;
      },
    }) as unknown as PublicClient;
  const zero = `0x${'0'.repeat(64)}`;

  it('tells apart no code, another contract, an unset manager, and managers for this or another subnet', async () => {
    expect(await readCChainManager(client('0x'), PROXY, SUBNET)).toEqual({ kind: 'none' });
    expect(await readCChainManager(client('0x60'), PROXY, SUBNET)).toEqual({ kind: 'other' });
    expect(await readCChainManager(client('0x60', zero), PROXY, SUBNET)).toEqual({ kind: 'unset' });
    expect(await readCChainManager(client('0x60', CB58ToHex(SUBNET), true), PROXY, SUBNET)).toEqual({
      kind: 'bound',
      initialized: true,
    });
    expect(await readCChainManager(client('0x60', CB58ToHex(OTHER_SUBNET)), PROXY, SUBNET)).toEqual({
      kind: 'foreign',
      subnetId: OTHER_SUBNET,
    });
  });
});
