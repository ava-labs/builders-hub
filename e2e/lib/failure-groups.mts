/**
 * Root-cause grouping for QA failures — shared by the terminal reporter
 * (reporters/root-cause-reporter.ts) and the CI summarizer
 * (summarize-failures.mts) so the two surfaces can't disagree.
 *
 * One broken component takes down every page that embeds it. Reporting
 * per page makes one bug look like N, so failures collapse by signature:
 *
 *   - `missing-tools` annotation (set by the smoke spec on zero-mount):
 *     the sorted set of tools that failed to mount.
 *   - otherwise: the first error line with the test's route normalized
 *     out, so identical errors on different pages still collapse.
 */

export interface FailureRecord {
  /** Spec title, e.g. "renders /academy/..." */
  title: string;
  /** Route or title-derived identifier shown in the affected list. */
  route: string;
  /** Full error message of the final attempt. */
  error: string;
  /** Value of the missing-tools annotation, when present. */
  missingTools?: string;
}

export interface FailureGroup {
  title: string;
  routes: string[];
  sample: string;
}

const ANSI = /\[[0-9;]*m/g;

export function routeOf(title: string): string {
  return title.replace(/^renders\s+/, '');
}

export function groupFailures(failures: FailureRecord[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup>();

  for (const f of failures) {
    let key: string;
    let title: string;
    if (f.missingTools) {
      key = `missing-tools:${f.missingTools}`;
      title = `Tool failed to mount: ${f.missingTools}`;
    } else {
      const firstLine =
        f.error
          .replace(ANSI, '')
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('Error:')) ?? f.error.replace(ANSI, '').slice(0, 120);
      const normalized = firstLine.replaceAll(f.route, '<route>');
      key = `error:${normalized}`;
      title = normalized.replace(/^Error:\s*/, '');
    }
    const group = groups.get(key) ?? { title, routes: [], sample: f.error };
    group.routes.push(f.route);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.routes.length - a.routes.length);
}
