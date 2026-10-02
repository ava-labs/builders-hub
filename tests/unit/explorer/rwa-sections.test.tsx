import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FacilityFigures, KeyMetrics, OatFiBreakdown, PartnerLogos } from '@/components/explorer-v2/defi/rwa-parts';
import { CapitalFlow } from '@/components/explorer-v2/defi/rwa-flow';
import { RwaHistory } from '@/components/explorer-v2/defi/RwaHistory';
import { RwaCollections } from '@/components/explorer-v2/defi/RwaCollections';
import { RwaTransactions, TxCell, matchesSearch } from '@/components/explorer-v2/defi/RwaTransactions';
import type { TransactionRecord } from '@/lib/rwa/types';
import { FENCE, FENCE_HISTORY, HISTORY, METRICS } from './rwa-fixtures';

describe('the key metrics', () => {
  it('show every figure of the old dashboard, the lender split under the invested capital', () => {
    const html = renderToStaticMarkup(<KeyMetrics metrics={METRICS} failed={false} />);
    for (const label of ['Transacted Volume', 'Lender Invested Capital', 'Assets Financed', 'Lender Repayments', 'Idle Capital', 'Capital Turnover', 'Avg Capital Utilization', 'Days Active', 'Avg Recycling Time']) {
      expect(html, label).toContain(label);
    }
    for (const figure of ['$124.2M', '$3M', '$61.5M', '$58.5M', '20.51×', '89.4%', '359', '17.5']) expect(html, figure).toContain(figure);
    expect(html).toContain('Valinor 56% · Avalanche 44%');
    expect(html).toContain('id="rwa-metrics"');
  });
});

describe('the definitions under the figures', () => {
  it('carry their full text on hover, since a narrow card cuts the line', () => {
    const html = renderToStaticMarkup(
      <>
        <KeyMetrics metrics={METRICS} failed={false} />
        <OatFiBreakdown metrics={METRICS} failed={false} />
        <FacilityFigures fence={FENCE} failed={false} />
      </>,
    );
    for (const text of [
      'USDC volume across the tracked addresses',
      'capital deployed from the tranche pool to the borrower',
      'borrower to tranche pool transfers',
      'USDC balance of the tranche pool',
      'assets financed / invested capital',
      'average over days with transfers',
      'since the first tranche to borrower transfer',
      'days active / capital turnover',
      'invested capital minus idle capital',
      'borrower to tranche pool repayments',
      'borrower outflow outside the tranche pool',
      'payments collected to date',
      'payments due up to today',
      'paid / expected collections',
    ]) {
      expect(html, text).toContain(`title="${text}"`);
    }
  });

  it('lead the industry concentration with its limit and whether the facility is within it', () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={FENCE} failed={false} />);
    expect(html).toContain('limit 35% · within · top industry (CL01)');
    expect(html).toContain('title="Top 1 industry concentration (CL01). Limit: 35%. Currently within threshold."');
  });
});

describe('the OatFi breakdown', () => {
  it('shows capital outstanding, principal repayments and converted USDC', () => {
    const html = renderToStaticMarkup(<OatFiBreakdown metrics={METRICS} failed={false} />);
    for (const label of ['OatFi Breakdown', 'Capital Outstanding', 'Principal Repayments', 'Converted USDC']) expect(html, label).toContain(label);
    for (const figure of ['$3M', '$58.5M', '$62.1M']) expect(html, figure).toContain(figure);
    expect(html).toContain('id="rwa-oatfi"');
  });
});

describe('the facility figures', () => {
  it("show Fence's four figures with the concentration limit", () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={FENCE} failed={false} />);
    for (const label of ['Paid Collections', 'Expected Collections', 'Repayment Ratio', 'Industry Concentration']) expect(html, label).toContain(label);
    for (const figure of ['$58.8M', '$57.9M', '101.7%', '12.9%', 'limit 35%', 'within']) expect(html, figure).toContain(figure);
  });

  it('read n/a for a figure Fence did not send, not zero', () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={{ ...FENCE, cl01Concentration: null }} failed={false} />);
    expect(html).toContain('n/a');
    expect(html).not.toContain('0.0%');
  });

  it('say the facility is unavailable when Fence failed before anything was read', () => {
    const html = renderToStaticMarkup(<FacilityFigures fence={null} failed />);
    expect(html).toContain('unavailable');
    expect(html).not.toContain('$');
  });
});

