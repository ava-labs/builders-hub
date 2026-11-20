/**
 * The router decodes percent-escapes before it picks a page, so
 * `/academy/te%61m1/...` serves the same content as `/academy/team1/...`.
 * Path-based access checks compare against this normalized form, never the
 * raw request path.
 */

/** Decode percent-escapes (until stable), lower-case, and resolve empty, `.` and `..` segments. */
export function normalizePathname(pathname: string): string {
  let decoded = pathname;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      break;
    }
    if (next === decoded) break;
    decoded = next;
  }

  const segments: string[] = [];
  for (const segment of decoded.toLowerCase().split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}
