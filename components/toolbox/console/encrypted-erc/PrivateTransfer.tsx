'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isAddress } from 'viem';
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
  const availableModes: Mode[] = [];
  if (standalone.isReady) availableModes.push('standalone');
  if (converter.isReady) availableModes.push('converter');

  const [mode, setMode] = useState<Mode | null>(availableModes[0] ?? null);
  const deployment = mode === 'standalone' ? standalone.deployment : converter.deployment;
  const supportedTokens = deployment?.supportedTokens ?? [];
  const [token, setToken] = useState<ERC20Meta | undefined>(supportedTokens[0]);

  React.useEffect(() => {
    if (mode === 'converter' && !token && supportedTokens[0]) setToken(supportedTokens[0]);
  }, [mode, token, supportedTokens]);

  const balance = useEERCBalance(deployment, mode ?? 'standalone', token);
  const aud = useEERCAuditorAndTokenId(deployment, mode === 'converter' ? token?.address : undefined);
  const tr = useEERCTransfer(deployment);

  const [recipient, setRecipient] = useState('');
  const [amountText, setAmountText] = useState('');

  if (availableModes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No Encrypted ERC deployment on this chain.</p>
        <p className="text-muted-foreground">Switch to Avalanche Fuji or deploy your own.</p>
      </div>
    );
  }

  // Parse amount as cents (eERC decimals = 2).
  let amountCents: bigint | null = null;
  let parseError: string | null = null;
  if (amountText) {
    const n = Number(amountText);
    if (!Number.isFinite(n) || n <= 0) {
      parseError = 'Amount must be positive';
    } else {
      amountCents = BigInt(Math.round(n * 100));
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {availableModes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              mode === m
                ? 'px-3 py-1.5 text-sm rounded-md bg-foreground text-background'
                : 'px-3 py-1.5 text-sm rounded-md border hover:bg-accent'
            }
          >
            {m === 'standalone' ? 'Standalone (PRIV)' : 'Converter'}
          </button>
        ))}
      </div>

      {mode === 'converter' && supportedTokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Token:</span>
          {supportedTokens.map((t) => (
            <button
              key={t.address}
              onClick={() => setToken(t)}
              className={
                token?.address === t.address
                  ? 'px-3 py-1 text-xs rounded-full bg-foreground text-background'
                  : 'px-3 py-1 text-xs rounded-full border hover:bg-accent'
              }
            >
              {t.symbol}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your encrypted balance</span>
          <span className="font-mono">
            {balance.formatted ?? '—'} {mode === 'standalone' ? 'PRIV' : `e${token?.symbol ?? ''}`}
          </span>
        </div>

        {!aud.isAuditorSet && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            The auditor public key is not set on this deployment — transfers will revert. Visit{' '}
            <Link href="/console/encrypted-erc/deploy/auditor" className="underline">
              Set Auditor
            </Link>{' '}
            first (owner-only).
          </div>
        )}

        <Input label="Recipient EVM address" value={recipient} onChange={setRecipient} placeholder="0x..." />
        {recipient && !recipientValid && (
          <div className="text-xs text-red-600 dark:text-red-400">Invalid EVM address</div>
        )}

        <Input
          label="Amount"
          value={amountText}
          onChange={setAmountText}
          placeholder="0.00"
          type="number"
          step="0.01"
        />
        {parseError && <div className="text-xs text-red-600 dark:text-red-400">{parseError}</div>}
        {amountCents !== null && balance.decryptedCents !== null && amountCents > balance.decryptedCents && (
          <div className="text-xs text-red-600 dark:text-red-400">
            Exceeds your balance ({Scalar.parseEERCBalance(balance.decryptedCents)}).
          </div>
        )}

        {tr.error && <div className="text-xs text-red-600 dark:text-red-400">{tr.error}</div>}
        {tr.status === 'success' && tr.txHash && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-700 dark:text-green-300">
            Transfer confirmed.{' '}
            <a
              href={`https://testnet.snowtrace.io/tx/${tr.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Snowtrace
            </a>
          </div>
        )}

        <Button
          variant="primary"
          loading={busy}
          disabled={!canSubmit}
          onClick={() => {
            if (
              !canSubmit ||
              encBalance === null ||
              amountCents === null ||
              balance.decryptedCents === null ||
              aud.auditorPublicKey === null ||
              aud.tokenId === null
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
              ? 'Generating proof (this takes 5-20s)...'
              : tr.status === 'submitting'
                ? 'Submitting tx...'
                : tr.status === 'confirming'
                  ? 'Confirming...'
                  : 'Send privately'}
        </Button>
      </div>

      <Educational />
    </div>
  );
}

function Educational() {
  return (
    <details className="rounded-lg border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium">What happens during a private transfer?</summary>
      <div className="space-y-2 pt-3 text-muted-foreground">
        <p>
          A private transfer is the operation where eERC's privacy model pays off. We encrypt the amount three times —
          once to the sender's pubkey, once to the recipient's, once to the auditor's — and then prove in zero knowledge
          that sender balance &gt;= amount, all three encryptions are consistent, and the sender's new balance is
          correctly derived.
        </p>
        <p>
          The proof uses the TRANSFER circuit (ptau 15, ~900 KB wasm, ~36 MB zkey). Proof generation is CPU-heavy —
          expect 5-20 seconds depending on device. It runs entirely in your browser; no server ever sees the amount or
          your BJJ private key.
        </p>
        <p>
          On-chain, only the auditor can later decrypt (sender, recipient, amount) tuples by reading the auditor PCT
          attached to each <code className="text-xs bg-muted px-1 rounded">PrivateTransfer</code> event.
        </p>
      </div>
    </details>
  );
}

export default withConsoleToolMetadata(PrivateTransfer, metadata);
