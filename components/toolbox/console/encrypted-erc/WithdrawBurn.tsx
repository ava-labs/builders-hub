'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
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
import { useEERCWithdraw } from '@/hooks/eerc/useEERCWithdraw';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { parseEERCAmount } from '@/lib/eerc/parseAmount';
import { EERCToolShell } from './shared/EERCToolShell';
import { EERCTxLink } from './shared/EERCTxLink';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
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
  const tokenKey = supportedTokens.map((t) => t.address.toLowerCase()).join(',');
  const [token, setToken] = useState<ERC20Meta | undefined>(supportedTokens[0]);

  React.useEffect(() => {
    const firstToken = supportedTokens[0];
    if (!firstToken) {
      if (token !== undefined) setToken(undefined);
      return;
    }
    const tokenStillSupported =
      token !== undefined && supportedTokens.some((t) => t.address.toLowerCase() === token.address.toLowerCase());
    if (!tokenStillSupported) setToken(firstToken);
  }, [token, supportedTokens, tokenKey]);

  const balance = useEERCBalance(deployment, 'converter', token);
  const aud = useEERCAuditorAndTokenId(deployment, token?.address);
  // Reload encrypted balance + auditor state once the withdraw confirms so
  // the UI doesn't keep showing the pre-withdraw ciphertext.
  const refreshBalance = balance.refresh;
  const refreshAud = aud.refresh;
  const onWithdrawConfirmed = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshAud()]);
  }, [refreshBalance, refreshAud]);
  const wd = useEERCWithdraw(deployment, { onConfirmed: onWithdrawConfirmed });

  const [amountText, setAmountText] = useState('');

  if (!deployment) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No converter deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Withdraw only applies to converter mode. Switch to Avalanche Fuji to use the canonical converter.
        </p>
      </div>
    );
  }

  // String-based parsing avoids the IEEE-754 precision loss that
  // `Number(amountText) * 100` would introduce past ~15 significant digits.
  let amountCents: bigint | null = null;
  let parseError: string | null = null;
  if (amountText) {
    amountCents = parseEERCAmount(amountText);
    if (amountCents === null) parseError = 'Amount must be positive';
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
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      footerLinks={[
        {
          label: 'withdraw() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Encrypted balance</div>
        <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
          {balance.formatted ?? '—'}{' '}
          <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">e{token?.symbol ?? ''}</span>
        </div>
      </div>

      {balance.error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-xs text-red-700 dark:text-red-400">
          {balance.error}
          {balance.validationError && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/register" className="underline font-medium">
                Open Register
              </Link>
              .
            </>
          )}
        </div>
      )}

      {!aud.isAuditorSet && !aud.isLoading && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          Auditor public key not set — withdrawals will revert. Visit{' '}
          <Link href="/console/encrypted-erc/deploy/auditor" className="underline font-medium">
            Set Auditor
          </Link>{' '}
          first.
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <Input
          label={`Amount to withdraw (e${token?.symbol ?? ''})`}
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
        {wd.error && <div className="text-[11px] text-red-600 dark:text-red-400">{wd.error}</div>}
        {wd.status === 'success' && wd.txHash && (
          <div className="text-[11px]">
            <EERCTxLink chainId={converter.chainId} txHash={wd.txHash}>
              Withdrawn — {wd.txHash.slice(0, 10)}...
            </EERCTxLink>
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
            ? 'Generating proof (5–10s)...'
            : wd.status === 'submitting'
              ? 'Submitting tx...'
              : wd.status === 'confirming'
                ? 'Confirming...'
                : 'Withdraw'}
        </Button>
      </div>
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(WithdrawBurn, metadata);
