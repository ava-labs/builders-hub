import { MAX_STUDIO_FILE_BYTES, STUDIO_FILE_PATH } from '@/types/studio';

/*
 * Turns a folder or zip of an existing Solidity project into Studio project
 * files. The browser only reads files; this mapping runs on the server, so a
 * client cannot write anywhere Studio would not.
 */

export interface RawFile {
  path: string;
  content: string;
}

export type Framework = 'foundry' | 'hardhat' | 'plain';

export interface ImportPlan {
  framework: Framework;
  /** Project files to write, with the path each one came from. */
  files: { path: string; content: string; from: string }[];
  skipped: { path: string; reason: string }[];
  counts: { contracts: number; tests: number; scripts: number; docs: number };
  /** Non-relative imports by how Studio can compile them. */
  imports: { supported: string[]; testOnly: string[]; unsupported: string[] };
  /** Files whose pragma excludes the compiler Studio builds with. */
  pragmaConflicts: { path: string; pragma: string }[];
  /** OpenZeppelin major version the project declares, when it differs from Studio's. */
  openZeppelin: { declared: string; studio: string } | null;
}

export const STUDIO_SOLC = '0.8.28';
export const STUDIO_OPENZEPPELIN = '5.3.0';

/** Dependencies, build output and tooling, never project source. */
const IGNORED_DIRS = new Set([
  'lib',
  'node_modules',
  'out',
  'cache',
  'artifacts',
  'broadcast',
  'coverage',
  'typechain',
  'typechain-types',
  'dist',
  'build',
  'deployments',
]);

/** Where each layout keeps what Studio calls contracts/, test/, script/. */
const ROOT_RENAMES: Record<string, string> = {
  src: 'contracts',
  contracts: 'contracts',
  test: 'test',
  tests: 'test',
  script: 'script',
  scripts: 'script',
};

/** Import prefixes Studio compiles against, from blueprints/_shared/compiler.json. */
const SUPPORTED_PREFIXES = ['@openzeppelin/contracts/', '@chainlink/contracts-ccip/', '@teleporter/'];
const TEST_ONLY_PREFIXES = ['forge-std/', 'ds-test/'];

const IMPORT_PATTERN = /(\bimport\s+(?:[^'";]*?\bfrom\s+)?)(["'])([^"']+)\2/g;
const PRAGMA_PATTERN = /pragma\s+solidity\s+([^;]+);/;

const normalize = (path: string) =>
  path
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/');

/** Drops a folder every path shares, as when a whole repo is zipped or picked. */
function stripSharedRoot(files: RawFile[]): RawFile[] {
  const tops = new Set(files.map((f) => f.path.split('/')[0]));
  if (tops.size !== 1 || files.some((f) => !f.path.includes('/'))) return files;
  const [top] = tops;
  if (ROOT_RENAMES[top] !== undefined) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
}

function detectFramework(paths: string[]): Framework {
  if (paths.some((p) => p === 'foundry.toml')) return 'foundry';
  if (paths.some((p) => /^hardhat\.config\.(js|ts|cjs|mjs)$/.test(p))) return 'hardhat';
  return 'plain';
}

/** `prefix=target` lines from remappings.txt or foundry.toml's remappings array. */
export function parseRemappings(files: RawFile[]): { prefix: string; target: string }[] {
  const lines: string[] = [];
  const txt = files.find((f) => f.path === 'remappings.txt');
  if (txt) lines.push(...txt.content.split(/\r?\n/));
  const toml = files.find((f) => f.path === 'foundry.toml');
  const block = toml?.content.match(/remappings\s*=\s*\[([\s\S]*?)\]/);
  if (block) lines.push(...[...block[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]));
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const [left, target] = line.split('=', 2);
      // "context:prefix=target" scopes a remapping to a folder; Studio applies it project-wide.
      const prefix = left.includes(':') ? left.slice(left.indexOf(':') + 1) : left;
      return { prefix: prefix.trim(), target: target.trim() };
    });
}

/**
 * Remapped OpenZeppelin imports rewritten to the path Studio resolves, e.g.
 * `openzeppelin/token/ERC20.sol` from `openzeppelin/=lib/openzeppelin-contracts/contracts/`.
 */
function openZeppelinAliases(
  remappings: { prefix: string; target: string }[],
): { prefix: string; replacement: string }[] {
  const aliases: { prefix: string; replacement: string }[] = [];
  for (const { prefix, target } of remappings) {
    const t = target.endsWith('/') ? target : `${target}/`;
    if (/(openzeppelin-contracts\/contracts|@openzeppelin\/contracts)\/$/.test(t))
      aliases.push({ prefix, replacement: '@openzeppelin/contracts/' });
    else if (/(openzeppelin-contracts|@openzeppelin)\/$/.test(t))
      aliases.push({ prefix, replacement: '@openzeppelin/' });
  }
  return aliases.filter((a) => a.prefix !== a.replacement).sort((a, b) => b.prefix.length - a.prefix.length);
}

/** An import path after the move: renamed top folder, and remapped OpenZeppelin prefixes. */
function rewriteImportPath(importPath: string, aliases: { prefix: string; replacement: string }[]): string {
  const alias = aliases.find((a) => importPath.startsWith(a.prefix));
  if (alias) return alias.replacement + importPath.slice(alias.prefix.length);
  const segments = importPath.split('/');
  const first = segments.findIndex((s) => s !== '.' && s !== '..');
  if (first >= 0 && ROOT_RENAMES[segments[first]] && segments.length > first + 1) {
    segments[first] = ROOT_RENAMES[segments[first]];
    return segments.join('/');
  }
  return importPath;
}

/** Whether a version satisfies a pragma constraint like `^0.8.20`, `>=0.8.0 <0.9.0` or `0.8.19`. */
export function satisfiesPragma(version: string, constraint: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const v = parse(version);
  return constraint.split('||').some((alternative) =>
    alternative
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => {
        const m = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+(?:\.\d+){0,2})$/.exec(term);
        if (!m) return true;
        const [, op = '=', raw] = m;
        const target = parse(raw);
        const c = cmp(v, target);
        switch (op) {
          case '^':
            return c >= 0 && (target[0] > 0 ? v[0] === target[0] : v[1] === target[1]);
          case '~':
            return c >= 0 && v[0] === target[0] && v[1] === target[1];
          case '>=':
            return c >= 0;
          case '<=':
            return c <= 0;
          case '>':
            return c > 0;
          case '<':
            return c < 0;
          default:
            return c === 0;
        }
      }),
  );
}

