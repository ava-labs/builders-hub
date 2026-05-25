/**
 * Derive the canonical `/academy/<category>/<course>` root from any deeper
 * fumadocs URL path. Returns `null` if the path is not under `/academy/` or
 * lacks the required `<category>/<course>` segments.
 *
 * Used by:
 *  - Block B (studio save): attribute a saved deck to the course it came from.
 *  - Block E (sidebar dropdown): find user decks belonging to the current
 *    page's parent course.
 */
export function courseRootFromPath(rawPath: string): string | null {
  if (!rawPath || !rawPath.startsWith('/academy/')) return null;
  const trimmed = rawPath.replace(/\/+$/, '');
  const segments = trimmed.split('/').slice(1); // drops empty leading
  // segments now looks like ['academy', '<category>', '<course>', ...]
  if (segments.length < 3) return null;
  const [, category, course] = segments;
  if (!category || !course) return null;
  return `/academy/${category}/${course}`;
}
