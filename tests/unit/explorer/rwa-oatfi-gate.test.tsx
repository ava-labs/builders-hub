import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { RwaDashboard, type RwaFeeds } from '@/components/explorer-v2/defi/RwaDashboard';
import { RWA_VIEWS } from '@/components/explorer-v2/defi/rwa-views';
import { FENCE, FENCE_HISTORY, HISTORY, METRICS } from './rwa-fixtures';

/* OatFi's dashboard as it rendered before Rain's view came in, pinned by a
   digest of its whole markup: any change a reader of OatFi's page could see
   fails here. The clock is frozen and the "Updated" line, which reads the
   reader's own clock and zone, is cut out. React's useId values (_R_<tree>_,
   and _R_<tree>H<n>_ for a component's later ids) are normalized: they
   encode the shape of the tree, not anything on the page. */

const FEEDS: RwaFeeds = {
  metrics: METRICS,
  metricsFailed: false,
  historical: HISTORY,
  historicalFailed: false,
  fence: FENCE,
  fenceFailed: false,
  fenceHistory: FENCE_HISTORY,
  fenceHistoryFailed: false,
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("OatFi's dashboard", () => {
  it('renders as it did before the dashboard read a facility view', () => {
    const html = renderToStaticMarkup(<RwaDashboard view={RWA_VIEWS.oatfi} feeds={FEEDS} onRefresh={async () => undefined} />)
      .replace(/<!-- -->/g, '')
      .replace(/Updated [^<]*· every 5 min/, 'Updated · every 5 min')
      .replace(/_R_[0-9a-z]+(?:H[0-9a-z]+)?_/g, '_R_id_');
    expect(createHash('sha256').update(html).digest('hex')).toBe('0d04a5723c8201eaa2ce3e3ed325827f24bc1bd530dcad7efd9c54ed4d4312ae');
  });
});
