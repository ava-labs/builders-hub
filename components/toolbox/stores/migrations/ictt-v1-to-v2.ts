import type { Address, Bridge, BridgeId, RemoteId } from '@/components/toolbox/console/ictt/bridge/types';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { STORE_VERSION } from '@/components/toolbox/stores/utils';

const MIGRATED_FLAG_KEY = 'ictt-bridges-migrated';

interface LegacyToolboxState {
  state?: {
    exampleErc20Address?: string;
    erc20TokenHomeAddress?: string;
    nativeTokenHomeAddress?: string;
    erc20TokenRemoteAddress?: string;
    nativeTokenRemoteAddress?: string;
  };
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isAddress(value: string | undefined | null): value is Address {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function makeBridgeId(homeL1Id: string, homeAddress: Address): BridgeId {
  return `bridge-${homeL1Id}-${homeAddress.toLowerCase()}` as BridgeId;
}

function makeRemoteId(remoteL1Id: string, remoteAddress: Address): RemoteId {
  return `remote-${remoteL1Id}-${remoteAddress.toLowerCase()}` as RemoteId;
}

export interface MigrationResult {
  bridges: Bridge[];
  /** Remote slots that exist in legacy state but couldn't be mapped to a Home
   *  (orphans). The new UI should prompt the user to "adopt" them. */
  orphanRemotes: Array<{ remoteL1Id: string; address: Address; kind: 'erc20-remote' | 'native-remote' }>;
  /** True iff at least one piece of legacy state was found and translated. */
  didMigrate: boolean;
}

export function hasMigrated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MIGRATED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function markMigrated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MIGRATED_FLAG_KEY, '1');
  } catch {}
}

/**
 * Build a v2 bridge graph from the legacy flat keys persisted under
 * `${STORE_VERSION}-toolbox-storage-<l1Id>`. Pure with respect to side
 * effects beyond reading localStorage; the caller is responsible for
 * writing the result into the bridge store.
 */
export function migrateLegacyState(l1List: L1ListItem[], now: number = Date.now()): MigrationResult {
  const bridges: Bridge[] = [];
  const orphanRemotes: MigrationResult['orphanRemotes'] = [];
  let didMigrate = false;

  for (const l1 of l1List) {
    const legacy = readJson<LegacyToolboxState>(`${STORE_VERSION}-toolbox-storage-${l1.id}`);
    const state = legacy?.state;
    if (!state) continue;

    const erc20Home = state.erc20TokenHomeAddress;
    const nativeHome = state.nativeTokenHomeAddress;
    const erc20Remote = state.erc20TokenRemoteAddress;
    const nativeRemote = state.nativeTokenRemoteAddress;
    const example = state.exampleErc20Address;

    if (isAddress(erc20Home)) {
      didMigrate = true;
      bridges.push({
        id: makeBridgeId(l1.id, erc20Home),
        kind: 'erc20-home',
        homeL1Id: l1.id,
        homeAddress: erc20Home,
        underlyingTokenAddress: isAddress(example) ? example : undefined,
        createdAt: now,
        remotes: [],
      });
    }

    if (isAddress(nativeHome)) {
      didMigrate = true;
      bridges.push({
        id: makeBridgeId(l1.id, nativeHome),
        kind: 'native-home',
        homeL1Id: l1.id,
        homeAddress: nativeHome,
        createdAt: now,
        remotes: [],
      });
    }

    if (isAddress(erc20Remote)) {
      didMigrate = true;
      orphanRemotes.push({ remoteL1Id: l1.id, address: erc20Remote, kind: 'erc20-remote' });
    }

    if (isAddress(nativeRemote)) {
      didMigrate = true;
      orphanRemotes.push({ remoteL1Id: l1.id, address: nativeRemote, kind: 'native-remote' });
    }
  }

  return { bridges, orphanRemotes, didMigrate };
}

/**
 * Heuristic adoption: when there is exactly one Home of the matching kind
 * across all L1s, attach orphans to it. Returns the bridges with adopted
 * remotes plus the orphans that still couldn't be matched.
 */
export function adoptOrphans(
  bridges: Bridge[],
  orphans: MigrationResult['orphanRemotes'],
  now: number = Date.now(),
): { bridges: Bridge[]; remainingOrphans: MigrationResult['orphanRemotes'] } {
  if (orphans.length === 0) return { bridges, remainingOrphans: [] };

  const bridgesByKind = bridges.reduce<Record<'erc20-home' | 'native-home', Bridge[]>>(
    (acc, bridge) => {
      acc[bridge.kind] = acc[bridge.kind] ?? [];
      acc[bridge.kind].push(bridge);
      return acc;
    },
    { 'erc20-home': [], 'native-home': [] },
  );

  const remainingOrphans: MigrationResult['orphanRemotes'] = [];

  const next = bridges.map((b) => ({ ...b, remotes: [...b.remotes] }));

  for (const orphan of orphans) {
    const expectedHomeKind = orphan.kind === 'erc20-remote' ? 'erc20-home' : 'native-home';
    const candidates = bridgesByKind[expectedHomeKind] ?? [];
    if (candidates.length === 1) {
      const target = next.find((b) => b.id === candidates[0].id);
      if (target) {
        target.remotes.push({
          id: makeRemoteId(orphan.remoteL1Id, orphan.address),
          kind: orphan.kind,
          l1Id: orphan.remoteL1Id,
          address: orphan.address,
          registeredAt: now,
        });
        continue;
      }
    }
    remainingOrphans.push(orphan);
  }

  return { bridges: next, remainingOrphans };
}
