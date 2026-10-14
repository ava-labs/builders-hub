'use client';

import SendICMMessage from '@/components/toolbox/console/icm/test-connection/SendICMMessage';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useSelectedL1, useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { Alert } from '@/components/toolbox/components/Alert';

/**
 * Live phase inspector. Wraps the existing `SendICMMessage` tool. Surfaces
 * an upfront prerequisite check so the user understands what needs to be in
 * place — the message send itself remains controlled by the legacy tool.
 */
export function LiveInspector() {
  const selectedL1 = useSelectedL1();
  const counterpartId = useIcmSetupStore((s) => s.lastCounterpartL1Id);
  const counterpart = useL1ByChainId(counterpartId ?? '');
  const counterpartStatus = useIcmSetupStore((s) => (counterpartId ? (s.chains[counterpartId] ?? null) : null));
  const sourceStatus = useIcmSetupStore((s) => (selectedL1 ? (s.chains[selectedL1.id] ?? null) : null));

  const counterpartReady = Boolean(counterpartStatus?.demoAddress);
  const sourceReady = Boolean(sourceStatus?.demoAddress);
  const showPrereqWarning = !counterpartReady || !sourceReady;

  return (
    <section className="flex flex-col gap-4">
      {showPrereqWarning && (
        <Alert variant="warning">
          {sourceReady
            ? `Deploy the demo on ${counterpart?.name ?? 'the destination chain'} before sending. The receiver address comes from there.`
            : `Deploy the demo on ${selectedL1?.name ?? 'this chain'} first, then on a second L1, before sending a message.`}
        </Alert>
      )}
      <SendICMMessage />
    </section>
  );
}
