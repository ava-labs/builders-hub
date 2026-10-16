import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_ROWS } from '@/lib/explorer-query/guard';
import type { QueryAnswer } from '@/lib/explorer-query/types';
import {
  MAX_ENTRIES,
  MAX_TABS,
  type HistoryEntry,
  type Kept,
  type QueryTab,
  type TabSet,
  bare,
  blankTab,
  byDay,
  closeTab,
  deleteEntry,
  keepEntry,
  landOn,
  lighterHistory,
  openTab,
  putEntry,
  readHistory,
  readTabs,
  reported,
  threadOf,
  writeLight,
  writeTabs,
} from '@/lib/explorer-query/threads';

// The tabs and the history of a Query page (lib/explorer-query/threads.ts): which tab a page lands on, what a tab
// keeps, how history orders and groups its threads, and how a full store is written again lighter.

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ t: i, v: i * 2 }));

function answer(title: string, n = 3, extra: Partial<QueryAnswer> = {}): QueryAnswer {
  return {
    title,
    note: '',
    sql: `SELECT ${title}`,
    chart: { kind: 'table', series: [] },
    drill: null,
    result: { columns: [{ name: 't', type: 'UInt32' }], rows: rows(n), rowCount: n, elapsedMs: 1, rowsRead: n, bytesRead: 0, truncated: false, ranAt: '' },
    names: {},
    visual: null,
    coverage: null,
    ...extra,
  } as QueryAnswer;
}

function kept(thread: string[], n = 3): Kept {
  return { turns: thread.map((prompt) => ({ prompt, sql: `SELECT ${prompt}`, title: prompt })), answer: answer(thread[thread.length - 1], n) };
}

function tab(id: string, thread: string[] | null, chain = 'c-chain', entry = ''): QueryTab {
  return { id, entry, chain, name: thread?.[0] ?? null, kept: thread ? kept(thread) : null };
}

/** a Storage that refuses a value longer than `max` characters, as a full browser store does */
function quota(max: number): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (v.length > max) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
  };
}

describe('the tabs', () => {
  it('open at the end and in view, and past the cap the oldest closes', () => {
    let set: TabSet = { tabs: [], active: '' };
    for (let i = 0; i < MAX_TABS + 1; i++) set = openTab(set, tab(`t${i}`, [`q${i}`]));
    expect(set.tabs).toHaveLength(MAX_TABS);
    expect(set.tabs[0].id).toBe('t1');
    expect(set.active).toBe(`t${MAX_TABS}`);
  });

  it('close to the tab beside: the right one, else the left; the last leaves a blank tab', () => {
    const set: TabSet = { tabs: [tab('a', ['qa']), tab('b', ['qb']), tab('c', ['qc'])], active: 'b' };
    expect(closeTab(set, 'b', 'c-chain').active).toBe('c');
    expect(closeTab({ ...set, active: 'c' }, 'c', 'c-chain').active).toBe('b');
    // a tab out of view closes and the one in view stays
    expect(closeTab(set, 'a', 'c-chain')).toEqual({ tabs: [set.tabs[1], set.tabs[2]], active: 'b' });
    const last = closeTab({ tabs: [tab('a', ['qa'])], active: 'a' }, 'a', 'c-chain');
    expect(last.tabs).toHaveLength(1);
    expect(last.tabs[0]).toMatchObject({ name: null, kept: null, chain: 'c-chain' });
    expect(last.active).toBe(last.tabs[0].id);
  });

  it("land on the tab that holds the URL's thread, the in-view tab first", () => {
    const set: TabSet = { tabs: [tab('a', ['q1', 'q2']), tab('b', ['q1', 'q2']), tab('c', ['q3'])], active: 'b' };
    expect(landOn(set, ['q1', 'q2'], 'c-chain')).toEqual({ tabs: set.tabs, active: 'b' });
    expect(landOn({ ...set, active: 'c' }, ['q1', 'q2'], 'c-chain').active).toBe('a');
    // the first question alone is another thread
    expect(landOn(set, ['q1'], 'c-chain').tabs).toHaveLength(4);
  });

  it('land on the tab still asking a question, on any chain, and on a blank tab for no thread', () => {
    const asking = { ...tab('a', null, 'beam'), name: 'q1' };
    const set: TabSet = { tabs: [asking, tab('b', null), tab('c', ['q3'])], active: 'c' };
    expect(landOn(set, ['q1'], 'c-chain')).toEqual({ tabs: set.tabs, active: 'a' });
    expect(landOn(set, [], 'c-chain').active).toBe('b');
  });

  it('land once: a page that lands again on the same thread stays on its tab', () => {
    const once = landOn(null, ['q1', 'q2'], 'c-chain');
    expect(landOn(once, ['q1', 'q2'], 'c-chain')).toEqual(once);
  });

  it('put a new thread in the blank tab in view, on the chain it asks', () => {
    const set: TabSet = { tabs: [tab('a', ['q1']), tab('b', null, 'c-chain')], active: 'b' };
    const next = landOn(set, ['q9'], 'beam');
    expect(next.active).toBe('b');
    expect(next.tabs).toHaveLength(2);
    expect(next.tabs[1]).toMatchObject({ id: 'b', name: 'q9', chain: 'beam', kept: null });
  });

  it('open a new tab for a thread no tab holds, named by its question, and only on its own chain', () => {
    const set: TabSet = { tabs: [tab('a', ['q1'], 'beam')], active: 'a' };
    const next = landOn(set, ['q1'], 'c-chain', 'boot');
    expect(next.tabs).toHaveLength(2);
    expect(next.tabs[1]).toEqual({ id: 'boot', entry: '', chain: 'c-chain', name: 'q1', kept: null });
    expect(next.active).toBe('boot');
    expect(landOn(null, [], 'c-chain', 'boot')).toEqual({ tabs: [blankTab('c-chain', 'boot')], active: 'boot' });
  });
});

