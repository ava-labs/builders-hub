import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRIMARY_SUBNET_ID } from '@/lib/pchain-node';

const { getValidatorDetails } = vi.hoisted(() => ({ getValidatorDetails: vi.fn() }));

vi.mock('@avalanche-sdk/chainkit', () => ({
  Avalanche: class {
    data = { primaryNetwork: { getValidatorDetails } };
  },
}));

/* Made-up IDs. */
const NODE = 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SUBNET = 'SubnetBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

const completed = (over: object) => ({
  nodeId: NODE,
  startTimestamp: 1_747_151_457,
  endTimestamp: 1_749_570_717,
  delegatorCount: 0,
  amountDelegated: '0',
  validationStatus: 'completed',
  ...over,
});

async function get() {
  const { GET } = await import('@/app/api/pchain-validations/[network]/[nodeId]/route');
  return GET(new Request(`http://localhost/api/pchain-validations/mainnet/${NODE}`), { params: Promise.resolve({ network: 'mainnet', nodeId: NODE }) });
}

/* the Data API's first page of a node's terms in one status, as the SDK's async iterator */
const pages = (validators: object[]) =>
  (async function* () {
    yield { result: { validators } };
  })();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getValidatorDetails.mockImplementation(async ({ validationStatus }: { validationStatus: string }) =>
    validationStatus === 'completed'
      ? // a subnet validator's term beside the Primary Network term it ran in, with that term's
        // delegators and delegation reward copied onto it
        pages([
          completed({ txHash: 'subnet-term', subnetId: SUBNET, startTimestamp: 1_747_151_575, amountStaked: '1000', delegatorCount: 3, rewards: { validationRewardAmount: '0', delegationRewardAmount: '2173246717' } }),
          completed({ txHash: 'primary-term', subnetId: PRIMARY_SUBNET_ID, amountStaked: '2000000000000', delegationFee: '2.0000', delegatorCount: 3, rewards: { validationRewardAmount: '90318655975', delegationRewardAmount: '2173246717', rewardTxHash: 'reward' } }),
        ])
      : // a later subnet term, taken off before its end by a RemoveSubnetValidatorTx
        pages([{ txHash: 'removed-term', nodeId: NODE, subnetId: SUBNET, amountStaked: '1000', startTimestamp: 1_749_162_457, endTimestamp: 1_751_581_179, removeTxHash: 'remove', removeTimestamp: 1_750_104_675, validationStatus: 'removed' }]),
  );
});

describe('/api/pchain-validations', () => {
  it('tags each term with its network, newest first, a removed subnet term ending at its removal', async () => {
    const { periods } = await (await get()).json();
    expect(periods.map((p: { txHash: string; subnetId: string; endTimestamp: number }) => [p.txHash, p.subnetId, p.endTimestamp])).toEqual([
      ['removed-term', SUBNET, 1_750_104_675],
      ['subnet-term', SUBNET, 1_749_570_717],
      ['primary-term', PRIMARY_SUBNET_ID, 1_749_570_717],
    ]);
  });

  it('totals the Primary Network terms only: a subnet term is neither unrewarded nor paid twice', async () => {
    const { totals } = await (await get()).json();
    expect(totals).toEqual({ periods: 1, validationReward: '90318655975', delegationReward: '2173246717', firstStart: 1_747_151_457, unrewarded: 0 });
  });

  it('still answers with the completed terms when the removed ones cannot be read', async () => {
    const answer = getValidatorDetails.getMockImplementation()!;
    getValidatorDetails.mockImplementation(async (req: { validationStatus: string }) => (req.validationStatus === 'removed' ? Promise.reject(new Error('down')) : answer(req)));
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).periods).toHaveLength(2);
  });
});
