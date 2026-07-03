'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useL1List, useL1ByChainId, useSelectedL1, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import {
  ICM_PHASE_ORDER,
  type IcmContextValue,
  type IcmPhase,
  isValidIcmPhase,
} from '@/components/toolbox/console/icm/network/types';
import { useIcmMigrationOnce } from './useIcmMigrationOnce';

function normalizePhase(input: string | null | undefined, fallback: IcmPhase = 'messenger'): IcmPhase {
  if (input && isValidIcmPhase(input)) return input;
  return fallback;
}

interface UseIcmContextOptions {
  step?: string;
}

export function useIcmContext({ step }: UseIcmContextOptions = {}): IcmContextValue {
  const searchParams = useSearchParams();
  const migration = useIcmMigrationOnce();
  const phase = normalizePhase(step);

  const chains = useIcmSetupStore((s) => s.chains);
  const relayer = useIcmSetupStore((s) => s.relayer);
  const activityLog = useIcmSetupStore((s) => s.activityLog);
  const lastActiveL1Id = useIcmSetupStore((s) => s.lastActiveL1Id);
  const lastCounterpartL1Id = useIcmSetupStore((s) => s.lastCounterpartL1Id);
  const setLastActiveL1 = useIcmSetupStore((s) => s.setLastActiveL1);
  const setLastCounterpartL1 = useIcmSetupStore((s) => s.setLastCounterpartL1);

  const l1List = useL1List();
  const selectedL1 = useSelectedL1();

  const urlActiveL1 = searchParams.get('l1');
  const urlCounterpartL1 = searchParams.get('counterpart');

  const activeL1Id = urlActiveL1 ?? lastActiveL1Id ?? selectedL1?.id ?? null;
  const counterpartL1Id = urlCounterpartL1 ?? lastCounterpartL1Id ?? null;

  const activeL1 = useL1ByChainId(activeL1Id ?? '') ?? selectedL1 ?? null;
  const counterpartL1 = useL1ByChainId(counterpartL1Id ?? '') ?? null;

  const activeL1Status = useMemo(() => {
    if (!activeL1) return null;
    return chains[activeL1.id] ?? null;
  }, [activeL1, chains]);

  const relayerSourceL1s = useMemo(
    () => l1List.filter((l1: L1ListItem) => relayer.sources.includes(l1.id)),
    [l1List, relayer.sources],
  );

  const relayerDestinationL1s = useMemo(
    () => l1List.filter((l1: L1ListItem) => relayer.destinations.includes(l1.id)),
    [l1List, relayer.destinations],
  );

  const relayerNetworkL1s = useMemo(() => {
    const ids = new Set<string>([...relayer.sources, ...relayer.destinations]);
    for (const [id, status] of Object.entries(chains)) {
      if (status.messengerDeployedAt || status.registryAddress || status.demoAddress) {
        ids.add(id);
      }
    }
    return l1List.filter((l1: L1ListItem) => ids.has(l1.id));
  }, [l1List, relayer.sources, relayer.destinations, chains]);

  const highestReachablePhase = useMemo<IcmPhase>(() => {
    if (!activeL1Status) return 'messenger';
    if (!activeL1Status.messengerDeployedAt) return 'messenger';
    if (!activeL1Status.registryAddress) return 'registry';
    if (!relayer.savedAt && relayer.mode === 'self-hosted') return 'relayer';
    if (!activeL1Status.demoAddress) return 'demo';
    return 'live';
  }, [activeL1Status, relayer.savedAt, relayer.mode]);

  return {
    phase,
    activeL1,
    activeL1Status,
    counterpartL1,
    relayer,
    relayerSourceL1s,
    relayerDestinationL1s,
    relayerNetworkL1s,
    events: activityLog,
    highestReachablePhase,
    migrationReady: migration.ran,
    setActiveL1: setLastActiveL1,
    setCounterpartL1: setLastCounterpartL1,
  };
}

export { ICM_PHASE_ORDER };
