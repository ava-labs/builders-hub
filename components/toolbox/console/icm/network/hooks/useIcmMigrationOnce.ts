'use client';

import { useEffect, useState } from 'react';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import type { Address } from '@/components/toolbox/console/icm/network/types';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';

interface MigrationState {
  ran: boolean;
}

/**
 * One-time migration that backfills `useIcmSetupStore.chains` from the
 * existing per-chain `toolboxStore` slices and the well-known registry
 * addresses on `useL1List`. Runs once per mount of any consumer.
 *
 * Idempotent — only fills slots that are still null.
 */
export function useIcmMigrationOnce(): MigrationState {
  const l1List = useL1List();
  const upsertChain = useIcmSetupStore((s) => s.upsertChain);
  const chains = useIcmSetupStore((s) => s.chains);
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (ran) return;
    if (!l1List || l1List.length === 0) return;

    for (const l1 of l1List as L1ListItem[]) {
      const existing = chains[l1.id];
      try {
        const slice = getToolboxStore(l1.id)();
        const registryFromToolbox = (slice.teleporterRegistryAddress ?? '') as string;
        const demoFromToolbox = (slice.icmReceiverAddress ?? '') as string;
        const registryFromL1 = (l1.wellKnownTeleporterRegistryAddress ?? '') as string;

        let registryAddress: Address | null = existing?.registryAddress ?? null;
        if (!registryAddress && registryFromToolbox.length > 2) {
          registryAddress = registryFromToolbox as Address;
        }
        if (!registryAddress && registryFromL1.length > 2) {
          registryAddress = registryFromL1 as Address;
        }

        let demoAddress: Address | null = existing?.demoAddress ?? null;
        if (!demoAddress && demoFromToolbox.length > 2) {
          demoAddress = demoFromToolbox as Address;
        }

        if (existing && existing.registryAddress === registryAddress && existing.demoAddress === demoAddress) {
          continue;
        }

        upsertChain(l1.id, {
          registryAddress: registryAddress satisfies Address | null,
          demoAddress: demoAddress satisfies Address | null,
        });
      } catch {
        // Per-chain failures are silent — the slot stays empty and the user
        // can deploy / re-fetch via the normal flow.
      }
    }

    setRan(true);
  }, [chains, l1List, ran, upsertChain]);

  return { ran };
}
