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
import { Alert } from '@/components/toolbox/components/Alert';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { useEERCWithdraw } from '@/hooks/eerc/useEERCWithdraw';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { parseEERCAmount } from '@/lib/eerc/parseAmount';
import {
  EERC_BALANCE_PROOF_MISMATCH_MESSAGE,
  EERC_BALANCE_UNINITIALIZED_MESSAGE,
  EERC_PRIVATE_KEY_INVALID_MESSAGE,
} from '@/lib/eerc/balanceValidation';
import { EERCToolShell } from './shared/EERCToolShell';
import { EERCTxLink } from './shared/EERCTxLink';
import { EmptyBoard, HairlineGrid, INLINE_LINK, ProgressList, Reading, progressFrom } from './shared/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { ERC20Meta } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Withdraw from Encrypted ERC',
  description: (
    <>
      Turn your encrypted balance back into the underlying ERC20. The amount you withdraw becomes public; what&apos;s
      left stays private.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

const WITHDRAW_PHASES = [
  { key: 'proving', label: 'Generate the withdrawal proof (5–10s)' },
  { key: 'submitting', label: 'Submit the transaction' },
  { key: 'confirming', label: 'Wait for confirmation' },
] as const;

const LOADING_TEXT: Partial<Record<ReturnType<typeof useEERCWithdraw>['status'], string>> = {
  proving: 'Generating proof…',
  submitting: 'Submitting…',
  confirming: 'Confirming…',
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
      <EmptyBoard eyebrow="No converter deployment on this chain">
        Withdraw only applies to converter mode. Switch to Avalanche Fuji to use the demo converter.
      </EmptyBoard>
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
  const exceedsBalance =
    amountCents !== null && balance.decryptedCents !== null && amountCents > balance.decryptedCents;

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
  const symbol = `e${token?.symbol ?? ''}`;

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      footerLinks={[
        {
          label: 'withdraw() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
          icon: <BookOpen />,
        },
      ]}
    >
      <HairlineGrid cols={2}>
        <Reading
          label="Encrypted balance"
          value={balance.formatted ?? '—'}
          unit={symbol}
          loading={balance.isLoading && balance.formatted === null}
          sub="Private until withdrawn"
        />
        <Reading
          label="Becomes public"
          value={amountCents !== null && amountCents > 0n ? Scalar.parseEERCBalance(amountCents) : '—'}
          unit={symbol}
          sub={`Returned as ${token?.symbol ?? 'the ERC20'}`}
        />
      </HairlineGrid>

      {balance.error && (
        <Alert variant="error">
          {balance.error}
          {balance.validationError && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
                Open Register
              </Link>
              .
            </>
          )}
        </Alert>
      )}

      {!aud.isAuditorSet && !aud.isLoading && (
        <Alert variant="warning">
          The auditor public key isn&apos;t set, so withdrawals will revert. Open{' '}
          <Link href="/console/encrypted-erc/deploy/auditor" className={INLINE_LINK}>
            Set Auditor
          </Link>{' '}
          first.
        </Alert>
      )}

      <div className="[&>div]:mb-0">
        <Input
          label="Amount to withdraw"
          value={amountText}
          onChange={setAmountText}
          placeholder="0.00"
          type="number"
          step="0.01"
          unit={symbol}
          className="font-mono"
          error={
            parseError ??
            (exceedsBalance && balance.decryptedCents !== null
              ? `Exceeds balance (${Scalar.parseEERCBalance(balance.decryptedCents)}).`
              : null)
          }
        />
      </div>

      {(busy || wd.status === 'success') && (
        <ProgressList steps={progressFrom(WITHDRAW_PHASES, wd.status, wd.status === 'success')} />
      )}

      {wd.error && (
        <Alert variant="error">
          {wd.error}
          {(wd.error === EERC_BALANCE_PROOF_MISMATCH_MESSAGE || wd.error === EERC_PRIVATE_KEY_INVALID_MESSAGE) && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
                Open Register
              </Link>
              .
            </>
          )}
          {wd.error === EERC_BALANCE_UNINITIALIZED_MESSAGE && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/deposit" className={INLINE_LINK}>
                Open Deposit
              </Link>
              .
            </>
          )}
        </Alert>
      )}
      {wd.status === 'success' && wd.txHash && (
        <Alert variant="success">
          Withdrawn.{' '}
          <EERCTxLink chainId={converter.chainId} txHash={wd.txHash}>
            {wd.txHash.slice(0, 10)}…
          </EERCTxLink>
        </Alert>
      )}

      <Button
        variant="primary"
        loading={busy}
        loadingText={LOADING_TEXT[wd.status]}
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
        Withdraw
      </Button>
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(WithdrawBurn, metadata);