describe('what a tab keeps', () => {
  it('a first answer starts a history entry, and a refinement keeps it', () => {
    const blank = { ...tab('a', null), name: 'q1' };
    const a1 = answer('q1');
    const first = reported(blank, ['q1'], [{ prompt: 'q1', sql: 'SELECT q1', title: 'q1' }], a1, 'c-chain');
    expect(first.entry).not.toBe('');
    expect(first.kept?.answer).toBe(a1);
    const turns = [
      { prompt: 'q1', sql: 'SELECT q1', title: 'q1' },
      { prompt: 'q2', sql: 'SELECT q2', title: 'q2' },
    ];
    const refined = reported(first, ['q1', 'q2'], turns, answer('q2'), 'c-chain');
    expect(refined.entry).toBe(first.entry);
    expect(threadOf(refined.kept)).toEqual(['q1', 'q2']);
  });

  it('a new first question starts a new entry', () => {
    const held = tab('a', ['q1'], 'c-chain', 'e1');
    const next = reported(held, ['q9'], [{ prompt: 'q9', sql: 'SELECT q9', title: 'q9' }], answer('q9'), 'c-chain');
    expect(next.entry).not.toBe('e1');
    expect(next.name).toBe('q9');
  });

  it('a page drawing its kept answer again, or failing to read its rows, changes nothing', () => {
    const held = tab('a', ['q1', 'q2'], 'c-chain', 'e1');
    expect(reported(held, ['q1', 'q2'], [], null, 'c-chain')).toBe(held);
    expect(reported(held, [], [], null, 'c-chain')).toBe(held);
    expect(reported(held, ['q1', 'q2'], held.kept!.turns, held.kept!.answer, 'c-chain')).toBe(held);
  });

  it('a blank tab that reports a blank page is the same tab', () => {
    const blank = tab('a', null);
    expect(reported(blank, [], [], null, 'c-chain')).toBe(blank);
  });

  it('a tab moved to another chain drops the answer of its old one', () => {
    const held = tab('a', ['q1'], 'c-chain', 'e1');
    expect(reported(held, [], [], null, 'beam')).toMatchObject({ chain: 'beam', kept: null, name: null });
  });

  it('a layout still being drawn is kept as its basic one', () => {
    const next = reported(tab('a', null), ['q1'], [{ prompt: 'q1', sql: 'SELECT q1', title: 'q1' }], answer('q1', 3, { draftVisual: true }), 'c-chain');
    expect(next.kept?.answer.draftVisual).toBe(false);
  });
});