function declaredOpenZeppelin(files: RawFile[]): string | null {
  const pkg = files.find((f) => f.path === 'package.json');
  if (!pkg) return null;
  try {
    const json = JSON.parse(pkg.content) as Record<string, Record<string, string> | undefined>;
    return json.dependencies?.['@openzeppelin/contracts'] ?? json.devDependencies?.['@openzeppelin/contracts'] ?? null;
  } catch {
    return null;
  }
}

/** Where a file of an imported project goes in Studio, or why it does not. */
function target(path: string): { path: string } | { reason: string } {
  const segments = path.split('/');
  if (segments.some((s) => s.startsWith('.'))) return { reason: 'hidden file or folder' };
  if (segments.slice(0, -1).some((s) => IGNORED_DIRS.has(s))) return { reason: 'dependency or build output' };
  const name = segments[segments.length - 1];

  if (name.endsWith('.sol')) {
    const root = ROOT_RENAMES[segments[0]];
    const mapped =
      root && segments.length > 1 ? [root, ...segments.slice(1)].join('/') : `contracts/${segments.join('/')}`;
    return STUDIO_FILE_PATH.test(mapped) ? { path: mapped } : { reason: 'folder or file name Studio cannot store' };
  }
  if (name.endsWith('.md')) {
    if (segments.length === 1 && /^readme\.md$/i.test(name)) return { path: 'docs/README.md' };
    if (segments[0] === 'docs' && STUDIO_FILE_PATH.test(path)) return { path };
    return { reason: 'only the README and docs/ Markdown are kept' };
  }
  return { reason: 'not Solidity or Markdown' };
}

