/**
 * RPC URL construction and classification for L1 nodes.
 *
 * The single place that knows how a node's JSON-RPC URL is built and
 * whether a given URL can work from the console page. The page runs on an
 * https origin, so `http://` URLs on remote hosts are blocked by the
 * browser's mixed-content policy before any request leaves; `http://` on
 * loopback hosts is a potentially-trustworthy origin and stays allowed.
 * Wallet extensions are NOT subject to this policy: the two sides can
 * disagree, which is exactly the failure class of issue #4450.
 */

const IPV4_REGEX =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export const isValidIPv4 = (value: string): boolean => {
  return IPV4_REGEX.test(value);
};

export const nipify = (domain: string): string => {
  if (isValidIPv4(domain)) {
    // nip.io instead of sslip.io: as of 2026-05-21 sslip.io's shared
    // Let's Encrypt zone is rate-limited (HTTP 429 "too many certificates"
    // — 250k cert cap per registered domain over 168h), so Caddy retries
    // forever on the docker-generated reverse proxy. nip.io resolves the
    // same `<ip>.<domain>` → ip but lives under a non-rate-limited zone.
    return `${domain}.nip.io`;
  }
  return domain;
};

export function isLoopbackHost(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return bare === 'localhost' || bare === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(bare);
}

/**
 * The one correct URL for a self-hosted node, or null when none exists.
 * A remote node without a domain has NO reachable URL the console could
 * invent — returning null (instead of defaulting to localhost) is what
 * keeps the wrong URL from ever being displayed, stored, or sent to the
 * wallet.
 */
export function buildNodeRpcUrl(args: {
  location: 'local' | 'remote';
  domain: string;
  blockchainId: string;
}): string | null {
  const { location, domain, blockchainId } = args;
  if (location === 'local') return `http://localhost:9650/ext/bc/${blockchainId}/rpc`;
  const trimmed = domain.trim();
  if (!trimmed) return null;
  return `https://${nipify(trimmed)}/ext/bc/${blockchainId}/rpc`;
}

export type RpcUrlPageClass = 'ok' | 'loopback-http' | 'mixed-content' | 'invalid';

export function classifyRpcUrlForPage(rpcUrl: string, pageProtocol: string): RpcUrlPageClass {
  let url: URL;
  try {
    url = new URL(rpcUrl.trim());
  } catch {
    return 'invalid';
  }
  if (url.protocol === 'https:') return 'ok';
  if (url.protocol !== 'http:') return 'invalid';
  if (isLoopbackHost(url.hostname)) return 'loopback-http';
  return pageProtocol === 'https:' ? 'mixed-content' : 'ok';
}

/** Ignores trailing slash, host case, and surrounding whitespace; keeps the
 *  path case-sensitive (blockchain IDs are case-sensitive). */
export function rpcUrlsEquivalent(a: string, b: string): boolean {
  const normalize = (value: string): string => {
    const trimmed = value.trim();
    try {
      const url = new URL(trimmed);
      return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
    } catch {
      return trimmed;
    }
  };
  return normalize(a) === normalize(b);
}
