import type { ProfileLink, ProfileRole, ProfileWallet } from "./types";

interface RawProfileValues {
  name?: string;
  username?: string;
  bio?: string;
  email?: string;
  image?: string;
  country?: string;
  is_student?: boolean;
  is_founder?: boolean;
  is_employee?: boolean;
  is_developer?: boolean;
  is_enthusiast?: boolean;
  github_account?: string;
  x_account?: string;
  linkedin_account?: string;
  telegram_account?: string;
  wallet?: string[];
  additional_social_accounts?: string[];
  skills?: string[];
}

const URL_PROTOCOL_RE = /^https?:\/\//i;

export function ensureUrl(value: string): string {
  if (!value) return value;
  return URL_PROTOCOL_RE.test(value) ? value : `https://${value}`;
}

export function extractGithubUsername(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/github\.com\/([^/?#\s]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^@/, "");
}

export function extractXUsername(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/(?:x|twitter)\.com\/([^/?#\s]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^@/, "");
}

export function extractLinkedInSlug(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i);
  if (match) return match[1];
  return trimmed;
}

export function rolesFromValues(v: RawProfileValues): ProfileRole[] {
  const out: ProfileRole[] = [];
  if (v.is_student) out.push("university");
  if (v.is_founder) out.push("founder");
  if (v.is_developer) out.push("developer");
  if (v.is_employee) out.push("employee");
  if (v.is_enthusiast) out.push("enthusiast");
  return out;
}

const ROLE_TO_FIELD: Record<ProfileRole, keyof RawProfileValues> = {
  university: "is_student",
  founder: "is_founder",
  developer: "is_developer",
  employee: "is_employee",
  enthusiast: "is_enthusiast",
};

export function roleFieldKey(role: ProfileRole): keyof RawProfileValues {
  return ROLE_TO_FIELD[role];
}

export function walletsFromValues(v: RawProfileValues): ProfileWallet[] {
  const list = Array.isArray(v.wallet) ? v.wallet : [];
  return list
    .filter((addr) => typeof addr === "string" && addr.trim() !== "")
    .map((address, idx) => ({
      address: address.trim(),
      label: idx === 0 ? "Core" : "Additional",
      primary: idx === 0,
    }));
}

export function skillsFromValues(v: RawProfileValues): string[] {
  return Array.isArray(v.skills) ? v.skills.filter((s): s is string => !!s && !!s.trim()) : [];
}

const X_HOST_RE = /(?:x|twitter)\.com\//i;
const LINKEDIN_HOST_RE = /linkedin\.com\//i;

/**
 * Personal-site links only — the dedicated `x_account` and `linkedin_account`
 * fields handle their respective socials directly, so
 * `additional_social_accounts` should hold residual personal sites. Defensive
 * filter strips any X / LinkedIn URLs that may have been stored there by a
 * previous version.
 */
export function siteLinksFromValues(v: RawProfileValues): ProfileLink[] {
  return (v.additional_social_accounts ?? [])
    .filter(
      (url): url is string =>
        typeof url === "string" &&
        url.trim() !== "" &&
        !X_HOST_RE.test(url) &&
        !LINKEDIN_HOST_RE.test(url),
    )
    .map((url) => ({ kind: "website" as const, url: ensureUrl(url.trim()) }));
}

export function siteLinksToStringArray(links: ProfileLink[]): string[] {
  return links
    .map((l) => ensureUrl(l.url.trim()))
    .filter((url) => url.length > 0);
}
