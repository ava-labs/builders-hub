'use client';

import { useEffect, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Cog, Cloud } from 'lucide-react';
import ICMRelayer from '@/components/toolbox/console/icm/setup/ICMRelayer';
import CreateManagedTestnetRelayer from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/CreateManagedTestnetRelayer';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { Note } from '@/components/toolbox/components/Note';
import type { RelayerMode } from '@/components/toolbox/console/icm/network/types';

/**
 * Relayer phase inspector. Lets the user pick between Avalanche's managed
 * testnet relayer service and a self-hosted Docker relayer, then renders
 * the appropriate configuration tool inside the inspector pane.
 *
 * The choice is persisted to `icmSetupStore.relayer.mode` so the ribbon's
 * adaptive layout knows which counterparty pills (sources / destinations)
 * to surface above the body.
 */
export function RelayerInspector() {
  const mode = useIcmSetupStore((s) => s.relayer.mode);
  const setRelayerMode = useIcmSetupStore((s) => s.setRelayerMode);

  // Local controlled state mirrors the store so the ToggleGroup feels snappy
  // even before the store-write propagates back through selectors.
  const [localMode, setLocalMode] = useState<RelayerMode>(mode);
  useEffect(() => setLocalMode(mode), [mode]);

  const handleChange = (next: string) => {
    if (next !== 'self-hosted' && next !== 'managed') return;
    setLocalMode(next);
    setRelayerMode(next);
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          How do you want to relay messages?
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A relayer watches your source chains and delivers messages to destination chains. Pick the option that fits
          your stage — Avalanche can host one for you on testnet, or you can run your own Docker container.
        </p>
      </header>
      <ToggleGroup
        type="single"
        value={localMode}
        onValueChange={(v) => v && handleChange(v)}
        className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <ToggleGroupItem
          value="managed"
          aria-label="Managed testnet relayer"
          className="flex h-auto flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white p-4 text-left data-[state=on]:border-zinc-900 data-[state=on]:ring-2 data-[state=on]:ring-zinc-900/30 dark:border-zinc-800 dark:bg-zinc-900 dark:data-[state=on]:border-zinc-200 dark:data-[state=on]:ring-zinc-200/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Cloud className="h-4 w-4" aria-hidden /> Managed testnet relayer
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Avalanche hosts a relayer for your Fuji testnet L1. No Docker, no funding.
          </p>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="self-hosted"
          aria-label="Self-hosted Docker relayer"
          className="flex h-auto flex-col items-start gap-1 rounded-xl border border-zinc-200 bg-white p-4 text-left data-[state=on]:border-zinc-900 data-[state=on]:ring-2 data-[state=on]:ring-zinc-900/30 dark:border-zinc-800 dark:bg-zinc-900 dark:data-[state=on]:border-zinc-200 dark:data-[state=on]:ring-zinc-200/30"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Cog className="h-4 w-4" aria-hidden /> Self-hosted Docker
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Run the relayer yourself with a generated config. Required for mainnet.
          </p>
        </ToggleGroupItem>
      </ToggleGroup>

      {localMode === 'managed' ? (
        <CreateManagedTestnetRelayer />
      ) : (
        <div className="flex flex-col gap-3">
          <Note variant="default">
            <span className="text-xs">
              Pick the source and destination chains, fund the relayer signer, and copy the generated Docker command.
              The same config powers mainnet relayers — only the network endpoints differ.
            </span>
          </Note>
          <ICMRelayer />
        </div>
      )}
    </section>
  );
}
