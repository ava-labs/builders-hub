import { describe, expect, it } from 'vitest';

import { progress, rowCount } from '@/components/explorer-v2/evm/query-client';
import type { QueryEvent } from '@/lib/explorer-query/answer';

const step = (kind: 'test' | 'final', ok: boolean, detail: string, n = 1): QueryEvent => ({ type: 'step', n, kind, writer: 'Writer A', modelMs: 900, sqlMs: 120, ok, detail });
const stage = (s: 'cached' | 'writing' | 'escalated'): QueryEvent => ({ type: 'stage', stage: s, writer: 'Writer B' });

describe('progress', () => {
  it('writes the SQL before any step ends', () => {
    expect(progress([])).toBe('Writing the SQL');
    expect(progress([stage('writing')])).toBe('Writing the SQL');
  });

  it('names the phase a step leaves the question in, with plurals right', () => {
    expect(progress([stage('writing'), step('test', true, '1 rows')])).toBe('Trying the SQL on a sample: 1 row');
    expect(progress([stage('writing'), step('test', true, '20 rows')])).toBe('Trying the SQL on a sample: 20 rows');
    expect(progress([stage('writing'), step('final', true, '1204 rows')])).toBe('Reading 1,204 rows');
    expect(progress([stage('writing'), step('final', true, '1 rows')])).toBe('Reading 1 row');
    expect(progress([stage('writing'), step('final', true, '0 rows')])).toBe('Reading the rows');
    expect(progress([stage('writing'), step('final', true, 'no chart')])).toBe('Writing the answer');
  });

  it('counts the fixes, and a new writer starts the count again', () => {
    const failed = step('test', false, 'bound p_validators on its time or height');
    expect(progress([stage('writing'), failed])).toBe('Fixing the SQL');
    expect(progress([stage('writing'), failed, failed])).toBe('Fixing the SQL, 2nd try');
    expect(progress([stage('writing'), failed, failed, step('final', false, 'the query returned no rows')])).toBe('Fixing the SQL, 3rd try');
    expect(progress([stage('writing'), failed, failed, stage('escalated')])).toBe('Writing the SQL again');
    expect(progress([stage('writing'), failed, failed, stage('escalated'), failed])).toBe('Fixing the SQL');
  });

  it('runs a kept answer, and writes it again when it no longer runs', () => {
    expect(progress([stage('cached')])).toBe('Running the query');
    expect(progress([stage('cached'), stage('writing')])).toBe('Writing the SQL');
  });

  it('never names a model, a test number or the engine error', () => {
    const lines = [
      progress([stage('writing'), step('test', false, 'Code: 47. Unknown identifier', 3)]),
      progress([stage('escalated'), step('test', true, '5 rows', 4)]),
      progress([stage('cached')]),
    ];
    for (const l of lines) expect(l).not.toMatch(/Writer|Test \d|Code: 47|identifier|model/i);
  });

  it('says 1 row, and more rows with separators', () => {
    expect(rowCount(1)).toBe('1 row');
    expect(rowCount(0)).toBe('0 rows');
    expect(rowCount(25000)).toBe('25,000 rows');
  });
});
