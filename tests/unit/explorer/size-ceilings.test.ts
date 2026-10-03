import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// The explorer's size ceilings (eslint.config.mjs): each file that was over the 600-line cap when the cap came in
// holds a ceiling at its size then. A file may shrink but never grow, and its ceiling comes down with it, so a split
// file cannot grow back. No ceiling rises above the base branch's, and no file joins the list: split it instead.
const FILE = 'scripts/explorer-size-ceilings.json';
const CAP = 600;
const BASE = 'origin/master';
const CEILINGS: Record<string, number> = JSON.parse(readFileSync(FILE, 'utf8'));

/** each file's lines as max-lines counts them (blank and comment lines skipped), read from the rule itself */
async function sizes(files: string[]): Promise<Record<string, number>> {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{ files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tseslint.parser }, rules: { 'max-lines': ['error', { max: 1, skipBlankLines: true, skipComments: true }] } }],
  });
  const out: Record<string, number> = {};
  for (const file of files) {
    const [r] = await eslint.lintText(readFileSync(file, 'utf8'), { filePath: file });
    const m = r.messages.find((x) => x.ruleId === 'max-lines');
    out[file] = m ? Number(/\((\d+)\)/.exec(m.message)?.[1]) : 1;
  }
  return out;
}

/** the ceilings on the base branch; null before the list reaches it */
function baseCeilings(): Record<string, number> | null {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    git('rev-parse', '--verify', `${BASE}^{commit}`);
  } catch {
    throw new Error(`${BASE} is not here to compare the ceilings with: run git fetch origin master`);
  }
  try {
    return JSON.parse(git('show', `${BASE}:${FILE}`));
  } catch {
    return null;
  }
}

describe('the explorer size ceilings', () => {
  it('hold only files that are there and over the cap', () => {
    for (const [file, ceiling] of Object.entries(CEILINGS)) {
      expect(existsSync(file), `${file} is gone: take it out of ${FILE}`).toBe(true);
      expect(ceiling, `${file} is under the cap: take it out of ${FILE}`).toBeGreaterThan(CAP);
    }
  });

  it('come down as their files shrink', async () => {
    const now = await sizes(Object.keys(CEILINGS).filter((f) => existsSync(f)));
    for (const [file, n] of Object.entries(now)) {
      const fix = n > CAP ? `set its ceiling to ${n} in ${FILE}` : `it is under the cap now: take it out of ${FILE}`;
      expect(n, `${file} is ${n} lines against a ceiling of ${CEILINGS[file]}: ${fix}`).toBe(CEILINGS[file]);
    }
  }, 60_000);

  it('never rise above the base branch, and take no new file', () => {
    const base = baseCeilings();
    if (!base) return;
    for (const [file, ceiling] of Object.entries(CEILINGS)) {
      expect(base[file], `${file} is not in ${BASE}'s ceilings: a file over the cap cannot join the list; split it`).toBeDefined();
      expect(ceiling, `${file} rose above its ceiling on ${BASE} (${base[file]}): move code out of it instead`).toBeLessThanOrEqual(base[file]);
    }
  });
});
