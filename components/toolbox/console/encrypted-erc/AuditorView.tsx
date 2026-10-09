'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { BookOpen, Check, Download, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useAuditorEvents } from '@/hooks/eerc/useAuditorEvents';
import { EERCToolShell } from './shared/EERCToolShell';
import { EERCTxLink } from './shared/EERCTxLink';
import { Choice, ChoiceGroup, EYEBROW, EmptyBoard, FRAME, GHOST_ACTION, Panel } from './shared/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { EERCDeployment } from '@/lib/eerc/types';
import { cn } from '@/lib/utils';

const metadata: ConsoleToolMetadata = {
  title: 'Auditor View',
  description: (
    <>
      Paste the auditor&apos;s BabyJubJub private key to decrypt every mint, transfer, withdrawal, and burn on the
      deployment. This compliance view is what sets Encrypted ERC apart from a fully private token.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

const COLS = 'grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_minmax(0,1fr)_5.5rem_6rem]';
const CELL_MUTED = 'truncate font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400';

function AuditorView() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const options: { mode: Mode; deployment: EERCDeployment; chainId: number }[] = [];
  if (standalone.isReady && standalone.deployment)
    options.push({ mode: 'standalone', deployment: standalone.deployment, chainId: standalone.chainId });
  if (converter.isReady && converter.deployment)
    options.push({ mode: 'converter', deployment: converter.deployment, chainId: converter.chainId });

  const [selected, setSelected] = useState<number>(0);
  const active = options[selected];

  if (options.length === 0) {
    return (
      <EmptyBoard
        eyebrow="No deployment on this chain"
        action={{ href: '/console/encrypted-erc/deploy', label: 'Deploy your own' }}
      >
        There&apos;s no Encrypted ERC deployment on this chain. Switch to Avalanche Fuji or deploy your own.
      </EmptyBoard>
    );
  }

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      height={720}
      footerLinks={[
        {
          label: 'events source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
          icon: <BookOpen />,
        },
      ]}
    >
      {options.length > 1 && (
        <ChoiceGroup label="Deployment">
          {options.map((o, i) => (
            <Choice
              key={o.deployment.encryptedERC}
              selected={selected === i}
              onSelect={() => setSelected(i)}
              title={o.mode === 'standalone' ? 'Standalone' : 'Converter'}
              hint={`${o.deployment.encryptedERC.slice(0, 6)}…${o.deployment.encryptedERC.slice(-4)}`}
            />
          ))}
        </ChoiceGroup>
      )}
      {active && <AuditorPanel deployment={active.deployment} chainId={active.chainId} />}
    </EERCToolShell>
  );
}

