/**
 * AvalancheGo version helpers, shared by the API routes that aggregate
 * validator sets and the components that render them.
 */

export function minorVersionLine(raw?: string | null): string {
  const m = /(\d+)\.(\d+)/.exec((raw ?? "").replace("avalanchego/", ""));
  return m ? `${m[1]}.${m[2]}` : "";
}
