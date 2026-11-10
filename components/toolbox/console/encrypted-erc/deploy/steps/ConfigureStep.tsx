'use client';

import React from 'react';
import { Coins, Shuffle } from 'lucide-react';
import { Input } from '@/components/toolbox/components/Input';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import { HairlineGrid } from '../../shared/ui';
import { BODY, Option, PaneSection, PANE_HEIGHT } from '../ui';

export default function ConfigureStep() {
  const { mode, name, symbol, decimals, setMode, setName, setSymbol, setDecimals } = useEERCDeployStore();

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      footerLinks={[
        {
          label: 'Protocol README',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/README.md`,
        },
      ]}
    >
      <p className={BODY}>
        Pick a mode and, for standalone, the token name and symbol. The protocol sets every other parameter.
      </p>

      <PaneSection label="Mode">
        <div role="radiogroup" aria-label="Mode">
          <HairlineGrid>
            <Option
              selected={mode === 'standalone'}
              onSelect={() => setMode('standalone')}
              icon={<Coins className="h-4 w-4" />}
              title="Standalone"
              description="A new private token. The owner mints to users with ZK proofs. No underlying ERC20."
            />
            <Option
              selected={mode === 'converter'}
              onSelect={() => setMode('converter')}
              icon={<Shuffle className="h-4 w-4" />}
              title="Converter"
              description="Wraps existing ERC20s. Users deposit to encrypt and withdraw to unwrap. One deployment can hold many tokens."
            />
          </HairlineGrid>
        </div>
      </PaneSection>

      <PaneSection label="Token">
        {mode === 'standalone' ? (
          <div>
            <Input label="Token name" value={name} onChange={setName} placeholder="Demo Private Token" />
            <Input label="Token symbol" value={symbol} onChange={setSymbol} placeholder="PRIV" />
          </div>
        ) : (
          <p className="mb-6 border border-dashed border-zinc-300 px-4 py-3 text-[13px] leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Converter mode takes no name or symbol: the contract rejects them at construction. Each wrapped ERC20 keeps
            its own metadata.
          </p>
        )}

        <Input
          label="Decimals (eERC internal)"
          value={String(decimals)}
          onChange={(v) => setDecimals(Number(v) || 2)}
          type="number"
          step="1"
          className="font-mono"
          helperText="Defaults to 2, the protocol standard. Fewer decimals allow larger amounts; more give finer units but more converter dust."
        />
      </PaneSection>
    </EERCToolShell>
  );
}
