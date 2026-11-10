import { MINI_GRANT_HACKATHON_ID, MINI_GRANT_KEY } from "@/lib/grants/programs";
import type { ProfileProject, ReferralLink, ReferralTarget } from "./types";

/* ------------------------------------------------------------------ */
/* Projects                                                             */

const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

/** where a project is edited: its grant or event submission form */
export function projectEditHref(
  project: Pick<ProfileProject, "id" | "origin" | "hackathonId" | "hasMiniGrantApplication">,
) {
  const apply = `/grants/team1-mini-grants/apply?project=${encodeURIComponent(project.id)}`;
  if (project.origin === MINI_GRANT_KEY && !project.hackathonId) return apply;
  if (project.hackathonId === MINI_GRANT_HACKATHON_ID) {
    return project.hasMiniGrantApplication ? "/grants/team1-mini-grants" : apply;
  }
  if (project.hackathonId === BUILD_GAMES_HACKATHON_ID) return "/build-games/submit?stage=1";
  return `/events/project-submission?project=${encodeURIComponent(project.id)}`;
}

/** the member role worth a tag; a plain member gets none */
export function projectRoleLabel(role: string | null | undefined): string | null {
  const r = role?.trim();
  if (!r || r.toLowerCase() === "member") return null;
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** a bare host ("github.com/a/b", "example.com:8080"): a dotted name, a port, then a path or the end */
const BARE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/?#]|$)/i;

/** one user-entered link as a safe href: a bare host gets https; any other scheme or text is dropped */
function safeUrl(value: string): string | null {
  if (/^https?:\/\/[^/]/i.test(value)) return value;
  return BARE_HOST.test(value) ? `https://${value}` : null;
}

/**
 * The first safe link of a stored value. The submission forms store a
 * project's repository and demo links as one comma-joined string.
 */
export function firstExternalUrl(value: string | null | undefined): string | null {
  for (const part of value?.split(/[\s,]+/) ?? []) {
    const url = part ? safeUrl(part) : null;
    if (url) return url;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Referrals                                                            */

/** the link kinds the site markets, in the order they show; the signup
    link needs no tag, as its label names it */
const REFERRAL_KINDS = [
  { type: "bh_signup", group: "Signup", tag: null },
  { type: "hackathon_registration", group: "Events", tag: "Event" },
  { type: "grant_application", group: "Grants", tag: "Grant" },
] as const;

const rank = (type: string) => {
  const i = REFERRAL_KINDS.findIndex((k) => k.type === type);
  return i === -1 ? REFERRAL_KINDS.length : i;
};

/** one key per destination: a kind and, for events and grants, its id */
export function referralSignature(t: { targetType: string; targetId: string | null }): string {
  return `${t.targetType}|${t.targetId ?? ""}`;
}

/** the tag of a link kind, or null when the kind has none */
export function referralKindTag(type: string): string | null {
  return REFERRAL_KINDS.find((k) => k.type === type)?.tag ?? null;
}

/**
 * The links to show: marketed kinds only, and only while their destination is
 * in the catalog (a link to an event that has ended goes). Signup comes first.
 */
export function visibleReferralLinks(links: ReferralLink[], targets: ReferralTarget[]): ReferralLink[] {
  const catalog = new Set(targets.map(referralSignature));
  return links
    .filter((l) => rank(l.targetType) < REFERRAL_KINDS.length && catalog.has(referralSignature(l)))
    .sort((a, b) => rank(a.targetType) - rank(b.targetType));
}

export interface ReferralTargetGroup {
  type: string;
  label: string;
  targets: ReferralTarget[];
}

/** the destinations with no link yet, grouped by kind; a kind with none is left out */
export function referralTargetGroups(targets: ReferralTarget[], links: ReferralLink[]): ReferralTargetGroup[] {
  const used = new Set(links.map(referralSignature));
  return REFERRAL_KINDS.map((k) => ({
    type: k.type,
    label: k.group,
    targets: targets.filter((t) => t.targetType === k.type && !used.has(referralSignature(t))),
  })).filter((g) => g.targets.length > 0);
}

/** the total the server counted, else the sum of the shown links */
export function totalSignupsOf(links: ReferralLink[], total?: number): number {
  return typeof total === "number" ? total : links.reduce((sum, l) => sum + (l.signups ?? 0), 0);
}

/** a share URL without its scheme and end slash, for display */
export function shareUrlDisplay(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
