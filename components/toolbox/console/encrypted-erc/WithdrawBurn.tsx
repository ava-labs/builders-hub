'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
import { useEERCWithdraw } from '@/hooks/eerc/useEERCWithdraw';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import type { ERC20Meta } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Withdraw from Encrypted ERC',
  description: (
    <>
      Unwrap your encrypted balance back to the underlying ERC20. The withdrawal amount becomes public (it leaves the
      encrypted system), but your remaining balance stays private.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

function WithdrawBurn() {
  const converter = useEERCDeployment('converter');
  const deployment = converter.deployment;
  const supportedTokens = deployment?.supportedTokens ?? [];
  const [token, setToken] = useState<ERC20Meta | undefined>(supportedTokens[0]);

  React.useEffect(() => {
    if (!token && supportedTokens[0]) setToken(supportedTokens[0]);
  }, [token, supportedTokens]);

  const balance = useEERCBalance(deployment, 'converter', token);
  const aud = useEERCAuditorAndTokenId(deployment, token?.address);
  const wd = useEERCWithdraw(deployment);

  const [amountText, setAmountText] = useState('');

  if (!deployment) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No converter deployment on this chain.</p>
        <p className="text-muted-foreground">
          Withdraw only applies to converter mode (unwrapping an ERC20). Standalone mode uses Burn (not yet implemented
          in this console).
        </p>
      </div>
    );
  }

  let amountCents: bigint | null = null;
  let parseError: string | null = null;
  if (amountText) {
    const n = Number(amountText);
    if (!Number.isFinite(n) || n <= 0) parseError = 'Amount must be positive';
    else amountCents = BigInt(Math.round(n * 100));
  }

  const encBalance = balance.raw
    ? ([balance.raw.eGCT.c1[0], balance.raw.eGCT.c1[1], balance.raw.eGCT.c2[0], balance.raw.eGCT.c2[1]] as [
        bigint,
        bigint,
        bigint,
        bigint,
      ])
    : null;

  const canSubmit =
    amountCents !== null &&
    amountCents > 0n &&
    balance.decryptedCents !== null &&
    amountCents <= balance.decryptedCents &&
    aud.isAuditorSet &&
    aud.tokenId !== null &&
    encBalance !== null;

  const busy = wd.status === 'proving' || wd.status === 'submitting' || wd.status === 'confirming';

  return (
    <div className="space-y-6">
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

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Your encrypted balance</span>
          <span className="font-mono">
            {balance.formatted ?? '—'} e{token?.symbol ?? ''}
          </span>
        </div>

        {!aud.isAuditorSet && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            The auditor public key is not set on this deployment — withdrawals will revert. Visit{' '}
            <Link href="/console/encrypted-erc/deploy/auditor" className="underline">
              Set Auditor
            </Link>{' '}
            first.
          </div>
        )}

        <Input
          label="Amount to withdraw"
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

        {wd.error && <div className="text-xs text-red-600 dark:text-red-400">{wd.error}</div>}
        {wd.status === 'success' && wd.txHash && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-700 dark:text-green-300">
            Withdrawal confirmed.{' '}
            <a
              href={`https://testnet.snowtrace.io/tx/${wd.txHash}`}
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
            wd.withdraw({
              amountCents,
              encryptedBalance: encBalance,
              decryptedBalance: balance.decryptedCents,
              auditorPublicKey: aud.auditorPublicKey,
              tokenId: aud.tokenId,
            }).catch(() => {
              /* surfaced via wd.error */
            });
          }}
        >
          {wd.status === 'proving'
            ? 'Generating proof (5-10s)...'
            : wd.status === 'submitting'
              ? 'Submitting tx...'
              : wd.status === 'confirming'
                ? 'Confirming...'
                : 'Withdraw'}
        </Button>
      </div>
    </div>
  );
}

export default withConsoleToolMetadata(WithdrawBurn, metadata);