describe('the capital flow pipeline', () => {
  it('draws the forward flow, the return flow and the pool status, each figure once', () => {
    const html = renderToStaticMarkup(<CapitalFlow metrics={METRICS} since="2025-10-07" failed={false} />);
    for (const label of ['Forward Flow', 'Lenders', 'Capital source', 'Tranche Pool', 'SPV vehicle', 'Borrower', 'Asset originator', 'Return Flow', 'Repayments', 'Pool', 'Redistribution', 'Pool Status', 'Idle', 'Utilization']) {
      expect(html, label).toContain(label);
    }
    for (const figure of ['$3M', '$61.5M', '$58.5M']) expect(html.split(figure), figure).toHaveLength(2);
    // utilization of the pool: 1 - idle / invested
    expect(html).toContain('100.0%');
    expect(html).toContain('359 days since Oct 7, 2025');
    expect(html).toContain('id="rwa-capital-flow"');
  });

  it('says the pool figures are unavailable when the read failed before anything arrived', () => {
    const html = renderToStaticMarkup(<CapitalFlow metrics={null} since={null} failed />);
    expect(html).toContain('unavailable');
    expect(html).not.toContain('…');
  });
});

describe('the partner logos', () => {
  it('name the four partners', () => {
    const html = renderToStaticMarkup(<PartnerLogos />);
    for (const name of ['Avalanche', 'Valinor', 'OatFi', 'Fence']) expect(html, name).toContain(name);
  });
});

describe('the historical trends', () => {
  it('draw all five charts of the old dashboard under the interval and range controls', () => {
    const html = renderToStaticMarkup(<RwaHistory historical={HISTORY} failed={false} />);
    for (const text of [
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
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain('id="rwa-historical"');
  });
});

describe('the collections over time', () => {
  it('chart paid against expected with the interval, range, view and split controls, and name Fence as the source', () => {
    const html = renderToStaticMarkup(<RwaCollections history={FENCE_HISTORY} failed={false} />);
    for (const text of ['Collections Over Time', 'Paid vs Expected Collections', 'Daily', 'All time', 'Periodic', 'Cumulative', 'Combined', 'Split', 'Data sourced from Fence Finance']) {
      expect(html, text).toContain(text);
    }
  });
});

describe('the recent transactions', () => {
  const transfer: TransactionRecord = {
    txHash: '0x34ef64fa694a92920355cba517b5fe72f3ea1edee7ccd4b6113c5067515c0b69',
    timestamp: '2026-10-01T16:03:36.000Z',
    from: '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a',
    fromLabel: 'Tranche Pool',
    to: '0x41d9569610dae2b6696797382fb26b5156db426f',
    toLabel: 'Borrower Operating',
    amount: 136_310_930_000n,
    direction: 'internal',
  };

  it('offer the search, the direction cut and the row count, and open every transaction on the Builder Hub explorer', () => {
    const html = renderToStaticMarkup(<RwaTransactions slug="oatfi" />);
    for (const text of ['Recent Transactions', 'Search tx hash or address', 'All', 'Inbound', 'Outbound', 'Internal', 'Show 20 rows']) {
      expect(html, text).toContain(text);
    }
    for (const gone of ['<select', 'Snowtrace', 'Avalanche Explorer']) expect(html, gone).not.toContain(gone);
    expect(html).toContain('id="rwa-transactions"');
  });

  it('link the transaction hash itself, not only the arrow, to its Builder Hub page', () => {
    const html = renderToStaticMarkup(<TxCell hash={transfer.txHash} />);
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(([, href, inner]) => ({ href, inner }));
    expect(links.map((l) => l.href)).toEqual([`/explorer/mainnet/c-chain/tx/${transfer.txHash}`, `/explorer/mainnet/c-chain/tx/${transfer.txHash}`]);
    expect(links[0].inner).toContain('0x34ef');
  });

  it('match a search against the hash, the addresses and their names, in any case', () => {
    expect(matchesSearch(transfer, '')).toBe(true);
    expect(matchesSearch(transfer, '0x34EF')).toBe(true);
    expect(matchesSearch(transfer, 'tranche')).toBe(true);
    expect(matchesSearch(transfer, '41d95696')).toBe(true);
    expect(matchesSearch(transfer, 'valinor')).toBe(false);
  });
});