describe('the history', () => {
  const entry = (id: string, thread: string[], at: number): HistoryEntry => ({ id, chain: 'c-chain', at, kept: kept(thread) });

  it('is newest first, one entry per thread, and capped', () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) list = putEntry(list, entry(`e${i}`, [`q${i}`], 1000 + i));
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[0].id).toBe(`e${MAX_ENTRIES + 4}`);
    expect(list.at(-1)?.id).toBe('e5');
    // a refinement moves its thread up; the same thread written again keeps its place
    const up = putEntry(list, entry('e20', ['q20', 'more'], 9999));
    expect(up[0].id).toBe('e20');
    expect(up.filter((e) => e.id === 'e20')).toHaveLength(1);
    const same = putEntry(list, entry('e20', ['q20'], 9999));
    expect(same.find((e) => e.id === 'e20')?.at).toBe(1020);
  });

  it('groups by day in the local time zone: Today, Yesterday, Previous 7 days, Older; an empty group is left out', () => {
    const now = new Date(2026, 9, 16, 9, 30).getTime();
    const at = (days: number, hour: number) => new Date(2026, 9, 16 - days, hour).getTime();
    const list = [entry('a', ['qa'], at(0, 8)), entry('b', ['qb'], at(1, 23)), entry('c', ['qc'], at(2, 0)), entry('d', ['qd'], at(7, 0)), entry('e', ['qe'], at(7, 0) - 1)];
    expect(byDay(list, now).map((g) => [g.label, g.entries.map((e) => e.id)])).toEqual([
      ['Today', ['a']],
      ['Yesterday', ['b']],
      ['Previous 7 days', ['c', 'd']],
      ['Older', ['e']],
    ]);
    expect(byDay([entry('a', ['qa'], at(0, 1))], now).map((g) => g.label)).toEqual(['Today']);
  });
});

describe('a full store', () => {
  it('drops the rows of an answer and marks it cut, so its SQL runs again; one with no SQL keeps them', () => {
    const k = kept(['q1'], 10);
    expect(bare(k)).toMatchObject({ cut: true, answer: { result: { rows: [], rowCount: 10 } } });
    const monitor = { ...k, answer: { ...k.answer, sql: '' } };
    expect(bare(monitor)).toBe(monitor);
  });

  it('keeps rows on the newest history entries only, then fewer, then none', () => {
    const list = Array.from({ length: 10 }, (_, i): HistoryEntry => ({ id: `e${i}`, chain: 'c-chain', at: 10 - i, kept: kept([`q${i}`], i === 1 ? 600 : 50) }));
    const [first, second, third] = lighterHistory(list);
    expect(first.map((e) => !!e.kept.cut)).toEqual([false, true, false, false, false, false, false, false, true, true]);
    expect(second.map((e) => !!e.kept.cut)).toEqual([false, true, false, false, false, false, false, false, true, true]);
    expect(lighterHistory(list.map((e) => ({ ...e, kept: kept(threadOf(e.kept), 150) })))[1].slice(0, 8).every((e) => e.kept.cut)).toBe(true);
    expect(third.every((e) => e.kept.cut)).toBe(true);
  });

  it('is written with the first of its lighter forms that fits', () => {
    const store = quota(200);
    expect(writeLight(store, 'k', [() => ({ big: 'x'.repeat(500) }), () => ({ small: 1 })])).toBe(true);
    expect(store.data.get('k')).toBe('{"small":1}');
    expect(writeLight(store, 'k', [() => 'x'.repeat(500)])).toBe(false);
    expect(store.data.get('k')).toBe('{"small":1}');
  });
});

