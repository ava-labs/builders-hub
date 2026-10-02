import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RwaDashboard, type RwaFeeds } from '@/components/explorer-v2/defi/RwaDashboard';
import { EXPORTS } from '@/components/explorer-v2/defi/rwa-export';
import { FENCE, FENCE_HISTORY, HISTORY, METRICS } from './rwa-fixtures';

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

const render = (feeds: RwaFeeds) => renderToStaticMarkup(<RwaDashboard slug="oatfi" feeds={feeds} onRefresh={async () => undefined} />);

/* every figure, chart and control the old dashboard (fe63440ab^) showed, in the view's copy */
const OLD_DASHBOARD = [
  // header and actions
  'Valinor × OatFi × Fence Pilot',
  'SPV capital flow dashboard on Avalanche C-Chain',
  'Partners',
  'Updated',
  'every 5 min',
  'Export',
  'Refresh',
  // key metrics
  'Key Metrics',
  'Transacted Volume',
  'Lender Invested Capital',
  'Assets Financed',
  'Lender Repayments',
  'Idle Capital',
  'Capital Turnover',
  'Avg Capital Utilization',
  'Days Active',
  'Avg Recycling Time',
  // OatFi breakdown
  'OatFi Breakdown',
  'Capital Outstanding',
  'Principal Repayments',
  'Converted USDC',
  // facility
  'Facility Performance',
  'Paid Collections',
  'Expected Collections',
  'Repayment Ratio',
  'Industry Concentration',
  'Collections Over Time',
  'Data sourced from Fence Finance',
  // capital flow
  'Capital Flow Pipeline',
  'Forward Flow',
  'Return Flow',
  'Capital source',
  'SPV vehicle',
  'Asset originator',
  'Redistribution',
  'Invested',
  'Deployed',
  'Repaid',
  'Pool Status',
  // historical trends and their controls
  'Historical Trends',
  'Transaction Volume Over Time',
  'Capital Utilization',
  'Assets Financed vs Repayments',
  'Lender Invested Capital Over Time',
  'Outstanding Principal',
  'Daily',
  'Weekly',
  'Monthly',
  'All time',
  'Line',
  'Bar',
  'Area',
  'Periodic',
  'Cumulative',
  'Combined',
  'Split',
  // transactions
  'Recent Transactions',
  'Search tx hash',
  'Inbound',
  'Outbound',
  'Date (UTC)',
  'Amount',
  'Tx hash',
  'Show 20 rows',
];

const SECTIONS = ['rwa-metrics', 'rwa-oatfi', 'rwa-fence', 'rwa-capital-flow', 'rwa-historical', 'rwa-transactions'];

describe('the RWA view', () => {
  const html = render(FEEDS);

  it('carries every figure, chart and control the old dashboard had', () => {
    for (const label of OLD_DASHBOARD) expect(html, label).toContain(label);
    expect(html).toContain('aria-label="Avalanche"');
    for (const partner of ['Valinor', 'OatFi', 'Fence']) expect(html, partner).toContain(`alt="${partner}"`);
  });

  it('lays the sections out in the old order, each one a tab of the section rail', () => {
    const at = SECTIONS.map((id) => html.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0), at.join()).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const tab of ['Metrics', 'OatFi', 'Facility', 'Capital Flow', 'Historical', 'Transactions']) expect(html, tab).toMatch(new RegExp(`>${tab}<`));
  });

  it("says when the pool figures were read, with the reader's time zone, since the ledger and Fence's day are UTC", () => {
    expect(html.replace(/<!-- -->/g, '')).toMatch(/Updated [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M [A-Z][A-Za-z0-9+:-]* · every 5 min/);
  });

  it("dates the facility figures by Fence's latest reading", () => {
    expect(html).toContain('as of Oct 1');
  });

  it('defines the two chart tones its charts draw with, in both themes', () => {
    expect(html).toMatch(/--rwa-1:\s*#2a78d6;\s*--rwa-2:\s*#eb6834/);
    expect(html).toMatch(/--rwa-1:\s*#3987e5;\s*--rwa-2:\s*#d95926/);
  });

  it('keeps every other section when Fence is down', () => {
    const down = render({ ...FEEDS, fence: null, fenceFailed: true, fenceHistory: null, fenceHistoryFailed: true });
    expect(down).toContain('Facility figures are unavailable right now');
    expect(down).toContain('$124.2M');
    expect(down).toContain('Capital Flow Pipeline');
  });
});

describe('the export menu', () => {
  it("offers the old dashboard's four exports, in its order", () => {
    expect(EXPORTS.map((e) => e.label)).toEqual(['CSV data', 'Transaction CSV', 'PDF report', 'PNG image']);
  });
});
