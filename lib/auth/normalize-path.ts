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

/**
 * True when a catch-all slug points into the Team1 Academy. One segment can
 * hold an encoded slash (`team1%2Fcourse` arrives as `team1/course`), and the
 * page lookup joins the segments, so join them before the compare.
 */
export function isTeam1Slug(slug: readonly string[] | undefined): boolean {
  return normalizePathname((slug ?? []).join('/')).split('/')[1] === 'team1';
}
