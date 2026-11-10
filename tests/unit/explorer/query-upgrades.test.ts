import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELICON_ACTIVATION } from '@/constants/helicon';
import { MAINNET_UPGRADES } from '@/constants/network-upgrades';
import { recipeKey } from '@/lib/explorer-query/cache';
import { literalWindow } from '@/lib/explorer-query/guard';
import { pchainPrompt, promptVersion, shareTurn, systemPrompt, userTurn } from '@/lib/explorer-query/prompt';
import { scoped } from '@/lib/explorer-query/scope';
import { markUpgrades, namedUpgrades, namesUpgrade, upgradeLines, upgradeTurn, upgradesLine } from '@/lib/explorer-query/upgrades';
import type { VisualSpec } from '@/lib/explorer-query/visual';

/* Network upgrades in Query. A tester asked the mainnet P-Chain "has the % of circulating avax staked increased
   since the helicon upgrade" and got no chart in 6 of 6 runs: the writer had no upgrade date. */

const NOW = new Date('2026-10-16T15:00:00Z');
const at = (name: string) => new Date(MAINNET_UPGRADES.find((u) => u.name === name)!.at).toISOString();

describe('the mainnet upgrade times', () => {
  it("are AvalancheGo's mainnet config, upgrade/upgrade.go at 4d91d6458c40", () => {
    // each value as upgrade.go writes it (time.Date(..., time.UTC)), lines 20 to 41
    expect(Object.fromEntries(MAINNET_UPGRADES.map((u) => [u.name, new Date(u.at).toISOString()]))).toEqual({
      'Apricot Phase 1': '2021-03-31T14:00:00.000Z',
      'Apricot Phase 2': '2021-05-10T11:00:00.000Z',
      'Apricot Phase 3': '2021-08-24T14:00:00.000Z',
      'Apricot Phase 4': '2021-09-22T21:00:00.000Z',
      'Apricot Phase 5': '2021-12-02T18:00:00.000Z',
      'Apricot Phase 6': '2022-09-06T20:00:00.000Z',
      Banff: '2022-10-18T16:00:00.000Z',
      Cortina: '2023-04-25T15:00:00.000Z',
      Durango: '2024-03-06T16:00:00.000Z',
      Etna: '2024-12-16T17:00:00.000Z',
      Fortuna: '2025-04-08T15:00:00.000Z',
      Granite: '2025-11-19T16:00:00.000Z',
      Helicon: '2026-09-22T15:00:00.000Z',
    });
    // RELEASES.md v1.15.0: Helicon activates these ACPs
    expect(MAINNET_UPGRADES.find((u) => u.name === 'Helicon')?.acps).toEqual([194, 236, 267, 273, 283, 285]);
    // oldest first, as the writer reads the list
    expect(MAINNET_UPGRADES.map((u) => u.at)).toEqual([...MAINNET_UPGRADES.map((u) => u.at)].sort((a, b) => a - b));
  });

  it("agree with the staking pages' own Helicon time", () => {
    expect(at('Helicon')).toBe(new Date(HELICON_ACTIVATION.mainnet).toISOString());
  });
});

