import { describe, expect, it } from 'vitest';

import { currentUptime } from '@/components/explorer-v2/pchain/node-data';

/* On 2026-10-19 the validators list showed NodeID-BVjnU… at 90.50% and its
   node page at 93.37%. The list reads the P2P observatory; the page's
   headline read the node document, whose hourly median swings between about
   91% and 93.5%. The page now leads with the observatory too. */

const doc = { uptime: { sampleCount: 9490, currentP50: 93.3666, min: 91.08, max: 99.47, avg: 97.8, p50: 99.34, p95: 99.46 } };

describe('the uptime a node page leads with', () => {
  it("is the observatory's reading, as on the validators list", () => {
    expect(currentUptime(doc, { current_p50_uptime: 90.4937 })).toBe(90.4937);
  });

  it("falls back to the node document's when the observatory has none", () => {
    expect(currentUptime(doc, null)).toBe(93.3666);
    expect(currentUptime(doc, { current_p50_uptime: Number.NaN })).toBe(93.3666);
  });
});