export function planImport(input: RawFile[]): ImportPlan {
  const files = stripSharedRoot(input.map((f) => ({ ...f, path: normalize(f.path) })).filter((f) => f.path));
  const framework = detectFramework(files.map((f) => f.path));
  const aliases = openZeppelinAliases(parseRemappings(files));
  const config = new Set(['foundry.toml', 'remappings.txt', 'package.json']);

  const plan: ImportPlan = {
    framework,
    files: [],
    skipped: [],
    counts: { contracts: 0, tests: 0, scripts: 0, docs: 0 },
    imports: { supported: [], testOnly: [], unsupported: [] },
    pragmaConflicts: [],
    openZeppelin: null,
  };
  const supported = new Set<string>();
  const testOnly = new Set<string>();
  const unsupported = new Set<string>();
  const seen = new Set<string>();

  for (const file of files) {
    if (config.has(file.path) || /^hardhat\.config\.(js|ts|cjs|mjs)$/.test(file.path)) continue;
    const where = target(file.path);
    if ('reason' in where) {
      plan.skipped.push({ path: file.path, reason: where.reason });
      continue;
    }
    if (Buffer.byteLength(file.content, 'utf8') > MAX_STUDIO_FILE_BYTES) {
      plan.skipped.push({ path: file.path, reason: `larger than ${MAX_STUDIO_FILE_BYTES / 1024} KB` });
      continue;
    }
    if (seen.has(where.path)) {
      plan.skipped.push({ path: file.path, reason: `another file already maps to ${where.path}` });
      continue;
    }
    seen.add(where.path);

    let content = file.content;
    if (where.path.endsWith('.sol')) {
      const isTest = where.path.startsWith('test/');
      content = content.replace(IMPORT_PATTERN, (whole, head: string, quote: string, importPath: string) => {
        const rewritten = rewriteImportPath(importPath, aliases);
        if (
          !rewritten.startsWith('.') &&
          !rewritten.startsWith('contracts/') &&
          !rewritten.startsWith('test/') &&
          !rewritten.startsWith('script/')
        ) {
          const family = rewritten
            .split('/')
            .slice(0, rewritten.startsWith('@') ? 2 : 1)
            .join('/');
          if (SUPPORTED_PREFIXES.some((p) => rewritten.startsWith(p))) supported.add(family);
          else if (
            TEST_ONLY_PREFIXES.some((p) => rewritten.startsWith(p)) &&
            (isTest || where.path.startsWith('script/'))
          )
            testOnly.add(family);
          else unsupported.add(family);
        }
        return `${head}${quote}${rewritten}${quote}`;
      });
      const pragma = PRAGMA_PATTERN.exec(content)?.[1]?.trim();
      if (pragma && !isTest && !satisfiesPragma(STUDIO_SOLC, pragma))
        plan.pragmaConflicts.push({ path: where.path, pragma });
      if (where.path.startsWith('contracts/')) plan.counts.contracts++;
      else if (isTest) plan.counts.tests++;
      else plan.counts.scripts++;
    } else {
      plan.counts.docs++;
    }
    plan.files.push({ path: where.path, content, from: file.path });
  }

  plan.imports = {
    supported: [...supported].sort(),
    testOnly: [...testOnly].sort(),
    unsupported: [...unsupported].sort(),
  };
  const declared = declaredOpenZeppelin(files);
  const major = declared?.match(/(\d+)\./)?.[1];
  if (declared && major && major !== STUDIO_OPENZEPPELIN.split('.')[0])
    plan.openZeppelin = { declared, studio: STUDIO_OPENZEPPELIN };
  return plan;
}

export type Need = 'improve' | 'audit' | 'deploy';
const NEED_LABEL: Record<Need, string> = {
  improve: 'Improve the contracts',
  audit: 'Audit them',
  deploy: 'Plan and run deploy steps on testnet',
};

const IMPORTED_HEADING = '## What Studio imported';

/**
 * docs/BRIEF.md: what the builder said they need, and what Studio found in the
 * upload. A re-import with nothing new to say keeps the builder's own sections
 * from the previous brief and refreshes only what Studio found.
 */
export function briefMarkdown(plan: ImportPlan, about: string, needs: Need[], previous?: string): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- none');
  const keep = !about.trim() && needs.length === 0 && previous?.includes(IMPORTED_HEADING);
  const intro = keep
    ? previous!.split(IMPORTED_HEADING)[0].trimEnd()
    : [
        '# Project brief',
        '',
        "## What I'm working on",
        '',
        about.trim() || '(not given)',
        '',
        '## What I need',
        '',
        list(needs.map((n) => NEED_LABEL[n])),
      ].join('\n');
  return [
    intro,
    '',
    IMPORTED_HEADING,
    '',
    `- Layout: ${plan.framework}`,
    `- ${plan.counts.contracts} contract files, ${plan.counts.tests} tests, ${plan.counts.scripts} scripts, ${plan.counts.docs} docs`,
    `- Compiles with solc ${STUDIO_SOLC} and OpenZeppelin ${STUDIO_OPENZEPPELIN}`,
    '',
    'Imports Studio provides:',
    '',
    list(plan.imports.supported),
    '',
    'Imports only tests use (Studio does not compile tests):',
    '',
    list(plan.imports.testOnly),
    '',
    'Imports Studio cannot resolve:',
    '',
    list(plan.imports.unsupported),
    ...(plan.openZeppelin
      ? [
          '',
          `The project declares OpenZeppelin ${plan.openZeppelin.declared}; Studio builds against ${plan.openZeppelin.studio}, so some imports and constructors may differ.`,
        ]
      : []),
    ...(plan.pragmaConflicts.length
      ? [
          '',
          `Files whose pragma excludes solc ${STUDIO_SOLC}:`,
          '',
          list(plan.pragmaConflicts.map((c) => `${c.path} (${c.pragma})`)),
        ]
      : []),
    '',
  ].join('\n');
}
