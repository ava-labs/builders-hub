// The plan of one E2E run in CI: which parts of the suite run, as a list of `e2e run` calls (legs), and why.
// .github/workflows/e2e.yml runs it in the plan job, from tests/e2e:
//
//   node select/plan.ts
//
// Environment:
//   EVENT         the GitHub event: pull_request runs the selection, every other event runs everything.
//   FILES         a file with one JSON object per line: {filename, status, previous_filename}, from the PR files API.
//   FILE_COUNT    the PR's changed_files count. A shorter list (the API stops at 3000 files) runs everything.
//   GITHUB_OUTPUT and GITHUB_STEP_SUMMARY, as set by Actions. Without them the plan prints to stdout.
//
// Run it locally on a list of paths, one per line: `git diff --name-only origin/master | node select/plan.ts -`.

import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SMOKE_TAG, SMOKE_UNITS, SWEEP_TAG, SWEEP_UNITS, UNITS, unitPaths } from './rules.ts';
import { checkSuite, loadContext, select, type Change, type Selection } from './select.ts';

// A leg is one `e2e run` of the plan.
export interface Leg {
  /** The leg's name, in the job name and the summary. */
  name: string;
  /** The selection arguments (paths, tags, target), which `e2e list` takes too. */
  select: string[];
  /** The arguments of `npx e2e run`, from tests/e2e: the selection plus the workers and the output folder. */
  args: string[];
  /** The folder that holds the leg's report.json and summary.md, from tests/e2e. */
  output: string;
  /** False for the API tests, which need no browser. */
  browser: boolean;
}

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const BROWSER_UNITS = UNITS.filter((unit) => unit !== 'api');

export interface PlanOptions {
  /** Run the sweeps (tag sweep) at both sizes. Off for a PR and a master push: the nightly run covers the phone size. */
  sweepsAtBothSizes?: boolean;
}

export function planFor(selection: Selection, { sweepsAtBothSizes = true }: PlanOptions = {}): Leg[] {
  const legs: Leg[] = [];
  const picked = selection.all ? BROWSER_UNITS : BROWSER_UNITS.filter((unit) => selection.units.includes(unit));
  // The whole suite needs no path: the config finds every test.
  const paths = selection.all ? [] : [...new Set(picked.flatMap(unitPaths))];
  const sweeps = picked.filter((unit) => SWEEP_UNITS.includes(unit));
  if (picked.length && (sweepsAtBothSizes || !sweeps.length)) {
    legs.push(browserLeg('browser', paths));
  } else if (picked.length) {
    legs.push(browserLeg('browser', [...paths, '--exclude-tag', SWEEP_TAG, '--pass-with-no-tests']));
    const sweepPaths = selection.all ? [] : sweeps.flatMap(unitPaths);
    legs.push(browserLeg('sweeps', [...sweepPaths, '--tag', SWEEP_TAG, '--target', 'desktop']));
  }
  const rest = selection.all ? [] : SMOKE_UNITS.filter((unit) => !selection.units.includes(unit));
  if (rest.length) {
    legs.push(browserLeg('smoke', ['--tag', SMOKE_TAG, '--pass-with-no-tests', ...rest.flatMap(unitPaths)]));
  }
  if (selection.units.includes('api')) {
    const select = ['--config', 'api/e2e.config.ts'];
    legs.push({ name: 'api', select, args: select, output: 'api/.e2e', browser: false });
  }
  return legs;
}

function browserLeg(name: string, select: string[]): Leg {
  const output = `.e2e/${name.replace(/\W+/g, '-')}`;
  return { name, select, args: [...select, '--workers', '4', '--output', output], output, browser: true };
}

export function summary(event: string, selection: Selection, legs: Leg[], note = ''): string {
  const sizes = legs.some((leg) => leg.name.startsWith('sweeps'))
    ? `The sweeps (tag \`${SWEEP_TAG}\`) run at the desktop size only. The nightly run runs them at both sizes.`
    : '';
  const lines = ['## E2E plan', ''];
  if (selection.all) {
    lines.push(
      event === 'pull_request'
        ? 'Runs **every test**: a changed file is shared (see the table).'
        : `Runs **every test** (event: ${event}).`,
    );
  } else {
    const skipped = UNITS.filter((unit) => !selection.units.includes(unit));
    lines.push(`Runs: ${selection.units.map((unit) => `\`${unit}\``).join(', ') || 'no unit'}.`);
    lines.push(
      `Skips: ${skipped.map((unit) => `\`${unit}\``).join(', ')}. The smoke set (tag \`${SMOKE_TAG}\`) runs in their folders.`,
    );
    lines.push(
      '',
      'The full suite runs on every push to master and every night, so a test this PR skips runs within a day.',
    );
  }
  if (sizes) lines.push('', sizes);
  if (note) lines.push('', note);
  lines.push('', '| Leg | `e2e run` arguments |', '|---|---|');
  for (const leg of legs) lines.push(`| ${leg.name} | \`${leg.args.join(' ')}\` |`);
  if (selection.reasons.length) {
    const LIMIT = 200;
    lines.push('', '| Changed file | Why | Units |', '|---|---|---|');
    for (const reason of selection.reasons.slice(0, LIMIT)) {
      const units = reason.units.length === UNITS.length ? 'all' : reason.units.join(', ') || 'none';
      lines.push(`| \`${reason.file}\` | ${reason.why} | ${units} |`);
    }
    if (selection.reasons.length > LIMIT) {
      lines.push('', `${selection.reasons.length - LIMIT} more files are not listed.`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function readChanges(path: string): Change[] {
  const text = readFileSync(path === '-' ? 0 : path, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.startsWith('{')) return { file: line, status: 'modified' };
      const entry = JSON.parse(line) as { filename: string; status: string; previous_filename?: string | null };
      return { file: entry.filename, status: entry.status, previous: entry.previous_filename ?? undefined };
    });
}

function main(): void {
  const event = process.env.EVENT ?? 'pull_request';
  const fromArg = process.argv[2];
  const context = loadContext(REPO_ROOT);
  const problems = checkSuite(context);
  if (problems.length) {
    for (const problem of problems) console.error(`::error title=E2E plan::${problem}`);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY ?? '/dev/null',
      `## E2E plan\n\n${problems.map((problem) => `- ${problem}`).join('\n')}\n`,
    );
    process.exit(1);
  }
  let selection: Selection = { all: true, units: [...UNITS], reasons: [] };
  let note = '';
  if (event === 'pull_request' || fromArg) {
    const changes = readChanges(fromArg ?? process.env.FILES ?? '-');
    const expected = Number(process.env.FILE_COUNT ?? changes.length);
    if (changes.length < expected) {
      note = `The PR files API listed ${changes.length} of ${expected} changed files, so every test runs.`;
    } else {
      selection = select(changes, context);
    }
  }
  const legs = planFor(selection, { sweepsAtBothSizes: event === 'schedule' || event === 'workflow_dispatch' });
  const text = summary(event, selection, legs, note);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `legs=${JSON.stringify(legs)}\nall=${selection.all}\n`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY ?? '/dev/null', text);
  } else {
    process.stdout.write(`${text}\n${JSON.stringify(legs, null, 2)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
