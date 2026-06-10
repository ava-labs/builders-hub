'use client';

import { useEffect } from 'react';
import DeployICMDemo from '@/components/toolbox/console/icm/test-connection/DeployICMDemo';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useL1List, useSelectedL1, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { Note } from '@/components/toolbox/components/Note';
import type { Address } from '@/components/toolbox/console/icm/network/types';

/**
 * Demo phase inspector. Wraps the existing `DeployICMDemo` tool and:
 *   1. Mirrors the deployed `icmReceiverAddress` from `toolboxStore` into
 *      `icmSetupStore.chains[activeL1].demoAddress` so the ribbon network
 *      pill reflects the deployment immediately.
 *   2. Seeds `lastCounterpartL1Id` to the first L1 with a Messenger that
 *      isn't the active L1 — so the Live phase has a sensible default
 *      recipient chain without the user having to pick one upfront.
 */
export function DemoInspector() {
  const selectedL1 = useSelectedL1();
  const l1List = useL1List();
  const setDemoAddress = useIcmSetupStore((s) => s.setDemoAddress);
  const setLastCounterpartL1 = useIcmSetupStore((s) => s.setLastCounterpartL1);
  const lastCounterpartL1Id = useIcmSetupStore((s) => s.lastCounterpartL1Id);
  const chains = useIcmSetupStore((s) => s.chains);
  const storedDemoAddress = useIcmSetupStore((s) =>
    selectedL1 ? (s.chains[selectedL1.id]?.demoAddress ?? null) : null,
  );

  // Subscribe to the active L1's toolbox slice directly. The previous
  // version called the store hook inside useMemo — an invalid hook call
  // that threw on every render; the catch returned null, silently
  // disabling this mirror. '' maps to the inert bootstrap store.
  const toolboxDemo = getToolboxStore(selectedL1?.id ?? '')(
    (s: { icmReceiverAddress: string }) => (s.icmReceiverAddress || null) as Address | null,
  );

  useEffect(() => {
    if (!selectedL1) return;
    if (!toolboxDemo || toolboxDemo.length <= 2) return;
    if (storedDemoAddress === toolboxDemo) return;
    setDemoAddress(selectedL1.id, toolboxDemo);
  }, [selectedL1, storedDemoAddress, toolboxDemo, setDemoAddress]);

  useEffect(() => {
    if (lastCounterpartL1Id) return;
    if (!selectedL1) return;
    const counterpartCandidate =
      (l1List as L1ListItem[]).find((l1) => l1.id !== selectedL1.id && chains[l1.id]?.messengerDeployedAt) ??
      (l1List as L1ListItem[]).find((l1) => l1.id !== selectedL1.id);
    if (counterpartCandidate) {
      setLastCounterpartL1(counterpartCandidate.id);
    }
  }, [chains, l1List, lastCounterpartL1Id, selectedL1, setLastCounterpartL1]);

  return (
    <section className="flex flex-col gap-4">
      <Note variant="default">
        <span className="text-xs">
          The demo contract is a minimal sender/receiver — perfect for verifying the relayer is delivering messages.
          Deploy it on both the active L1 and at least one counterpart L1 so you can send a message back and forth.
        </span>
      </Note>
      <DeployICMDemo />
    </section>
  );
}
