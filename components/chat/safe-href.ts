// Only permit http(s)/mailto endpoints (and internal/relative links) as
// clickable links. Shared conversations contain user-submitted content, so a
// message could embed a `javascript:` (or other) URI that executes in this
// origin when a viewer clicks it. Anything outside the allowlist should be
// rendered as inert text rather than a clickable anchor.
export function isSafeHref(href: unknown): boolean {
  if (typeof href !== 'string') return false;
  // Strip whitespace and ASCII control chars used to smuggle schemes
  // (e.g. "java\tscript:") before inspecting.
  const cleaned = href.replace(/[\u0000-\u0020]/g, '').toLowerCase();
  if (!cleaned) return false;
  // Internal/relative links and in-page anchors have no scheme — allow them.
  if (/^(\/|#|\.\/|\.\.\/|\?)/.test(cleaned)) return true;
  // Absolute links must be http(s) or mailto; blocks javascript:, data:, etc.
  return /^https?:\/\//.test(cleaned) || /^mailto:/.test(cleaned);
}
