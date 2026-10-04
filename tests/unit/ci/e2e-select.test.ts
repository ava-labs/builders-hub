import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { planFor } from '../../e2e/select/plan.ts';
import { UNITS } from '../../e2e/select/rules.ts';
import { checkSuite, loadContext, select, type Context } from '../../e2e/select/select.ts';

/* The PR test selection of .github/workflows/e2e.yml (tests/e2e/select). It runs on the real repo: the graph reads
   every tracked file, so a new cross-area import changes these answers the same way it changes CI. */

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const tracked = (path: string) =>
  execFileSync('git', ['-C', REPO, 'ls-files', path], { encoding: 'utf8' }).split('\n').filter(Boolean);

let context: Context;
beforeAll(() => {
  context = loadContext(REPO);
}, 60_000);

const unitsFor = (file: string, status = 'modified', previous?: string) =>
  select([{ file, status, previous }], context);

describe('select', () => {
  it('runs an Explorer change in the Explorer tests and the site tests that open Explorer pages', () => {
    const selection = unitsFor('components/explorer-v2/ChainHeader.tsx');
    expect(selection.all).toBe(false);
    expect(selection.units).toEqual(['explorer', 'site', 'ai:explorer']);
  });

  it('runs a docs page in the docs, embeds and routes tests', () => {
    expect(unitsFor('content/docs/nodes/index.mdx').units).toEqual(['docs', 'embeds', 'routes', 'site', 'ai:docs']);
  });

  it('runs an Academy page in the Academy and embeds tests', () => {
    const lesson = tracked('content/academy').find((file) => file.endsWith('.mdx')) as string;
    expect(unitsFor(lesson).units).toEqual(['academy', 'embeds', 'routes', 'ai:academy']);
  });

  it('runs every test for a shared file', () => {
    for (const file of [
      'package.json',
      'yarn.lock',
      'next.config.mjs',
      'proxy.ts',
      'app/layout.tsx',
      'app/global.css',
    ]) {
      expect(unitsFor(file).all, file).toBe(true);
    }
  });

  it('runs every test for a code file that no page reaches, because the graph cannot place it', () => {
    const { files, valueGroups, typeReached, apiRoutes } = context.graph;
    const unreached = [...files].find(
      (file) =>
        /^components\/.*\.tsx$/.test(file) && !valueGroups.has(file) && !typeReached.has(file) && !apiRoutes.has(file),
    ) as string;
    const selection = unitsFor(unreached);
    expect(selection.all).toBe(true);
    expect(selection.reasons[0].why).toBe('no page reaches it in the import graph');
  });

  it('runs no unit for a file that no page reads', () => {
    const files = [
      'README.md',
      'AGENTS.md',
      'app/api/explorer/EXTERNAL_APIS.md',
      'tests/unit/ci/e2e-select.test.ts',
      '.github/workflows/unit.yml',
    ];
    for (const file of files) {
      expect(unitsFor(file).units, file).toEqual([]);
    }
  });

  it('runs a test file in its own unit, and a helper in the units of the tests that import it', () => {
    expect(unitsFor('tests/e2e/explorer/pages.e2e.ts').units).toEqual(['explorer']);
    expect(unitsFor('tests/e2e/ai/journey-docs.e2e.ts').units).toEqual(['ai:docs']);
    expect(unitsFor('tests/e2e/ai/site-navigation.e2e.ts').units).toEqual(['ai:docs', 'ai:explorer', 'ai:site']);
    expect(unitsFor('tests/e2e/api/mcp-chain-stats.e2e.ts').units).toEqual(['api']);
    expect(unitsFor('tests/e2e/console/console-sweep.ts').units).toEqual(['console']);
    expect(unitsFor('tests/e2e/lib/skip.ts').units.length).toBeGreaterThan(3);
  });

  it('runs the routes sweep for a file that its helper reads to list the routes', () => {
    expect(unitsFor('lib/rwa/projects.ts').units).toContain('routes');
  });

  it('runs a removed page in the tests of its group, and a removed module in none', () => {
    expect(unitsFor('app/(home)/no-such-page/page.tsx', 'removed').units).toEqual(['routes']);
    expect(unitsFor('lib/no-such-module-of-this-test.ts', 'removed').units).toEqual([]);
  });

  it('runs the pages under a removed layout, which no file imports', () => {
    expect(unitsFor('app/(home)/explorer/[network]/[chain]/layout.tsx', 'removed').units).toEqual([
      'explorer',
      'site',
      'ai:explorer',
    ]);
    expect(unitsFor('app/not-found.tsx', 'removed').all).toBe(true);
    expect(unitsFor('proxy.ts', 'removed').all).toBe(true);
  });

  it('runs the pages that fetch a removed API route', () => {
    expect(unitsFor('app/api/overview-stats/route.ts', 'removed').units).toEqual(
      expect.arrayContaining(['explorer', 'routes', 'site']),
    );
  });

  it('runs no unit for a removed public file that no code names', () => {
    expect(unitsFor('public/no-such-image-of-this-test.png', 'removed').units).toEqual([]);
    expect(unitsFor('public/no-such-image-of-this-test.png', 'added').all).toBe(true);
  });

  it('places the old path of a renamed file too', () => {
    const selection = unitsFor('README.md', 'renamed', 'package.json');
    expect(selection.all).toBe(true);
  });

  it('runs the API tests for the MCP route', () => {
    expect(unitsFor('app/api/mcp/route.ts').units).toContain('api');
  });
});

describe('planFor', () => {
  it('runs the selection, the smoke set in the other folders, and the API tests when picked', () => {
    const legs = planFor({ all: false, units: ['explorer', 'site', 'ai:explorer', 'api'], reasons: [] });
    expect(legs.map((leg) => leg.name)).toEqual(['browser', 'smoke', 'api']);
    expect(legs[0].args).toContain('explorer/');
    expect(legs[1].args).toEqual(expect.arrayContaining(['--tag', 'smoke', 'academy/', 'docs/']));
    expect(legs[1].args).not.toContain('explorer/');
  });

  it('runs only the smoke set for a change with no unit', () => {
    expect(planFor({ all: false, units: [], reasons: [] }).map((leg) => leg.name)).toEqual(['smoke']);
  });

  it('runs every browser test and the API tests for everything', () => {
    const legs = planFor({ all: true, units: [...UNITS], reasons: [] });
    expect(legs.map((leg) => leg.name)).toEqual(['browser', 'api']);
  });

  it('runs the sweeps at the desktop size only when asked', () => {
    const all = planFor({ all: true, units: [...UNITS], reasons: [] }, { sweepsAtBothSizes: false });
    expect(all.map((leg) => leg.name)).toEqual(['browser', 'sweeps', 'api']);
    expect(all[0].args).toEqual(expect.arrayContaining(['--exclude-tag', 'sweep']));
    expect(all[1].args).toEqual(expect.arrayContaining(['--tag', 'sweep', '--target', 'desktop']));
    const docs = planFor({ all: false, units: ['docs'], reasons: [] }, { sweepsAtBothSizes: false });
    expect(docs.map((leg) => leg.name)).toEqual(['browser', 'smoke']);
    const console = planFor({ all: false, units: ['console', 'site'], reasons: [] }, { sweepsAtBothSizes: false });
    expect(console[1].args.slice(0, 1)).toEqual(['console/']);
  });
});

// The hand-kept lists must match the suite and the code. The plan job runs the same check and fails on a problem.
describe('checkSuite', () => {
  it('finds the rules in step with the suite', () => {
    expect(checkSuite(context)).toEqual([]);
  });
});
