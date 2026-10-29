import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RwaDashboard, type RwaFeeds } from '@/components/explorer-v2/defi/RwaDashboard';
import { RwaIncidentBanner } from '@/components/explorer-v2/defi/rwa-incident';
import { RWA_VIEWS } from '@/components/explorer-v2/defi/rwa-views';
import { RWA_INCIDENT } from '@/lib/rwa/constants/incident';
import { RWA_FACILITIES } from '@/lib/rwa/facilities';
import { FENCE, FENCE_HISTORY, HISTORY, METRICS, RAIN_HISTORY, RAIN_METRICS } from './rwa-fixtures';

/* The incident banner is about OatFi's tranche pool, so it shows on OatFi's
   dashboard and never on Rain's, whose line of credit is a separate contract. */

const OATFI_FEEDS: RwaFeeds = {
  metrics: METRICS,
  metricsFailed: false,
  historical: HISTORY,
  historicalFailed: false,
  fence: FENCE,
  fenceFailed: false,
  fenceHistory: FENCE_HISTORY,
  fenceHistoryFailed: false,
};

const RAIN_FEEDS: RwaFeeds = {
  metrics: RAIN_METRICS,
  metricsFailed: false,
  historical: RAIN_HISTORY,
  historicalFailed: false,
  fence: null,
  fenceFailed: false,
  fenceHistory: null,
  fenceHistoryFailed: false,
};

describe('the incident banner', () => {
  it("names OatFi's tranche pool, read from the facility registry", () => {
    expect(RWA_INCIDENT.pool).toBe(RWA_FACILITIES.oatfi.pool.address);
  });

  it("shows on OatFi's dashboard", () => {
    const html = renderToStaticMarkup(<RwaDashboard view={RWA_VIEWS.oatfi} feeds={OATFI_FEEDS} onRefresh={async () => undefined} />);
    expect(html).toContain(RWA_INCIDENT.title);
    expect(html).toContain('Do not deposit into this pool.');
    expect(html).toContain(`https://snowtrace.io/address/${RWA_FACILITIES.oatfi.pool.address}`);
  });

  it("never shows on Rain's dashboard", () => {
    const html = renderToStaticMarkup(<RwaDashboard view={RWA_VIEWS.rain} feeds={RAIN_FEEDS} onRefresh={async () => undefined} />);
    expect(html).not.toContain(RWA_INCIDENT.title);
    expect(html).not.toContain('Do not deposit');
  });

  it('matches the pool whatever its letter case, and nothing else', () => {
    expect(renderToStaticMarkup(<RwaIncidentBanner facilityPool={RWA_INCIDENT.pool.toLowerCase()} />)).toContain(RWA_INCIDENT.title);
    expect(renderToStaticMarkup(<RwaIncidentBanner facilityPool={RWA_FACILITIES.rain.pool.address} />)).toBe('');
  });
});
