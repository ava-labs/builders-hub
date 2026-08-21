// A project with no links at all (nothing in the evaluate panel's "Links"
// section and no deployed addresses) gives judges nothing to verify, so the
// evaluate flow auto-hides it and excludes it from the phase-gate counters.
// Covers the same fields the SubmissionDetailPanel renders; any trimmed,
// non-empty string value counts as a link (URL validity is not checked).

export type ProjectLinkFields = {
  github_repository: string | null;
  demo_link: string | null;
  demo_video_link: string | null;
  website: unknown;
  socials: unknown;
  deployed_addresses: unknown;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function stringMapHasLink(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some(
    (url) => typeof url === "string" && url.trim().length > 0,
  );
}

function hasDeployedAddress(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((item) => {
    if (!item || typeof item !== "object") return false;
    const address = (item as Record<string, unknown>).address;
    return typeof address === "string" && address.trim().length > 0;
  });
}

export function projectHasNoLinks(project: ProjectLinkFields): boolean {
  return (
    !hasText(project.github_repository) &&
    !hasText(project.demo_link) &&
    !hasText(project.demo_video_link) &&
    !stringMapHasLink(project.website) &&
    !stringMapHasLink(project.socials) &&
    !hasDeployedAddress(project.deployed_addresses)
  );
}

export type ReviewProgress = { reviewed: number; total: number };

// Hidden projects (manually rejected or auto-hidden) can never be reviewed by
// judges, so the "move to picking phase" gate must not count them: they drop
// out of both reviewed and total. Single source of truth for the page, the
// dashboard, and the evaluation-phase route.
export function countReviewProgress(
  projects: ReadonlyArray<{
    is_rejected: boolean;
    auto_hidden: boolean;
    evaluations: ReadonlyArray<unknown>;
  }>,
): ReviewProgress {
  const eligible = projects.filter((p) => !p.is_rejected && !p.auto_hidden);
  return {
    reviewed: eligible.filter((p) => p.evaluations.length > 0).length,
    total: eligible.length,
  };
}
