import 'server-only';
import { RelayerServiceURLs } from '@/app/api/managed-testnet-relayers/constants';
import { toCb58Id } from '@/lib/studio/l1';

export type RelayerCheck =
  | { status: 'serving'; relayerId: string }
  | { status: 'unhealthy'; relayerId: string; unreachable: boolean }
  | { status: 'missing'; missing: string[] }
  | { status: 'unavailable'; reason: string };

interface ServiceRelayer {
  relayerId: string;
  label: string;
  chains: string[];
  healthy: boolean;
  unreachable: boolean;
}

/**
 * The service reports health as `{ status: "up", details }`, as the console's relayer card reads it;
 * `healthy: true` is accepted too. No health at all means the service could not reach the relayer.
 */
function isHealthy(health: unknown): boolean {
  const h = health as { status?: string; healthy?: boolean } | null | undefined;
  return h?.status === 'up' || h?.healthy === true;
}

/** The service answers with an array, `{ relayers }`, or an object keyed by id; the console route accepts all three. */
function parse(data: unknown): ServiceRelayer[] {
  const list: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { relayers?: unknown }).relayers)
      ? (data as { relayers: Record<string, unknown>[] }).relayers
      : data && typeof data === 'object'
        ? (Object.values(data) as Record<string, unknown>[])
        : [];
  return list.map((item) => ({
    relayerId: String(item.relayerId ?? item.address ?? item.id ?? item.relayer_id ?? ''),
    label: String(item.label ?? ''),
    chains: ((item.configs ?? []) as { blockchainId?: string }[])
      .map((c) => (c.blockchainId ? toCb58Id(c.blockchainId) : null))
      .filter((id): id is string => !!id),
    healthy: isHealthy(item.health),
    unreachable: item.health === null || item.health === undefined,
  }));
}

/**
 * Whether one of the builder's managed testnet relayers serves every chain
 * given, as CB58 blockchain IDs. Relayers are the builder's when their label
 * is the builder's user ID, which is how the console and Quick L1 create them.
 */
export async function findRelayer(userId: string, blockchainIds: string[]): Promise<RelayerCheck> {
  const password = process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD;
  if (!password)
    return { status: 'unavailable', reason: 'the managed relayer service is not configured on this server' };
  const wanted = blockchainIds.map((id) => toCb58Id(id)).filter((id): id is string => !!id);

  let relayers: ServiceRelayer[];
  try {
    const res = await fetch(RelayerServiceURLs.list(password), {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: 'unavailable', reason: `the managed relayer service answered ${res.status}` };
    relayers = parse(await res.json());
  } catch {
    return { status: 'unavailable', reason: 'the managed relayer service did not answer' };
  }

  const mine = relayers.filter((r) => r.label.toLowerCase() === userId.toLowerCase());
  const covering = mine.filter((r) => wanted.every((id) => r.chains.includes(id)));
  const healthy = covering.find((r) => r.healthy);
  if (healthy) return { status: 'serving', relayerId: healthy.relayerId };
  if (covering.length) {
    return { status: 'unhealthy', relayerId: covering[0].relayerId, unreachable: covering.every((r) => r.unreachable) };
  }
  const best = mine.reduce<string[] | null>((least, r) => {
    const missing = wanted.filter((id) => !r.chains.includes(id));
    return !least || missing.length < least.length ? missing : least;
  }, null);
  return { status: 'missing', missing: best ?? wanted };
}
