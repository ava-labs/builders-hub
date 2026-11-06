import { describe, expect, it } from 'vitest';
import { planLegacyClaim } from '@/server/services/legacy-validator-alerts';

const NODE_A = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const NODE_B = 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ';
const L1 = '2uoDdh9FZi4HFDKQMYAztVXSYEwYkknvo9EZJfnQbYrVw8k75n';

describe('planLegacyClaim', () => {
  it('attaches every row when the user has no alerts', () => {
    const plan = planLegacyClaim([], [
      { id: 'r1', node_id: NODE_A, subnet_id: 'primary' },
      { id: 'r2', node_id: NODE_B, subnet_id: 'primary' },
    ]);
    expect(plan).toEqual({ attach: ['r1', 'r2'], drop: [] });
  });

  it('drops a row for a node the user already watches on the same network', () => {
    const plan = planLegacyClaim(
      [{ node_id: NODE_A, subnet_id: 'primary' }],
      [
        { id: 'r1', node_id: NODE_A, subnet_id: 'primary' },
        { id: 'r2', node_id: NODE_B, subnet_id: 'primary' },
      ],
    );
    expect(plan).toEqual({ attach: ['r2'], drop: ['r1'] });
  });

  it('keeps a row when the user watches the same node on another network', () => {
    const plan = planLegacyClaim(
      [{ node_id: NODE_A, subnet_id: L1 }],
      [{ id: 'r1', node_id: NODE_A, subnet_id: 'primary' }],
    );
    expect(plan).toEqual({ attach: ['r1'], drop: [] });
  });

  it('attaches the first of two unclaimed rows for one node and drops the other', () => {
    const plan = planLegacyClaim([], [
      { id: 'old', node_id: NODE_A, subnet_id: 'primary' },
      { id: 'new', node_id: NODE_A, subnet_id: 'primary' },
    ]);
    expect(plan).toEqual({ attach: ['old'], drop: ['new'] });
  });

  it('attaches past the 20-alert cap instead of dropping data', () => {
    const owned = Array.from({ length: 20 }, (_, i) => ({ node_id: `owned-${i}`, subnet_id: 'primary' }));
    const plan = planLegacyClaim(owned, [{ id: 'r1', node_id: NODE_A, subnet_id: 'primary' }]);
    expect(plan).toEqual({ attach: ['r1'], drop: [] });
  });

  it('returns an empty plan for no rows', () => {
    expect(planLegacyClaim([{ node_id: NODE_A, subnet_id: 'primary' }], [])).toEqual({ attach: [], drop: [] });
  });
});
