import { cloneElement, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/* the real container sizes its chart from the DOM, which a static render has none of: a fixed size instead */
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      isValidElement(children) ? cloneElement(children, { width: 640, height: 260 }) : null,
  };
});

import { RwaChart, type ChartKind } from '@/components/explorer-v2/defi/rwa-chart';

const ROWS = [
  { date: '2026-09-28', v: 1 },
  { date: '2026-09-29', v: 2 },
  { date: '2026-09-30', v: 3 },
];

describe('an RWA chart', () => {
  it.each<ChartKind>(['line', 'bar', 'area'])('draws its axes, grid and brush as a %s chart', (kind) => {
    const html = renderToStaticMarkup(
      <RwaChart id="t" title="T" series={[{ key: 'v', label: 'V', color: '#2a78d6' }]} rows={ROWS} interval="daily" fmt={String} kind={kind} />,
    );
    for (const part of ['recharts-xAxis', 'recharts-yAxis', 'recharts-cartesian-grid', 'recharts-brush']) expect(html, part).toContain(part);
  });
});
