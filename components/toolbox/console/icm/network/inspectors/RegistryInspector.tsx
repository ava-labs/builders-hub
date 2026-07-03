'use client';

import { useEffect } from 'react';
import TeleporterRegistry from '@/components/toolbox/console/icm/setup/TeleporterRegistry';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import type { Address } from '@/components/toolbox/console/icm/network/types';

/**
 * Registry phase inspector. Wraps the existing `TeleporterRegistry` deploy
 * tool. Synchronises the active L1's `registryAddress` from `toolboxStore`
 * into the new `icmSetupStore` whenever the value changes, so the ICM
 * ribbon and downstream phases see the latest deployment immediately.
 */
export function RegistryInspector() {
  const selectedL1 = useSelectedL1();
  const toolboxRegistry = useToolboxStore().teleporterRegistryAddress;
  const setRegistryAddress = useIcmSetupStore((s) => s.setRegistryAddress);
  const setLastActiveL1 = useIcmSetupStore((s) => s.setLastActiveL1);
  const storedAddress = useIcmSetupStore((s) =>
    selectedL1 ? (s.chains[selectedL1.id]?.registryAddress ?? null) : null,
  );

  useEffect(() => {
    if (!selectedL1) return;
    setLastActiveL1(selectedL1.id);
  }, [selectedL1, setLastActiveL1]);

  useEffect(() => {
    if (!selectedL1) return;
    if (!toolboxRegistry || toolboxRegistry.length <= 2) return;
    if (storedAddress === toolboxRegistry) return;
    setRegistryAddress(selectedL1.id, toolboxRegistry as Address);
  }, [selectedL1, storedAddress, toolboxRegistry, setRegistryAddress]);

  return <TeleporterRegistry />;
}
