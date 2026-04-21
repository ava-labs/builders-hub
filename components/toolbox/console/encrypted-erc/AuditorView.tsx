'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { BookOpen, Download, RefreshCw } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useAuditorEvents } from '@/hooks/eerc/useAuditorEvents';
import { EERCToolShell } from './shared/EERCToolShell';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { EERCDeployment } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Auditor View',
  description: (
    <>
      Paste the auditor&apos;s BabyJubJub private key to decrypt every mint, transfer, withdrawal, and burn on the
      deployment. This is the compliance surface that distinguishes eERC from a purely-private token.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

function AuditorView() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const options: { mode: Mode; deployment: EERCDeployment }[] = [];
  if (standalone.isReady && standalone.deployment)
    options.push({ mode: 'standalone', deployment: standalone.deployment });
  if (converter.isReady && converter.deployment) options.push({ mode: 'converter', deployment: converter.deployment });

  const [selected, setSelected] = useState<number>(0);
  const active = options[selected];

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Encrypted ERC deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">Switch to Avalanche Fuji or deploy your own.</p>
      </div>
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
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      {options.length > 1 && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 w-fit">
          {options.map((o, i) => (
            <button
              key={o.deployment.encryptedERC}
              type="button"
              onClick={() => setSelected(i)}
              className={
                selected === i
                  ? 'px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }
            >
              {o.mode === 'standalone' ? 'Standalone' : 'Converter'}
            </button>
          ))}
        </div>
      )}
      {active && <AuditorPanel deployment={active.deployment} />}
    </EERCToolShell>
  );
}

function AuditorPanel({ deployment }: { deployment: EERCDeployment }) {
  const { address } = useAccount();
  const ev = useAuditorEvents(deployment);
  const [keyInput, setKeyInput] = useState('');

  const isAuditorWallet =
    address && ev.auditorAddressOnChain && address.toLowerCase() === ev.auditorAddressOnChain.toLowerCase();

  return (
    <>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">On-chain auditor</div>
          <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
            {ev.auditorAddressOnChain ?? '—'}
          </code>
        </div>
        {isAuditorWallet && ev.decryptionKey && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
            ✓ Your wallet is the auditor — local key auto-loaded.
          </div>
        )}
      </div>

      {!ev.decryptionKey && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Auditor BabyJubJub private key (hex, no 0x)
          </div>
          <textarea
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value.trim())}
            placeholder="paste auditor sk"
            rows={2}
            className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 font-mono text-[11px]"
          />
          <Button size="sm" variant="primary" onClick={() => ev.setDecryptionKey(keyInput)} disabled={!keyInput}>
            Load key
          </Button>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            On the canonical Fuji demo, the key lives with whoever ran the deploy script — get it from them or appoint
            yourself as the new auditor via <em>Set Auditor</em>.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Transactions ({ev.entries.length})</h3>
          {ev.isLoading && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 animate-pulse">scanning…</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {ev.entries.length > 0 && ev.decryptionKey && <CsvExportButton entries={ev.entries} />}
          <button
            type="button"
            onClick={() => ev.refresh()}
            disabled={ev.isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${ev.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {ev.error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-[11px] text-red-700 dark:text-red-400 break-words">
          {ev.error}
        </div>
      )}

      {ev.entries.length === 0 && !ev.isLoading ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">
          No encrypted transactions on this deployment yet.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Block</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Kind</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">From</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">To</th>
                <th className="text-right px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Amount</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500 dark:text-zinc-400">Tx</th>
              </tr>
            </thead>
            <tbody>
              {ev.entries.map((e) => (
                <tr key={e.txHash + e.kind} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">{e.blockNumber.toString()}</td>
                  <td className="px-3 py-2">
                    <KindBadge kind={e.kind} />
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400">
                    {e.from ? `${e.from.slice(0, 10)}…` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-500 dark:text-zinc-400">
                    {e.to ? `${e.to.slice(0, 10)}…` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-right text-zinc-700 dark:text-zinc-300">
                    {e.amountFormatted ?? (ev.decryptionKey ? <span className="text-zinc-400">wrong key</span> : '—')}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`https://testnet.snowtrace.io/tx/${e.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline font-mono"
                    >
                      {e.txHash.slice(0, 10)}…
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const style =
    kind === 'PrivateTransfer'
      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      : kind === 'PrivateMint'
        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${style}`}>
      {kind.replace('Private', '')}
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
    <button
      type="button"
      onClick={onExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      <Download className="w-3 h-3" />
      CSV
    </button>
  );
}

export default withConsoleToolMetadata(AuditorView, metadata);
