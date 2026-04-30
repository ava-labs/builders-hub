'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isAddress } from 'viem';
import { BookOpen } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { useEERCTransfer } from '@/hooks/eerc/useEERCTransfer';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { EERCToolShell } from './shared/EERCToolShell';
import { EERCTxLink } from './shared/EERCTxLink';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { ERC20Meta, Hex } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Private Transfer',
  description: (
    <>
      Send encrypted tokens to another registered address. Amounts are ElGamal-encrypted to each recipient; a Groth16
      proof convinces the contract the sender had sufficient balance without revealing how much.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

function PrivateTransfer() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  // Order favours converter — see BalanceHistory.tsx for the rationale.
  const availableModes: Mode[] = [];
  if (converter.isReady) availableModes.push('converter');
  if (standalone.isReady) availableModes.push('standalone');
  const availableModesKey = availableModes.join(',');

  const [mode, setMode] = useState<Mode | null>(availableModes[0] ?? null);

  // Recover from the empty-on-first-render case (wallet chainId not yet
  // resolved) and keep `mode` aligned with currently-available deployments.
  // availableModesKey collapses the array into a stable string dep so
  // identity churn doesn't re-trigger this effect every render.
  React.useEffect(() => {
    if (availableModes.length === 0) return;
    if (mode === null || !availableModes.includes(mode)) {
      setMode(availableModes[0]);
    }
  }, [availableModesKey, mode]);

  const deployment = mode === 'standalone' ? standalone.deployment : converter.deployment;
  const supportedTokens = deployment?.supportedTokens ?? [];
  const tokenKey = supportedTokens.map((t) => t.address.toLowerCase()).join(',');
  const [token, setToken] = useState<ERC20Meta | undefined>(supportedTokens[0]);

  React.useEffect(() => {
    if (mode !== 'converter') return;
    const firstToken = supportedTokens[0];
    if (!firstToken) {
      if (token !== undefined) setToken(undefined);
      return;
    }
    const tokenStillSupported =
      token !== undefined && supportedTokens.some((t) => t.address.toLowerCase() === token.address.toLowerCase());
    if (!tokenStillSupported) setToken(firstToken);
  }, [mode, token, supportedTokens, tokenKey]);

  const balance = useEERCBalance(deployment, mode ?? 'converter', token);
  const aud = useEERCAuditorAndTokenId(deployment, mode === 'converter' ? token?.address : undefined);
  const tr = useEERCTransfer(deployment);
  const activeChainId = mode === 'standalone' ? standalone.chainId : converter.chainId;

  const [recipient, setRecipient] = useState('');
  const [amountText, setAmountText] = useState('');

  if (availableModes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Encrypted ERC deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">Switch to Avalanche Fuji or deploy your own.</p>
      </div>
    );
  }

  // Parse amount as cents (eERC decimals = 2).
  let amountCents: bigint | null = null;
  let parseError: string | null = null;
  if (amountText) {
    const n = Number(amountText);
    if (!Number.isFinite(n) || n <= 0) parseError = 'Amount must be positive';
    else amountCents = BigInt(Math.round(n * 100));
  }
  const recipientValid = recipient.length > 0 && isAddress(recipient);

  const encBalance = balance.raw
    ? ([balance.raw.eGCT.c1[0], balance.raw.eGCT.c1[1], balance.raw.eGCT.c2[0], balance.raw.eGCT.c2[1]] as [
        bigint,
        bigint,
        bigint,
        bigint,
      ])
    : null;

  const canSubmit =
    !!deployment &&
    recipientValid &&
    amountCents !== null &&
    amountCents > 0n &&
    balance.decryptedCents !== null &&
    amountCents <= balance.decryptedCents &&
    aud.isAuditorSet &&
    aud.tokenId !== null &&
    encBalance !== null;

  const busy =
    tr.status === 'lookup' || tr.status === 'proving' || tr.status === 'submitting' || tr.status === 'confirming';
  const symbol = mode === 'standalone' ? 'PRIV' : `e${token?.symbol ?? ''}`;

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      height={640}
      footerLinks={[
        {
          label: 'transfer() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      {availableModes.length > 1 && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 w-fit">
          {availableModes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? 'px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }
            >
              {m === 'standalone' ? 'Standalone' : 'Converter'}
            </button>
          ))}
        </div>
      )}

      {mode === 'converter' && supportedTokens.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Token:</span>
          {supportedTokens.map((t) => (
            <button
              key={t.address}
              type="button"
              onClick={() => setToken(t)}
              className={
                token?.address === t.address
                  ? 'px-3 py-1 text-xs rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'px-3 py-1 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }
            >
              {t.symbol}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your encrypted balance
        </div>
        <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
          {balance.formatted ?? '—'} <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">{symbol}</span>
        </div>
      </div>

      {!aud.isAuditorSet && !aud.isLoading && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Auditor public key not set — transfers will revert. Visit{' '}
          <Link href="/console/encrypted-erc/deploy/auditor" className="underline font-medium">
            Set Auditor
          </Link>{' '}
          first.
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <Input label="Recipient EVM address" value={recipient} onChange={setRecipient} placeholder="0x..." />
        {recipient && !recipientValid && (
          <div className="text-[11px] text-red-600 dark:text-red-400">Invalid EVM address</div>
        )}

        <Input
          label={`Amount (${symbol})`}
          value={amountText}
          onChange={setAmountText}
          placeholder="0.00"
          type="number"
          step="0.01"
        />
        {parseError && <div className="text-[11px] text-red-600 dark:text-red-400">{parseError}</div>}
        {amountCents !== null && balance.decryptedCents !== null && amountCents > balance.decryptedCents && (
          <div className="text-[11px] text-red-600 dark:text-red-400">
            Exceeds balance ({Scalar.parseEERCBalance(balance.decryptedCents)}).
          </div>
        )}

        {tr.error && <div className="text-[11px] text-red-600 dark:text-red-400">{tr.error}</div>}
        {tr.status === 'success' && tr.txHash && (
          <div className="text-[11px]">
            <EERCTxLink chainId={activeChainId} txHash={tr.txHash}>
              Transfer confirmed — {tr.txHash.slice(0, 10)}...
            </EERCTxLink>
          </div>
        )}

        <Button
          variant="primary"
          loading={busy}
          disabled={!canSubmit}
          onClick={() => {
            // `== null` (loose) catches BOTH null and undefined — the
            // strict `=== null` form leaked an undefined `tokenId` /
            // `auditorPublicKey` into transferPrivate, which then tried
            // to coerce them via BigInt() and threw "Cannot convert
            // undefined to a BigInt" with no useful surface in the UI.
            if (
              !canSubmit ||
              encBalance == null ||
              amountCents == null ||
              balance.decryptedCents == null ||
              aud.auditorPublicKey == null ||
              aud.tokenId == null
            )
              return;
            tr.transfer({
              to: recipient as Hex,
              amountCents,
              encryptedBalance: encBalance,
              decryptedBalance: balance.decryptedCents,
              auditorPublicKey: aud.auditorPublicKey,
              tokenId: aud.tokenId,
            }).catch(() => {
              /* surfaced via tr.error */
            });
          }}
        >
          {tr.status === 'lookup'
            ? 'Checking recipient...'
            : tr.status === 'proving'
              ? 'Generating proof (5–20s)...'
              : tr.status === 'submitting'
                ? 'Submitting tx...'
                : tr.status === 'confirming'
                  ? 'Confirming...'
                  : 'Send privately'}
        </Button>
      </div>

      <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
          What happens during a private transfer?
        </summary>
        <div className="space-y-2 pt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p>
            We encrypt the amount three times — to the sender, recipient, and auditor — and then prove in zero knowledge
            that sender balance ≥ amount, all three encryptions are consistent, and the sender&apos;s new balance is
            correctly derived.
          </p>
          <p>
            The proof uses the TRANSFER circuit (ptau 15, ~36 MB zkey). Proof generation is CPU-heavy — expect 5-20
            seconds depending on device. It runs entirely in your browser; no server ever sees the amount or your BJJ
            private key.
          </p>
        </div>
      </details>
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(PrivateTransfer, metadata);