describe('an upgrade a question names', () => {
  it('is found by its name in any case, by an Apricot phase in any spelling, and as the last upgrade', () => {
    const names = (q: string) => namedUpgrades(q, NOW.getTime()).map((u) => u.name);
    expect(names('has the % of circulating avax staked increased since the helicon upgrade')).toEqual(['Helicon']);
    expect(names('Fees before and after HELICON')).toEqual(['Helicon']);
    expect(names('gas price since Apricot Phase 3, and since AP5 and ApricotPhase4')).toEqual(['Apricot Phase 3', 'Apricot Phase 4', 'Apricot Phase 5']);
    expect(names('stake between Etna and Durango')).toEqual(['Durango', 'Etna']);
    expect(names('how much of the supply is staked compared to before the last upgrade')).toEqual(['Helicon']);
    // before Helicon activated, the last upgrade was Granite
    expect(namedUpgrades('since the latest network upgrade', Date.parse('2026-09-01T00:00:00Z')).map((u) => u.name)).toEqual(['Granite']);
    // "the upgrade" beside a word of time is the newest one too; a version question's "upgrade" is not
    expect(names('has staking participation dropped after the upgrade')).toEqual(['Helicon']);
    expect(names('which validators still need to upgrade')).toEqual([]);
    // a plain word is an upgrade only beside a word of time or "upgrade": Granite and Fortuna are names of other things
    expect(names('swaps on granite this week')).toEqual([]);
    expect(names('fortuna token transfers today')).toEqual([]);
    expect(names('fees since Granite')).toEqual(['Granite']);
    expect(names('blocks after the fortuna upgrade')).toEqual(['Fortuna']);
    expect(names('fees between granite and helicon')).toEqual(['Granite', 'Helicon']);
    expect(names('fees between helicon and granite')).toEqual(['Granite', 'Helicon']);
    // a month names the newest upgrade of that month, and a year narrows it
    expect(names('has staking gone up as a share of supply since the September upgrade')).toEqual(['Helicon']);
    expect(names('fees since the March 2024 upgrade')).toEqual(['Durango']);
    expect(names('fees since the December upgrade')).toEqual(['Etna']);
    // "current" names a version line, not an upgrade
    expect(names('validators on the current upgrade')).toEqual([]);
    expect(names('staked AVAX per day')).toEqual([]);
    expect(names('validators that upgraded to 1.15')).toEqual([]);
  });

  it('names a date even when it has no mainnet time yet', () => {
    expect(namesUpgrade('stake since Igloo')).toBe(true);
    expect(namedUpgrades('stake since Igloo')).toEqual([]);
    expect(upgradeTurn('stake since Igloo', NOW)).toContain('Igloo has no mainnet activation time yet');
  });

  it("gives the writer its activation and a window that holds the days before it and since, in the question's turn", () => {
    const turn = upgradeTurn('did staking go up since Helicon?', NOW);
    expect(turn).toBe(
      " Helicon activated on mainnet at 2026-09-22 15:00:00 UTC (September 22, 2026). A question about the time before, after or since it reads daily buckets from toDate('2026-09-22') - INTERVAL 30 DAY to now, unless it names another window, so one series holds the days before Helicon and the days since; the title and note name the upgrade and its date.",
    );
    // an upgrade older than 400 days reads weeks: Durango's days to now are 950 rows
    expect(upgradeTurn('transactions per week since durango', NOW)).toContain("reads weekly buckets from toMonday(toDate('2024-03-06')) - INTERVAL 4 WEEK to now");
    expect(upgradeTurn('validators now', NOW)).toBe('');
    // an EVM chain's tables limit one query's window (raw_txs reads 365 days): the window starts no earlier
    expect(upgradeTurn('weekly median gas price since Etna', NOW, true)).toContain("If that window passes a table's limit, start at the limit, and the note says the chart starts after the upgrade.");
    expect(upgradeTurn('weekly median gas price since Etna', NOW)).not.toContain("a table's limit");
  });

  it('puts the turn in every mainnet target and leaves Fuji as it was', () => {
    const q = 'has the % of circulating avax staked increased since the helicon upgrade';
    for (const chainId of [1, 43114, 8021, 0]) expect(userTurn(chainId, q, NOW), String(chainId)).toContain('Helicon activated on mainnet at 2026-09-22 15:00:00 UTC');
    expect(userTurn(5, q, NOW)).toBe(q);
    expect(userTurn(43113, q, NOW)).toBe(q);
  });

  it("is in the recipe key with the share turn, so a kept recipe written before a change to either is asked again", () => {
    const q = 'staking ratio since helicon';
    const norm = q;
    const version = promptVersion(1);
    expect(recipeKey(1, q)).toBe(createHash('sha256').update(`1\n${version}\n${norm}\n\n${upgradeTurn(q)}${shareTurn(1, q)}`).digest('hex').slice(0, 32));
    // the C-Chain's key holds its own turn, with the table limit
    const c = 'daily transactions since etna';
    expect(recipeKey(43114, c)).toBe(createHash('sha256').update(`43114\n${promptVersion(43114)}\n${c}\n\n${upgradeTurn(c, new Date(), true)}`).digest('hex').slice(0, 32));
    // Fuji's key is the one it was: no turn in it
    expect(recipeKey(5, q)).toBe(createHash('sha256').update(`5\n${promptVersion(5)}\n${norm}\n`).digest('hex').slice(0, 32));
  });
});