function AuditorPanel({ deployment, chainId }: { deployment: EERCDeployment; chainId: number }) {
  const { address } = useAccount();
  const ev = useAuditorEvents(deployment);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  const isAuditorWallet =
    address && ev.auditorAddressOnChain && address.toLowerCase() === ev.auditorAddressOnChain.toLowerCase();

  return (
    <>
      <div className={FRAME}>
        <SpecPlate className="px-4">
          <SpecRow label="On-chain auditor">
            {ev.auditorAddressOnChain ? (
              <HashChip value={ev.auditorAddressOnChain} len={12} />
            ) : (
              <span className="font-mono text-zinc-400">—</span>
            )}
          </SpecRow>
          {isAuditorWallet && ev.decryptionKey && (
            <SpecRow label="Key">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Your wallet is the auditor. Its local key loaded automatically.
              </span>
            </SpecRow>
          )}
        </SpecPlate>
      </div>

      {!ev.decryptionKey && (
        <Panel
          label="Auditor key"
          action={
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          }
          bodyClassName="flex flex-col gap-3"
        >
          <label htmlFor="eerc-auditor-key" className={EYEBROW}>
            BabyJubJub private key (hex, no 0x)
          </label>
          <input
            id="eerc-auditor-key"
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.trim())}
            placeholder="Paste the auditor key"
            spellCheck={false}
            autoComplete="off"
            className="h-10 w-full border border-zinc-200 bg-white px-3 font-mono text-[12px] text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:hover:border-zinc-600 dark:focus:border-zinc-300"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              On the Fuji demo, whoever ran the deploy script holds this key. Ask them for it, or make yourself the
              auditor with <em>Set Auditor</em>.
            </p>
            <Button
              size="sm"
              variant="primary"
              stickLeft
              onClick={() => ev.setDecryptionKey(keyInput)}
              disabled={!keyInput}
            >
              Load key
            </Button>
          </div>
        </Panel>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2">
            <span className={EYEBROW}>Transactions</span>
            <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {ev.entries.length}
            </span>
            {ev.isLoading && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scanning events
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {ev.entries.length > 0 && ev.decryptionKey && <CsvExportButton entries={ev.entries} />}
            <button type="button" onClick={() => ev.refresh()} disabled={ev.isLoading} className={GHOST_ACTION}>
              <RefreshCw className={`h-3 w-3 ${ev.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {ev.error && <Alert variant="error">{ev.error}</Alert>}

        {ev.entries.length === 0 && !ev.isLoading ? (
          <EmptyBoard eyebrow="No transactions yet">This deployment has no encrypted transactions yet.</EmptyBoard>
        ) : (
          <div className={cn(FRAME, 'overflow-x-auto')}>
            <div className="min-w-[620px]">
              <div
                className={cn(
                  'grid gap-3 border-b border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500',
                  COLS,
                )}
              >
                <span>Block</span>
                <span>Kind</span>
                <span>From</span>
                <span>To</span>
                <span className="text-right">Amount</span>
                <span>Tx</span>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {ev.entries.length === 0
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={cn('grid h-11 items-center gap-3 px-4', COLS)}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <span key={j} className="h-3 w-full max-w-20 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                        ))}
                      </div>
                    ))
                  : ev.entries.map((e) => (
                      <div key={e.txHash + e.kind} className={cn('grid h-11 items-center gap-3 px-4', COLS)}>
                        <span className="font-mono text-[12px] tabular-nums text-zinc-700 dark:text-zinc-300">
                          {e.blockNumber.toString()}
                        </span>
                        <KindBadge kind={e.kind} />
                        <span className={CELL_MUTED} title={e.from ?? undefined}>
                          {e.from ? `${e.from.slice(0, 10)}…` : '—'}
                        </span>
                        <span className={CELL_MUTED} title={e.to ?? undefined}>
                          {e.to ? `${e.to.slice(0, 10)}…` : '—'}
                        </span>
                        <span className="truncate text-right font-mono text-[12.5px] tabular-nums text-zinc-900 dark:text-zinc-50">
                          {e.amountFormatted ??
                            (ev.decryptionKey ? (
                              <span className="text-zinc-400 dark:text-zinc-500">wrong key</span>
                            ) : (
                              <span className="select-none tracking-[0.2em] text-zinc-300 dark:text-zinc-700">
                                ••••
                              </span>
                            ))}
                        </span>
                        <EERCTxLink
                          chainId={chainId}
                          txHash={e.txHash}
                          className="truncate font-mono text-[12px] text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 hover:decoration-[#E6212F] dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-50"
                        >
                          {e.txHash.slice(0, 10)}…
                        </EERCTxLink>
                      </div>
                    ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const KIND_TONE: Record<string, string> = {
  PrivateTransfer: 'text-[#0052bd] dark:text-[#5f9dff]',
  PrivateMint: 'text-[#3f7d43] dark:text-[#77c47b]',
  PrivateBurn: 'text-[#9c7112] dark:text-[#e2b953]',
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-600 dark:text-zinc-300">
      <span aria-hidden className={cn('size-1 shrink-0 bg-current', KIND_TONE[kind] ?? 'text-zinc-500')} />
      <span className="truncate">{kind.replace('Private', '')}</span>
    </span>
  );
}

function CsvExportButton({ entries }: { entries: ReturnType<typeof useAuditorEvents>['entries'] }) {
  const onExport = () => {
    const header = 'block,kind,from,to,amount_cents,tx_hash\n';
    const rows = entries
      .map((e) =>
        [e.blockNumber.toString(), e.kind, e.from ?? '', e.to ?? '', e.amount?.toString() ?? '', e.txHash].join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eerc-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={onExport} className={GHOST_ACTION}>
      <Download className="h-3 w-3" />
      CSV
    </button>
  );
}

export default withConsoleToolMetadata(AuditorView, metadata);
