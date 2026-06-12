/**
 * Social-account input formatting helpers.
 *
 * The `*_ACCOUNT_PATTERN`s in `./socialAccountValidation` only *validate* —
 * they accept or reject. These helpers *normalize* (auto-complete) loose user
 * input into the canonical stored form, so a handle like `username` or a pasted
 * `https://t.me/username` collapse to the same value instead of being rejected.
 *
 * Canonical stored forms:
 *   - Telegram → bare handle (no `@`); the `@` is presentation-only.
 *   - X        → `https://x.com/<handle>`
 *   - LinkedIn → `https://www.linkedin.com/<kind>/<slug>`
 *   - GitHub   → `https://github.com/<handle>` (URL form, used by project socials)
 *
 * Every output satisfies the matching `*_ACCOUNT_PATTERN`, so validation still
 * passes after normalization. Empty / whitespace input always returns "".
 *
 * This module is the single source of truth: `components/profile/shell/adapter.ts`
 * and the project-creation form delegate to it instead of re-implementing
 * handle/URL parsing.
 */

import { normalizeUrl } from "@/lib/url-validation";

const safe = (input: string | null | undefined): string => (input ?? "").trim();

// ---------------------------------------------------------------------------
// Telegram — canonical: bare handle (no leading @)
// ---------------------------------------------------------------------------

/** Strips a leading `@`, any `t.me/` / `telegram.me/` wrapper, and trailing slashes. */
export function normalizeTelegram(input: string | null | undefined): string {
  const trimmed = safe(input);
  if (!trimmed) return "";
  const fromUrl = trimmed.match(/(?:t|telegram)\.me\/([^/?#\s]+)/i);
  const handle = (fromUrl ? fromUrl[1] : trimmed).replace(/^@+/, "");
  return handle.replace(/\/+$/, "");
}

/** Presentation form for a Telegram handle: `@handle` (or "" when empty). */
export function formatTelegramDisplay(input: string | null | undefined): string {
  const handle = normalizeTelegram(input);
  return handle ? `@${handle}` : "";
}

// ---------------------------------------------------------------------------
// X / Twitter — canonical: https://x.com/<handle>
// ---------------------------------------------------------------------------

/** Returns the bare X/Twitter handle from a URL, `@handle`, or bare handle. */
export function extractXUsername(input: string | null | undefined): string {
  const trimmed = safe(input);
  if (!trimmed) return "";
  const match = trimmed.match(/(?:twitter|x)\.com\/([^/?#\s]+)/i);
  return (match ? match[1] : trimmed).replace(/^@+/, "").replace(/\/+$/, "");
}

/** Builds the canonical X profile URL, normalizing twitter.com → x.com. */
export function normalizeXUrl(input: string | null | undefined): string {
  const handle = extractXUsername(input);
  return handle ? `https://x.com/${handle}` : "";
}

// ---------------------------------------------------------------------------
// LinkedIn — canonical: https://www.linkedin.com/<kind>/<slug>
// ---------------------------------------------------------------------------

export type LinkedInKind = "in" | "company" | "pub" | "school";

/** Returns the slug after `/in/`, `/company/`, etc., or the cleaned input. */
export function extractLinkedInSlug(input: string | null | undefined): string {
  const trimmed = safe(input);
  if (!trimmed) return "";
  const match = trimmed.match(/linkedin\.com\/(?:in|pub|company|school)\/([^/?#\s]+)/i);
  return (match ? match[1] : trimmed).replace(/^\/+|\/+$/g, "");
}

/**
 * Builds the canonical LinkedIn URL. When the input already names a path kind
 * (`/company/`, `/school/`, …) that kind is preserved; bare slugs fall back to
 * `defaultKind` (personal profiles use "in", company pages use "company").
 */
export function normalizeLinkedInUrl(
  input: string | null | undefined,
  defaultKind: LinkedInKind = "in",
): string {
  const trimmed = safe(input);
  if (!trimmed) return "";
  const match = trimmed.match(/linkedin\.com\/(in|pub|company|school)\/([^/?#\s]+)/i);
  if (match) {
    return `https://www.linkedin.com/${match[1].toLowerCase()}/${match[2].replace(/\/+$/, "")}`;
  }
  const slug = trimmed.replace(/^\/+|\/+$/g, "");
  return slug ? `https://www.linkedin.com/${defaultKind}/${slug}` : "";
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

/** Returns the bare GitHub username/org from a URL, `@handle`, or bare handle. */
export function extractGithubUsername(input: string | null | undefined): string {
  const trimmed = safe(input);
  if (!trimmed) return "";
  const match = trimmed.match(/github\.com\/([^/?#\s]+)/i);
  return (match ? match[1] : trimmed).replace(/^@+/, "").replace(/\/+$/, "");
}

/** Builds the canonical GitHub profile URL. */
export function normalizeGithubUrl(input: string | null | undefined): string {
  const handle = extractGithubUsername(input);
  return handle ? `https://github.com/${handle}` : "";
}

// ---------------------------------------------------------------------------
// Generic site URL
// ---------------------------------------------------------------------------

/** Prepends `https://` when a scheme is missing; passes empty values through. */
export function ensureUrl(input: string | null | undefined): string {
  const value = input ?? "";
  return value ? normalizeUrl(value) : value;
}
