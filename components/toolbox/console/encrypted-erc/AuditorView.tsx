'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useAuditorEvents } from '@/hooks/eerc/useAuditorEvents';
import type { EERCDeployment } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Auditor View',
  description: (
    <>
      Paste the auditor's BabyJubJub private key to decrypt every mint, transfer, withdrawal, and burn on the
      deployment. This is the compliance surface that distinguishes eERC from a purely-private token — one designated
      key can see everything.
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
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No Encrypted ERC deployment on this chain.</p>
        <p className="text-muted-foreground">
          The auditor view reads from a deployment — switch to Fuji or deploy your own.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {options.map((o, i) => (
          <button
            key={o.deployment.encryptedERC}
            onClick={() => setSelected(i)}
            className={
              selected === i
                ? 'px-3 py-1.5 text-sm rounded-md bg-foreground text-background'
                : 'px-3 py-1.5 text-sm rounded-md border hover:bg-accent'
            }
          >
            {o.mode === 'standalone' ? 'Standalone' : 'Converter'}
          </button>
        ))}
      </div>
      {active && <AuditorPanel deployment={active.deployment} />}
    </div>
  );
}

function AuditorPanel({ deployment }: { deployment: EERCDeployment }) {
  const { address } = useAccount();
  const ev = useAuditorEvents(deployment);
  const [keyInput, setKeyInput] = useState('');

  const isAuditorWallet =
    address && ev.auditorAddressOnChain && address.toLowerCase() === ev.auditorAddressOnChain.toLowerCase();

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-card p-4 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground uppercase tracking-wide text-[10px]">On-chain auditor</span>
          <code className="font-mono">{ev.auditorAddressOnChain ?? '—'}</code>
        </div>
        {isAuditorWallet && ev.decryptionKey && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 text-green-700 dark:text-green-400">
            You are the auditor — your cached BabyJubJub key has been loaded automatically.
          </div>
        )}
        {!ev.decryptionKey && (
          <div className="space-y-2 pt-1">
            <label className="text-muted-foreground uppercase tracking-wide text-[10px]">
              Auditor BabyJubJub private key (hex, no 0x)
            </label>
            <textarea
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.trim())}
              placeholder="paste auditor sk"
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
            />
            <Button size="sm" variant="primary" onClick={() => ev.setDecryptionKey(keyInput)} disabled={!keyInput}>
              Load key
            </Button>
            <p className="text-muted-foreground">
              On the canonical Fuji demo, the key lives with whoever ran the deploy script — get it from them or appoint
              yourself as the new auditor via the <em>Set Auditor</em> tool.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Transactions ({ev.entries.length})
          {ev.isLoading && <span className="ml-2 text-xs text-muted-foreground animate-pulse">loading...</span>}
        </h3>
        <Button size="sm" variant="secondary" onClick={() => ev.refresh()}>
          Refresh
        </Button>
      </div>

      {ev.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          {ev.error}
        </div>
      )}

      {ev.entries.length === 0 && !ev.isLoading && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground text-center">
          No encrypted transactions on this deployment yet.
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Block</th>
              <th className="text-left px-3 py-2 font-medium">Kind</th>
              <th className="text-left px-3 py-2 font-medium">From</th>
              <th className="text-left px-3 py-2 font-medium">To</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
              <th className="text-left px-3 py-2 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody>
            {ev.entries.map((e) => (
              <tr key={e.txHash + e.kind} className="border-t">
                <td className="px-3 py-2 font-mono">{e.blockNumber.toString()}</td>
                <td className="px-3 py-2">
                  <KindBadge kind={e.kind} />
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {e.from ? `${e.from.slice(0, 10)}...` : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{e.to ? `${e.to.slice(0, 10)}...` : '—'}</td>
                <td className="px-3 py-2 font-mono text-right">
                  {e.amountFormatted ?? (ev.decryptionKey ? 'wrong key' : '—')}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://testnet.snowtrace.io/tx/${e.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground underline"
                  >
                    {e.txHash.slice(0, 10)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ev.entries.length > 0 && ev.decryptionKey && <CSVExport entries={ev.entries} />}

      <Educational />
    </div>
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

function CSVExport({ entries }: { entries: ReturnType<typeof useAuditorEvents>['entries'] }) {
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
    <Button variant="secondary" size="sm" onClick={onExport}>
      Export CSV
    </Button>
  );
}

function Educational() {
  return (
    <details className="rounded-lg border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium">How does auditor decryption work?</summary>
      <div className="space-y-2 pt-3 text-muted-foreground">
        <p>
          Every private mint, transfer, withdrawal, and burn emits an event with a 7-element
          <code className="text-xs bg-muted px-1 rounded mx-1">auditorPCT</code> — a Poseidon ciphertext of the amount
          encrypted under the auditor's BabyJubJub public key. Only the holder of the matching private key can decrypt
          it.
        </p>
        <p>
          This creates a strict compliance surface: users retain full privacy from each other and the contract owner,
          but the auditor can reconstruct (sender, recipient, amount) for any transaction. Rotating the auditor changes
          the pubkey used for future PCTs — pre-rotation transactions remain decryptable only by the old auditor.
        </p>
        <p>
          The "wrong key" rows in the table above are entries whose PCT was encrypted to a different auditor pubkey than
          the one you supplied. Either your key is wrong, or the auditor has been rotated since those events were
          recorded.
        </p>
      </div>
    </details>
  );
}

export default withConsoleToolMetadata(AuditorView, metadata);