describe('the upgrade times in the system prompt', () => {
  it('list every upgrade on the mainnet P-Chain and C-Chain, and the table that holds them', () => {
    const line = upgradesLine(true);
    for (const u of MAINNET_UPGRADES) expect(line).toContain(u.name);
    expect(line).toContain('Helicon 2026-09-22 15:00');
    expect(line).toContain('Igloo has no mainnet time yet');
    expect(pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null })).toContain(line);
    expect(systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null })).toContain(line);
  });

  it('are not in the prompts of Fuji or an L1, which have no such table', () => {
    expect(pchainPrompt({ chainId: 5, network: 'fuji', schema: '', coverage: null, lines: null })).not.toContain('Network upgrades');
    expect(systemPrompt({ chainId: 43113, chainName: 'Avalanche Fuji C-Chain', symbol: 'AVAX', schema: '', coverage: null })).not.toContain('Network upgrades');
    expect(systemPrompt({ chainId: 8021, chainName: 'Numine', symbol: 'NUMI', schema: '', coverage: null })).not.toContain('network_upgrades');
  });
});

describe('a date the query writes out', () => {
  const SQL = "SELECT toDate(snapshot_time) AS t FROM p_validator_snapshots WHERE chain_id = 1 AND snapshot_time >= toDate('2026-09-22') - INTERVAL 30 DAY GROUP BY t";

  it("is an upgrade's activation when the question names the upgrade, so it stays a date", () => {
    expect(literalWindow(SQL, 'has the % of circulating avax staked increased since the helicon upgrade', 1, NOW)).toBeNull();
    expect(literalWindow(SQL, 'staking ratio since the last upgrade', 1, NOW)).toBeNull();
  });

  it('is still sent back when the question names no date and no upgrade', () => {
    expect(literalWindow(SQL, 'staked AVAX per day lately', 1, NOW)).toContain('the query writes the date 2026-09-22 out');
  });
});

