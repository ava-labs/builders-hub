import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RwaDashboard, type RwaFeeds } from '@/components/explorer-v2/defi/RwaDashboard';
import { RWA_VIEWS } from '@/components/explorer-v2/defi/rwa-views';
import { RWA_FACILITIES, getFacility } from '@/lib/rwa/facilities';
import { RAIN_HISTORY, RAIN_METRICS } from './rwa-fixtures';

/* Rain's page: the Valinor x Rain x Credit Coop line of credit in OatFi's
   dashboard, its title, partners, sections and capital flow from its view,
   its figures from the line's events and position. */

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

const SECTIONS = ['rwa-metrics', 'rwa-capital-flow', 'rwa-historical', 'rwa-transactions'];

describe("Rain's dashboard", () => {
  const html = renderToStaticMarkup(<RwaDashboard view={RWA_VIEWS.rain} feeds={RAIN_FEEDS} onRefresh={async () => undefined} />);

  it("carries Rain's header, figures and sections", () => {
    for (const text of [
      'Valinor × Rain × Credit Coop',
      'Line of credit capital flow dashboard on Avalanche C-Chain',
      'Partners',
      'Updated',
      'Export',
      'Refresh',
      'Key Metrics',
      'Lender Invested Capital',
      'Assets Financed',
      'across 233 draws',
      'Lender Repayments',
      'Capital Outstanding',
      'Idle Capital',
      'Capital Turnover',
      'Avg Capital Utilization',
      'Days Active',
      'Avg Recycling Time',
      'Capital Flow Pipeline',
      'Forward Flow',
      'Return Flow',
      'Valinor Credit Vault',
      'Capital source',
      'Line of credit',
      'Credit Coop',
      'Drawn',
      'Spigot',
      'Rain&#x27;s revenue',
      'Repaid',
      'Line Status',
      'Historical Trends',
      'Capital Utilization',
      'Assets Financed vs Repayments',
      'Lender Invested Capital Over Time',
      'Outstanding Principal',
      'Recent Transactions',
      'indexed from the C-Chain',
    ]) {
      expect(html, text).toContain(text);
    }
    for (const figure of ['$250K', '$17.2M', '$17M', '$203.5K', '$46.5K', '68.90×', '28.7%', '255', '3.7']) expect(html, figure).toContain(figure);
    expect(html).toContain('aria-label="Avalanche"');
    for (const partner of ['Valinor', 'Rain', 'Credit Coop']) expect(html, partner).toContain(`alt="${partner}"`);
  });

  it("lays out Rain's four sections in order, each a tab of the rail, and none of OatFi's", () => {
    const at = SECTIONS.map((id) => html.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0), at.join()).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    for (const id of ['rwa-oatfi', 'rwa-fence']) expect(html, id).not.toContain(`id="${id}"`);
    for (const tab of ['Metrics', 'Capital Flow', 'Historical', 'Transactions']) expect(html, tab).toMatch(new RegExp(`>${tab}<`));
    for (const tab of ['OatFi', 'Facility']) expect(html, tab).not.toMatch(new RegExp(`>${tab}<`));
  });

  it('shows no transacted volume, no OatFi or Fence figure, and no interest or term figure', () => {
    for (const gone of [
      'Transacted Volume',
      'Transaction Volume Over Time',
      'OatFi Breakdown',
      'Principal Repayments',
      'Converted USDC',
      'Facility Performance',
      'Pool Status',
      'Interest Repaid',
      'Interest Rate',
      'APR',
      'Deadline',
    ]) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it("defines Rain's figures under them, the whole text on hover", () => {
    for (const text of [
      'Capital committed to the line of credit, as the contract reads it',
      'Draws from the line of credit to the borrower',
      'repayments to the line of credit, interest included',
      'Principal drawn and not yet repaid, as the contract reads it',
      'committed capital minus outstanding',
      'assets financed / committed capital',
      'Average over the days with a draw, a repayment or a change of committed capital',
      'since the first draw',
      'days active / capital turnover',
    ]) {
      expect(html, text).toContain(`title="${text}"`);
    }
  });

  it("keeps Rain's partner marks in public/ under names Vercel serves", () => {
    for (const p of RWA_VIEWS.rain.partners) {
      expect(p.src).toMatch(/^\/rwa\/logos\/[a-z0-9-]+\.svg$/);
      const svg = readFileSync(join(process.cwd(), 'public', p.src), 'utf8');
      expect(svg).toMatch(/^<(\?xml|svg)/);
      expect(svg).not.toMatch(/<script|on\w+=/i);
    }
  });
});

describe('the facility views', () => {
  it('give each view the facility its key names, so the ledger and the exports always find it', () => {
    expect(Object.keys(RWA_VIEWS)).toEqual(Object.keys(RWA_FACILITIES));
    for (const [slug, view] of Object.entries(RWA_VIEWS)) {
      expect(view.facility, slug).toBe(RWA_FACILITIES[slug]);
      expect(view.facility.slug, slug).toBe(slug);
      expect(getFacility(view.facility.slug), slug).toBe(view.facility);
    }
  });
});
