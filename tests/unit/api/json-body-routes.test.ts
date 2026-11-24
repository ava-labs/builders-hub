import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import baseline from './json-body-routes.baseline.json';

/* A route that reads a JSON body parses it with a zod schema before use. A field that is not checked can hold an
   object where the code expects text, and Prisma reads that object as a filter.
   The baseline lists the routes that do not parse yet. It can only get shorter: a new route cannot join it, and a
   route that now parses must leave it. */

const ROOT = join(__dirname, '../../..');
const READS_BODY = /\b_?(req|request)\.json\(\)/;
const PARSES_BODY = /\.safeParse\(|\b(parseBody|readJsonBody)\(|(?<!JSON)(?<!Date)\.parse\(/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return /^route\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const unparsed = routeFiles(join(ROOT, 'app/api'))
  .filter((file) => {
    const source = readFileSync(file, 'utf8');
    return READS_BODY.test(source) && !PARSES_BODY.test(source);
  })
  .map((file) => relative(ROOT, file))
  .sort();

describe('routes that read a JSON body', () => {
  it('parse the body with a zod schema, unless the baseline lists them', () => {
    const added = unparsed.filter((file) => !baseline.includes(file));
    expect(added, 'Parse the body with a zod schema before use').toEqual([]);
  });

  it('leave the baseline when they parse the body', () => {
    const done = baseline.filter((file) => !unparsed.includes(file));
    expect(done, 'Remove these routes from json-body-routes.baseline.json').toEqual([]);
  });
});
