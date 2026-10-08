import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { leadSeat, validatedAsSubnet } from '@/components/explorer-v2/pchain/node-data';
import { L1ValidatorView } from '@/components/explorer-v2/pchain/node-l1';
import { SubnetTerms, ValidationHistory } from '@/components/explorer-v2/pchain/node-record';
import type { NodeResponse, ValidationPeriod, ValidationsResponse } from '@/lib/pchain-explorer';
import { PRIMARY_SUBNET_ID } from '@/lib/pchain-node';

/* Made-up IDs. */
const NODE = 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const L1 = 'SubnetBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const OTHER = 'SubnetCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const CONVERT_TX = 'ConvertDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const BASE = '/explorer/mainnet/p-chain';

/* a node document: off the Primary Network now, with 100 old staking txs and one L1 seat */
function doc(over: Partial<NodeResponse> = {}): NodeResponse {
  return {
    nodeId: NODE,
    lastSnapshotTimestamp: 0,
    hasSnapshot: false,
    validator: { txId: '', subnetId: '', weight: 0, delegatorCount: 0, delegatorWeight: 0, totalStake: 0, delegationFeePercent: 0, potentialReward: 0, connected: false, startTimestamp: 0, endTimestamp: 0, daysLeft: 0 },
    history: [
      { txHash: 'tx-subnet', txType: 'AddSubnetValidatorTx', blockTimestamp: 1_747_151_575, weight: 1000, subnetId: L1 },
      { txHash: 'tx-stake', txType: 'AddPermissionlessValidatorTx', blockTimestamp: 1_747_151_457, weight: 2_000_000_000_000, subnetId: PRIMARY_SUBNET_ID },
    ],
    validations: [{ kind: 'l1', subnetId: L1, validationId: 'seat', weight: 1000, balance: 3_083_618_048 }],
    delegators: [],
    delegatorsPotentialReward: 0,
    uptime: { sampleCount: 0, currentP50: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 },
    uptimeHistory: [],
    proposedBlocks14d: 0,
    ...over,
  };
}

const term = (over: Partial<ValidationPeriod>): ValidationPeriod => ({
  txHash: 'term',
  startTimestamp: 1_747_151_457,
  endTimestamp: 1_749_570_717,
  amountStaked: '2000000000000',
  delegationFeePercent: 5,
  delegatorCount: 0,
  amountDelegated: '0',
  validationReward: '8818770450',
  delegationReward: '0',
  rewardTxHash: 'reward',
  rewarded: true,
  ...over,
});

/* one Primary Network term, and the subnet term that ran beside it; the Data API copies the
   primary term's delegators onto the subnet one */
const terms: ValidationsResponse = {
  nodeId: NODE,
  periods: [
    term({ txHash: 'subnet-term', subnetId: L1, amountStaked: '1000', delegationFeePercent: 0, delegatorCount: 3, validationReward: '0', rewardTxHash: undefined, rewarded: false }),
    term({ txHash: 'primary-term', subnetId: PRIMARY_SUBNET_ID }),
  ],
  totals: { periods: 1, validationReward: '8818770450', delegationReward: '0', firstStart: 1_747_151_457, unrewarded: 0 },
};

describe('the seat that leads the node page', () => {
  it('is the L1 seat for a node off the Primary Network, even with staking history', () => {
    expect(leadSeat(doc(), undefined)).toBe(L1);
  });

  it('is the hinted subnet when the document holds that seat, or none yet', () => {
    expect(leadSeat(doc(), L1)).toBe(L1);
    expect(leadSeat(doc({ validations: [] }), OTHER)).toBe(OTHER);
  });

  it('is the document\'s seat when an old link hints an L1 the node has left', () => {
    expect(leadSeat(doc(), OTHER)).toBe(L1);
  });

  it('is none for a node in the Primary Network snapshot: its stake leads', () => {
    expect(leadSeat(doc({ hasSnapshot: true }), undefined)).toBeUndefined();
    expect(leadSeat(doc({ hasSnapshot: true }), L1)).toBeUndefined();
  });

  it('is none for a node with no seat, and before the document loads', () => {
    expect(leadSeat(doc({ validations: [] }), undefined)).toBeUndefined();
    expect(leadSeat(null, L1)).toBeUndefined();
  });
});

describe('a node that validated its L1 back when it was a subnet', () => {
  it('reads from a completed subnet term or an AddSubnetValidatorTx', () => {
    expect(validatedAsSubnet(L1, null, terms)).toBe(true);
    expect(validatedAsSubnet(L1, doc(), null)).toBe(true);
  });

  it('is false for a seat on a subnet the node never validated as one', () => {
    expect(validatedAsSubnet(OTHER, doc(), terms)).toBe(false);
    expect(validatedAsSubnet(undefined, doc(), terms)).toBe(false);
  });
});

describe('the seat view', () => {
  const seat = { nodeID: NODE, weight: '1000', balance: '3083618048', validationID: 'seat', startTime: '1749836379' };
  const view = (conversion?: { subnetId: string; txHash: string | null; timestamp: number | null }) =>
    renderToStaticMarkup(<L1ValidatorView network="mainnet" nodeId={NODE} subnetId={L1} v={seat} conversion={conversion} base={BASE} />);

  it('says when the subnet became an L1, with a link to the ConvertSubnetToL1Tx', () => {
    const html = view({ subnetId: L1, txHash: CONVERT_TX, timestamp: 1_749_836_379 });
    expect(html).toContain('ran as a subnet until it');
    expect(html).toContain(`href="${BASE}/tx/${CONVERT_TX}"`);
    expect(html).toContain('converted to an L1');
    expect(html).toContain('on 2025-06-13.');
  });

  it('names an L1 seat an L1, and leaves the conversion out when there is none', () => {
    const html = view();
    expect(html).not.toContain('ran as a subnet');
    expect(html).toContain('L1 SubnetBB…BBBB');
    expect(html).not.toMatch(/>Subnet</);
  });
});

describe('the past terms', () => {
  it('keep a subnet term out of the Primary Network ledger', () => {
    const html = renderToStaticMarkup(<ValidationHistory data={terms} base={BASE} />);
    expect(html).toContain(`href="${BASE}/tx/primary-term"`);
    expect(html).not.toContain('subnet-term');
    expect(html).not.toContain('no reward');
    expect(html).not.toContain('unrewarded');
  });

  it('list a subnet term with its weight, not stake or reward', () => {
    const html = renderToStaticMarkup(<SubnetTerms data={terms} base={BASE} />);
    expect(html).toContain('Past Subnet Terms');
    expect(html).toContain(`href="${BASE}/tx/subnet-term"`);
    expect(html).not.toContain('primary-term');
    expect(html).toContain('1,000');
    expect(html).not.toContain('AVAX');
  });
});
