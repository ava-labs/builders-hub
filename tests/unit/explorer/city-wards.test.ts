import { describe, expect, it } from 'vitest';

import { planCity, type CityChain } from '@/components/explorer-v2/network/city';
import type { District } from '@/components/explorer-v2/network/districts';

// The city's wards share the circle round downtown (planCity, arcsOf). The front ward (Finance) faces the viewer.
// The wards on each side of it share a half of the circle when their weights balance, as on mainnet. When one ward
// holds most of the city, as on Fuji, each ward's arc follows its weight, so a ward of one chain gets no half circle.

const GEOMETRY = { cx: 600, cy: 352, tilt: 0.5, reach: 444, hub: { w: 27, h: 150 } };
const TAU = 2 * Math.PI;

function chainsOf(counts: Partial<Record<District, number>>): CityChain[] {
  return Object.entries(counts).flatMap(([district, n]) =>
    Array.from({ length: n ?? 0 }, (_, i) => ({ id: `${district}-${i}`, district: district as District, talks: 0, validators: 1, newAt: null })),
  );
}

function spans(counts: Partial<Record<District, number>>): Record<string, { a0: number; a1: number }> {
  return Object.fromEntries(planCity(chainsOf(counts), GEOMETRY).wards.map((w) => [w.district, { a0: w.a0, a1: w.a1 }]));
}

describe('the city wards', () => {
  it('give the wards beside the front ward a half circle each when they balance', () => {
    // mainnet's districts on 2026-10-06
    const s = spans({ finance: 15, enterprise: 11, ai: 3, gaming: 7, culture: 10, infrastructure: 4, frontier: 18 });
    const starts = Math.min(...Object.values(s).map((w) => w.a0));
    const ends = Math.max(...Object.values(s).map((w) => w.a1));
    expect(starts).toBeCloseTo(-Math.PI / 2, 9);
    expect(ends).toBeCloseTo((3 * Math.PI) / 2, 9);
    expect((s.finance.a0 + s.finance.a1) / 2).toBeCloseTo(Math.PI / 2, 9);
  });

  it('give each ward an arc by its weight when one ward holds most of the city', () => {
    // Fuji's districts: Dexalot L1 in Finance, Beam L1 in Gaming, the rest on the Frontier
    const s = spans({ finance: 1, gaming: 1, frontier: 150 });
    const arc = (k: string) => s[k].a1 - s[k].a0;
    expect(arc('frontier')).toBeGreaterThan((300 / 360) * TAU);
    expect(arc('gaming')).toBeLessThan((20 / 360) * TAU);
    expect(arc('finance') + arc('gaming') + arc('frontier')).toBeCloseTo(TAU, 9);
    expect((s.finance.a0 + s.finance.a1) / 2).toBeCloseTo(Math.PI / 2, 9);
  });
});
