/**
 * Shared URL validation utilities.
 *
 * The native URL constructor accepts values like "https://asdf" as valid,
 * since "asdf" is technically a valid hostname. In form inputs we usually
 * want stricter validation (scheme + hostname with a dot), so these helpers
 * centralize that logic and keep schemas DRY.
 */

/**
 * Prepends "https://" when the value lacks an http(s) scheme.
 * Returns an empty string when the input is empty or whitespace only.
 */
export const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

/**
 * Validates that a string is a realistic http(s) URL:
 * - Must parse via the URL constructor
 * - Protocol must be http:// or https://
 * - Hostname must exist and either be "localhost" or contain a dot
 */
export const isValidHttpUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname;
    if (!host) return false;
    if (host === "localhost") return true;
    return host.includes(".");
  } catch {
    return false;
  }
};

/**
 * Normalizes the input and returns the valid URL, or null when invalid.
 * Convenience helper for form handlers that want to format + validate in one step.
 */
export const normalizeAndValidateUrl = (raw: string): string | null => {
  const normalized = normalizeUrl(raw);
  return isValidHttpUrl(normalized) ? normalized : null;
};
