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

/* ------------------------------------------------------------------ */
/* Links a member typed, as a page may show them                        */

/**
 * Every http(s) link in a stored value, as an absolute URL. The submission
 * forms keep several links in one comma-joined string. Text that is no link,
 * a site path and any other scheme (javascript:, data:, file:) are left out.
 */
export function httpLinks(value: string | null | undefined): string[] {
  const links: string[] = [];
  for (const part of value?.split(/[\s,]+/) ?? []) {
    if (!/^https?:\/\//i.test(part)) continue;
    try {
      links.push(new URL(part).href);
    } catch {
      // not a link
    }
  }
  return links;
}

/** a video as the page plays it: a player frame of a known host, or a file */
export type VideoEmbed = { kind: "frame"; src: string } | { kind: "file"; src: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "youtube-nocookie.com", "youtu.be"]);
const YOUTUBE_PATHS = new Set(["embed", "shorts", "live", "v"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const LOOM_ID = /^[A-Za-z0-9]+$/;

const hostOf = (url: URL) => url.hostname.replace(/^(www|m|music)\./, "");

function youtubeId(url: URL): string | null {
  const host = hostOf(url);
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const [first, second] = url.pathname.split("/").filter(Boolean);
  const id = host === "youtu.be" ? first : first === "watch" ? url.searchParams.get("v") : YOUTUBE_PATHS.has(first) ? second : null;
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function loomId(url: URL): string | null {
  if (hostOf(url) !== "loom.com") return null;
  const [first, id] = url.pathname.split("/").filter(Boolean);
  return (first === "share" || first === "embed") && id && LOOM_ID.test(id) ? id : null;
}

/**
 * How a project's video link plays. The first YouTube or Loom link plays in
 * that host's player, at an address built here from the video id alone, so
 * no address a member typed becomes a frame. With no such link, the first
 * other http(s) link plays as a file. A YouTube or Loom link with no video
 * id (a channel, a playlist) plays nothing.
 */
export function videoEmbed(value: string | null | undefined): VideoEmbed | null {
  const urls = httpLinks(value).map((link) => new URL(link));
  for (const url of urls) {
    const youtube = youtubeId(url);
    if (youtube) return { kind: "frame", src: `https://www.youtube.com/embed/${youtube}` };
    const loom = loomId(url);
    if (loom) return { kind: "frame", src: `https://www.loom.com/embed/${loom}` };
  }
  const file = urls.find((url) => !YOUTUBE_HOSTS.has(hostOf(url)) && hostOf(url) !== "loom.com");
  return file ? { kind: "file", src: file.href } : null;
}
