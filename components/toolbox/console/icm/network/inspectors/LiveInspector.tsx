'use client';

import SendICMMessage from '@/components/toolbox/console/icm/test-connection/SendICMMessage';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useSelectedL1, useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { Note } from '@/components/toolbox/components/Note';

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
        <Note variant="warning">
          <span className="text-xs">
            {sourceReady
              ? `Deploy the demo on ${counterpart?.name ?? 'the destination chain'} before sending — the receiver address comes from there.`
              : `Deploy the demo on ${selectedL1?.name ?? 'this chain'} first, then on a counterpart, before sending a message.`}
          </span>
        </Note>
      )}
      <SendICMMessage />
    </section>
  );
}
