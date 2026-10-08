'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, Cog, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import ICMRelayer from '@/components/toolbox/console/icm/setup/ICMRelayer';
import CreateManagedTestnetRelayer from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/CreateManagedTestnetRelayer';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { Alert } from '@/components/toolbox/components/Alert';
import { BODY, CELL_GRID, CHOSEN, EYEBROW } from '@/components/toolbox/console/icm/ui';
import type { RelayerMode } from '@/components/toolbox/console/icm/network/types';

function ModeOption({
  selected,
  onSelect,
  icon,
  eyebrow,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group/opt relative flex flex-col gap-3 bg-white p-5 text-left dark:bg-zinc-950',
        selected && CHOSEN,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center border transition-colors',
            selected
              ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
              : 'border-zinc-200 text-zinc-500 group-hover/opt:border-zinc-400 group-hover/opt:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:group-hover/opt:border-zinc-600 dark:group-hover/opt:text-zinc-100',
          )}
        >
          {icon}
        </span>
        <span className="flex items-center gap-2.5">
          <span className={EYEBROW}>{eyebrow}</span>
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border',
              selected
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                : 'border-zinc-300 dark:border-zinc-700',
            )}
          >
            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
        </span>
      </span>
      <span className="mt-1 text-[15px] font-semibold text-zinc-900 decoration-zinc-400 underline-offset-4 group-hover/opt:underline dark:text-zinc-50 dark:decoration-zinc-500">
        {title}
      </span>
      <span className={BODY}>{description}</span>
    </button>
  );
}

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

  // Local controlled state mirrors the store so the choice feels snappy
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
      <header className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Relayer</p>
        <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          How do you want to relay messages?
        </h2>
        <p className={cn(BODY, 'max-w-2xl')}>
          A relayer watches your source chains and delivers messages to destination chains. On testnet Avalanche can
          host one for you, or you can run your own Docker container.
        </p>
      </header>

      <div role="radiogroup" aria-label="Relayer type" className={cn(CELL_GRID, 'grid-cols-1 sm:grid-cols-2')}>
        <ModeOption
          selected={localMode === 'managed'}
          onSelect={() => handleChange('managed')}
          icon={<Cloud className="h-4 w-4" aria-hidden />}
          eyebrow="Fuji only"
          title="Managed testnet relayer"
          description="Avalanche hosts a relayer for your Fuji L1. No Docker, no funding."
        />
        <ModeOption
          selected={localMode === 'self-hosted'}
          onSelect={() => handleChange('self-hosted')}
          icon={<Cog className="h-4 w-4" aria-hidden />}
          eyebrow="Mainnet ready"
          title="Self-hosted Docker"
          description="Run the relayer yourself with a generated config. Required for mainnet."
        />
      </div>

      {localMode === 'managed' ? (
        <CreateManagedTestnetRelayer />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert variant="info">
            Pick source and destination chains, fund the relayer address, then copy the generated commands. Mainnet uses
            the same config with different network endpoints.
          </Alert>
          <ICMRelayer />
        </div>
      )}
    </section>
  );
}
