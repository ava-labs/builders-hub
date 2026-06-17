/**
 * Academy/Docs Embed Integrity Check (tier-1 CI)
 *
 * Scans ALL content MDX (academy, docs, blog, integrations, ...) for imports
 * of components/toolbox modules and verifies each specifier resolves on disk
 * via the tsconfig "@/*" -> "./*" mapping (exact, +.tsx, +.ts, +/index.tsx,
 * +/index.ts). tsc does not type-check MDX, so a console tool that gets
 * moved/renamed/deleted silently 500s every course page embedding it — this
 * check catches that in CI.
 *
 * Exits 1 with GitHub Actions ::error annotations for every unresolved
 * import; exits 0 with a ✓ summary otherwise.
 *
 * Run: npx tsx ./scripts/check-academy-embeds.mts
 */

import * as fs from 'fs';
import * as path from 'path';
import { REPO_ROOT, scanContentMdx } from './lib/qa-surfaces.mts';

function contentSubdirs(): string[] {
  return fs
    .readdirSync(path.join(REPO_ROOT, 'content'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

let filesScanned = 0;
let importsChecked = 0;
const failures: Array<{ file: string; line: number; name: string; importPath: string }> = [];

for (const subdir of contentSubdirs()) {
  for (const scan of scanContentMdx(subdir)) {
    filesScanned += 1;
    for (const tool of scan.tools) {
      importsChecked += 1;
      if (!tool.exists) {
        failures.push({ file: scan.file, line: tool.line, name: tool.name, importPath: tool.importPath });
      }
    }
  }
}

if (failures.length > 0) {
  for (const f of failures) {
    console.log(
      `::error file=${f.file},line=${f.line}::Unresolved toolbox import "${f.importPath}" (component ${f.name}) — tried exact, .tsx, .ts, /index.tsx, /index.ts`,
    );
  }
  console.error(
    `\n✗ ${failures.length} unresolved toolbox import(s) across ${filesScanned} MDX file(s). ` +
      'A console tool was likely moved, renamed, or deleted — update the MDX import paths above.',
  );
  process.exit(1);
}

console.log(`✓ All ${importsChecked} toolbox imports across ${filesScanned} MDX files resolve.`);