describe('the chart of a question that names an upgrade', () => {
  const panel = (kind: 'line' | 'bar' | 'hbar', x = 't') => ({ title: 'Staked share', kind, x, series: [{ column: 'staked_pct', label: 'Staked share', format: 'percent' as const, axis: 'left' as const, mark: 'auto' as const, transform: 'none' as const, dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc' as const, referenceLines: [], width: 'full' as const });
  const visual = (...panels: ReturnType<typeof panel>[]): VisualSpec => ({ stats: [], panels, callouts: [] });
  const days = Array.from({ length: 55 }, (_, i) => ({ t: new Date(Date.UTC(2026, 7, 23 + i)).toISOString().slice(0, 10), staked_pct: 43 }));

  it('marks the day the upgrade activated on each time panel, once', () => {
    const out = markUpgrades(visual(panel('line'), panel('bar'), panel('hbar', 'node_id')), 'staked share since Helicon', days, 1, NOW.getTime());
    expect(out.panels.map((p) => p.markers)).toEqual([[{ x: '2026-09-22', label: 'Helicon' }], [{ x: '2026-09-22', label: 'Helicon' }], []]);
    // a mark that already names the upgrade stays the only one, the designer's included
    expect(markUpgrades(out, 'staked share since Helicon', days, 1, NOW.getTime()).panels[0].markers).toHaveLength(1);
    const designed = visual({ ...panel('line'), markers: [{ x: '2026-09-22', label: 'Helicon 43.94%' }] });
    expect(markUpgrades(designed, 'staked share since Helicon', days, 1, NOW.getTime()).panels[0].markers).toEqual([{ x: '2026-09-22', label: 'Helicon 43.94%' }]);
    // a mark of another figure on that day keeps its place, and the upgrade is marked beside it
    const low = visual({ ...panel('line'), markers: [{ x: '2026-09-22', label: 'Low 39.09%' }] });
    expect(markUpgrades(low, 'staked share since Helicon', days, 1, NOW.getTime()).panels[0].markers).toEqual([{ x: '2026-09-22', label: 'Low 39.09%' }, { x: '2026-09-22', label: 'Helicon' }]);
  });

  it('marks the week a weekly series holds the activation in', () => {
    const weeks = Array.from({ length: 10 }, (_, i) => ({ t: new Date(Date.UTC(2026, 7, 10 + 7 * i)).toISOString().slice(0, 10), staked_pct: 43 }));
    // Monday 2026-09-21 holds Tuesday 2026-09-22
    expect(markUpgrades(visual(panel('line')), 'stake per week since Helicon', weeks, 1, NOW.getTime()).panels[0].markers).toEqual([{ x: '2026-09-21', label: 'Helicon' }]);
  });

  it("marks nothing on Fuji, whose upgrades activated on other days", () => {
    // Fuji's Helicon was 2026-07-28 (constants/helicon.ts)
    expect(markUpgrades(visual(panel('line')), 'staked share since Helicon', days, 5, NOW.getTime()).panels[0].markers).toEqual([]);
    expect(markUpgrades(visual(panel('line')), 'staked share since Helicon', days, 43113, NOW.getTime()).panels[0].markers).toEqual([]);
  });

  it('marks nothing when the rows do not reach the activation, or the question names no upgrade', () => {
    const october = days.filter((r) => r.t >= '2026-10-01');
    expect(markUpgrades(visual(panel('line')), 'staked share since Helicon', october, 1, NOW.getTime()).panels[0].markers).toEqual([]);
    expect(markUpgrades(visual(panel('line')), 'staked share per day', days, 1, NOW.getTime()).panels[0].markers).toEqual([]);
  });
});

describe('a title that names an upgrade', () => {
  it('keeps the upgrade as its window, with no second window after its period', () => {
    // 2026-10-16 on the dev server: "Average gas price per week since July 27 since Durango"
    const w = { start: Date.parse('2026-07-27T00:00:00Z'), end: NOW.getTime(), open: true };
    expect(scoped({ title: 'Average gas price per week since Durango', note: '' }, w, NOW.getTime()).title).toBe('Average gas price per week since Durango');
    // a title with a period and no upgrade still gets its window
    expect(scoped({ title: 'Average gas price per week', note: '' }, w, NOW.getTime()).title).toMatch(/^Average gas price per week since /);
  });
});

describe('the line that compares the time before an upgrade with the time since', () => {
  const NOON = Date.parse('2026-10-16T12:00:00Z');
  const day = (i: number) => new Date(Date.UTC(2026, 7, 23 + i)).toISOString().slice(0, 10);
  // 30 days before Helicon at 45, its day at 44, 23 whole days since at 41, and today still filling at 43
  const share = Array.from({ length: 55 }, (_, i) => ({ t: day(i), staked_pct: i < 30 ? 45 : i === 30 ? 44 : i < 54 ? 41 : 43 }));
  const chart = { x: 't', series: [{ column: 'staked_pct', label: 'Staked share' }] };

  it("averages a level over the whole days on each side, leaving out the activation's day and today", () => {
    const [line] = upgradeLines('has the % of circulating avax staked increased since the helicon upgrade', chart, share, 1, NOON);
    expect(line.text).toBe('Staked share: 45.00% on average in the 30 days before Helicon (Aug 23 to Sep 21), and 41.00% on average in the 23 days since (Sep 23 to Oct 15). The last whole day, Oct 15: 41.00%.');
    // it is no source of ours: the Source fact does not list it
    expect(line.label).toBe('');
  });

  it('adds up a count, with its amount a day', () => {
    const txs = share.map((r, i) => ({ t: r.t, txs: i < 30 ? 1_000_000 : 300_000 }));
    const [line] = upgradeLines('daily transactions before and after Helicon', { x: 't', series: [{ column: 'txs', label: 'Transactions' }] }, txs, 43114, NOON);
    expect(line.text).toBe('Transactions: 30.00M in all, 1.00M a day in the 30 days before Helicon (Aug 23 to Sep 21), and 6.90M in all, 300.0k a day in the 23 days since (Sep 23 to Oct 15). The last whole day, Oct 15: 300.0k.');
  });

  it('says nothing on Fuji, for two upgrades, with fewer than 3 buckets on a side, or with no upgrade', () => {
    expect(upgradeLines('staked share since Helicon', chart, share, 5, NOON)).toEqual([]);
    expect(upgradeLines('staked share between Granite and Helicon', chart, share, 1, NOON)).toEqual([]);
    expect(upgradeLines('staked share since Helicon', chart, share.slice(28), 1, NOON)).toEqual([]);
    expect(upgradeLines('staked share per day', chart, share, 1, NOON)).toEqual([]);
  });
});

describe('the upgrade times our server sends', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('are one row per upgrade, with no read of their own', async () => {
    const { withSources } = await import('@/lib/explorer-query/sources');
    const ups = await withSources('SELECT upgrade, activated_at FROM network_upgrades WHERE chain_id = 43114', 43114);
    expect(ups.sql).toContain("('Helicon','2026-09-22 15:00:00','ACP-194, ACP-236, ACP-267, ACP-273, ACP-283, ACP-285')");
    expect(ups.sql.match(/\('[A-Z][\w ]+','\d{4}-\d{2}-\d{2} \d{2}:00:00','[^']*'\)/g)).toHaveLength(MAINNET_UPGRADES.length);
    expect(ups.sources).toEqual([expect.objectContaining({ table: 'network_upgrades', text: "Upgrade times come from AvalancheGo's mainnet config (upgrade/upgrade.go)." })]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
