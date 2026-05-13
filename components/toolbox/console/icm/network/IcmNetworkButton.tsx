'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavTrailingPill } from '@/components/console/nav-trailing-pill';
import { useIcmContext } from './hooks/useIcmContext';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';

/**
 * Trailing pill for the StepFlow nav row. Opens a Sheet with a per-L1
 * matrix showing what's deployed and how the relayer routes between them.
 * Mirrors `ManageBridgesButton` on the ICTT side.
 */
export function IcmNetworkButton() {
  const [open, setOpen] = useState(false);
  const ctx = useIcmContext();
  const count = ctx.relayerNetworkL1s.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <NavTrailingPill icon={Layers} label="Network" badge={count > 0 ? String(count) : undefined} />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your ICM network</SheetTitle>
        </SheetHeader>
        <NetworkMatrixBody />
      </SheetContent>
    </Sheet>
  );
}

function NetworkMatrixBody() {
  const ctx = useIcmContext();
  const sources = ctx.relayer.sources;
  const destinations = ctx.relayer.destinations;
  const chains = useIcmSetupStore((s) => s.chains);
  const reset = useIcmSetupStore((s) => s.reset);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Chains</h3>
        {ctx.relayerNetworkL1s.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No chains in your ICM network yet. Deploy the Messenger or pick chains in the Relayer phase to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ctx.relayerNetworkL1s.map((l1) => {
              const status = chains[l1.id];
              const flags: string[] = [];
              if (status?.messengerDeployedAt) flags.push('Messenger ✓');
              if (status?.registryAddress) flags.push('Registry ✓');
              if (status?.demoAddress) flags.push('Demo ✓');
              const isSource = sources.includes(l1.id);
              const isDest = destinations.includes(l1.id);
              const routing = [isSource && 'source', isDest && 'destination'].filter(Boolean).join(' · ');
              return (
                <li key={l1.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{l1.name}</span>
                    {routing && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{routing}</span>
                    )}
                  </div>
                  {flags.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{flags.join(' · ')}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Reset</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Clears local ICM setup state (chains, relayer config, activity log). On-chain deployments are not affected.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Reset local ICM state
        </button>
      </section>
    </div>
  );
}