describe('the stores', () => {
  let session: ReturnType<typeof quota>;
  let device: ReturnType<typeof quota>;
  beforeEach(() => {
    session = quota(4000);
    device = quota(4000);
    vi.stubGlobal('window', { dispatchEvent: () => true });
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', device);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keep every row in this page while storage keeps what fits', () => {
    const set: TabSet = { tabs: [{ ...tab('a', null), name: 'q1', kept: kept(['q1'], 400) }], active: 'a' };
    writeTabs('/explorer/mainnet/c-chain/query', set);
    expect(readTabs('/explorer/mainnet/c-chain/query')).toBe(set);
    const stored = JSON.parse(session.data.get('explorer-query-tabs:v1:/explorer/mainnet/c-chain/query')!) as TabSet;
    expect(stored.tabs[0].kept).toMatchObject({ cut: true, answer: { result: { rows: [] } } });
  });

  it('hold an answer of MAX_ROWS rows: the tab store drops its rows first, keeps the thread, and never throws', () => {
    const path = '/explorer/mainnet/c-chain/query?full';
    const big = kept(['q1'], MAX_ROWS);
    const set: TabSet = { tabs: [{ ...tab('a', null), name: 'q1', kept: big }, tab('b', ['q2'])], active: 'a' };
    expect(JSON.stringify(set).length).toBeGreaterThan(4000);
    expect(() => writeTabs(path, set)).not.toThrow();
    const stored = JSON.parse(session.data.get(`explorer-query-tabs:v1:${path}`)!) as TabSet;
    // the rows go; the thread, its SQL and its title stay, marked cut so the SQL runs again
    expect(stored.tabs[0].kept).toMatchObject({ cut: true, turns: big.turns, answer: { title: 'q1', sql: 'SELECT q1', result: { rows: [], rowCount: MAX_ROWS } } });
    expect(stored.tabs[1].kept?.answer.result?.rows).toHaveLength(3);
    // this page still holds every row
    expect(readTabs(path)?.tabs[0].kept?.answer.result?.rows).toHaveLength(MAX_ROWS);
  });

  it('hold history past its quota: older entries lose their rows before newer ones, then all do, with no throw', () => {
    const path = '/explorer/mainnet/c-chain/query?history-full';
    // the newest entry holds MAX_ROWS rows, the next three hold a few, the next four hold 300
    const n = [MAX_ROWS, 50, 50, 50, 300, 300, 300, 300, 50, 50];
    const list = n.map((rowsOf, i): HistoryEntry => ({ id: `e${i}`, chain: 'c-chain', at: 100 - i, kept: kept([`q${i}`], rowsOf) }));
    const sizes = lighterHistory(list).map((l) => JSON.stringify(l).length);
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
    // room for the second form only
    vi.stubGlobal('localStorage', (device = quota(sizes[1])));
    for (const e of [...list].reverse()) expect(() => keepEntry(path, e)).not.toThrow();
    const stored = JSON.parse(device.data.get(`explorer-query-history:v1:${path}`)!) as HistoryEntry[];
    expect(stored.map((e) => e.kept.answer.result?.rows.length)).toEqual([0, 50, 50, 50, 0, 0, 0, 0, 0, 0]);
    expect(stored.map((e) => threadOf(e.kept))).toEqual(list.map((e) => threadOf(e.kept)));
    // no room even for the threads: the write fails quietly, and storage keeps what it had
    vi.stubGlobal('localStorage', (device = quota(10)));
    expect(() => keepEntry(path, { id: 'e10', chain: 'c-chain', at: 200, kept: kept(['q10']) })).not.toThrow();
    expect(device.data.size).toBe(0);
    expect(readHistory(path)[0].id).toBe('e10');
  });

  it('add, update and delete history entries, per page', () => {
    const path = '/explorer/mainnet/p-chain/query';
    keepEntry(path, { id: 'e1', chain: 'p-chain', at: 1, kept: kept(['q1']) });
    keepEntry(path, { id: 'e2', chain: 'p-chain', at: 2, kept: kept(['q2']) });
    keepEntry(path, { id: 'e1', chain: 'p-chain', at: 3, kept: kept(['q1', 'q1b']) });
    expect(readHistory(path).map((e) => e.id)).toEqual(['e1', 'e2']);
    deleteEntry(path, 'e1');
    expect(readHistory(path).map((e) => e.id)).toEqual(['e2']);
    expect(readHistory('/explorer/mainnet/query')).toEqual([]);
    expect(JSON.parse(device.data.get(`explorer-query-history:v1:${path}`)!)).toHaveLength(1);
  });
});
