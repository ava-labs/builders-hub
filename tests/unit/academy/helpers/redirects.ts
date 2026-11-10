import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";

export interface RedirectRule {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: unknown[];
}

/**
 * The redirect Next.js applies to a bare request for `pathname` (no query, headers or cookies): the
 * first rule whose source matches, compiled as Next compiles it (router-utils/filesystem.js). A rule
 * with `has` conditions cannot match a bare request.
 */
export function firstRedirect(rules: readonly RedirectRule[], pathname: string): RedirectRule | undefined {
  return rules.find(
    (rule) => !rule.has && getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname) !== false,
  );
}
