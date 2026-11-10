'use client';

import React, { useCallback, useState } from 'react';
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
import { Alert } from '@/components/toolbox/components/Alert';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { useEERCTransfer } from '@/hooks/eerc/useEERCTransfer';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { parseEERCAmount } from '@/lib/eerc/parseAmount';
import {
  EERC_BALANCE_PROOF_MISMATCH_MESSAGE,
  EERC_BALANCE_UNINITIALIZED_MESSAGE,
  EERC_PRIVATE_KEY_INVALID_MESSAGE,
} from '@/lib/eerc/balanceValidation';
import { EERCToolShell } from './shared/EERCToolShell';
import { EERCTxLink } from './shared/EERCTxLink';
import {
  Choice,
  ChoiceGroup,
  Disclosure,
  EmptyBoard,
  HairlineGrid,
  INLINE_LINK,
  ProgressList,
  Reading,
  progressFrom,
} from './shared/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { ERC20Meta, Hex } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Private Transfer',
  description: (
    <>
      Send encrypted tokens to another registered address. The amount is encrypted to the recipient, and a Groth16 proof
      shows you had enough balance without revealing how much.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

const TRANSFER_PHASES = [
  { key: 'lookup', label: 'Look up the recipient’s public key' },
  { key: 'proving', label: 'Generate the transfer proof (5–20s)' },
  { key: 'submitting', label: 'Submit the transaction' },
  { key: 'confirming', label: 'Wait for confirmation' },
] as const;

const LOADING_TEXT: Partial<Record<ReturnType<typeof useEERCTransfer>['status'], string>> = {
  lookup: 'Checking recipient…',
  proving: 'Generating proof…',
  submitting: 'Submitting…',
  confirming: 'Confirming…',
};

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
  // Reload encrypted balance + auditor state once the transfer confirms.
  // Both `refresh` callbacks are stable per their hook's useCallback deps,
  // so this onConfirmed is also stable across renders.
  const refreshBalance = balance.refresh;
  const refreshAud = aud.refresh;
  const onTransferConfirmed = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshAud()]);
  }, [refreshBalance, refreshAud]);
  const tr = useEERCTransfer(deployment, { onConfirmed: onTransferConfirmed });
  const activeChainId = mode === 'standalone' ? standalone.chainId : converter.chainId;

  const [recipient, setRecipient] = useState('');
  const [amountText, setAmountText] = useState('');

  if (availableModes.length === 0) {
    return (
      <EmptyBoard
        eyebrow="No deployment on this chain"
        action={{ href: '/console/encrypted-erc/deploy', label: 'Deploy your own' }}
      >
        There&apos;s no Encrypted ERC deployment on this chain. Switch to Avalanche Fuji or deploy your own.
      </EmptyBoard>
    );
  }

  // Parse amount as cents (eERC decimals = 2). String-based parsing
  // avoids the IEEE-754 precision loss that `Number(amountText) * 100`
  // would introduce past ~15 significant digits.
  let amountCents: bigint | null = null;
  let parseError: string | null = null;
  if (amountText) {
    amountCents = parseEERCAmount(amountText);
    if (amountCents === null) parseError = 'Amount must be positive';
  }
  const recipientValid = recipient.length > 0 && isAddress(recipient);
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
          icon: <BookOpen />,
        },
      ]}
    >
      {availableModes.length > 1 && (
        <ChoiceGroup label="Deployment">
          {availableModes.map((m) => (
            <Choice
              key={m}
              selected={mode === m}
              onSelect={() => setMode(m)}
              title={m === 'standalone' ? 'Standalone' : 'Converter'}
              hint={m === 'standalone' ? 'Native private token' : 'Wraps an ERC20'}
            />
          ))}
        </ChoiceGroup>
      )}

      {mode === 'converter' && supportedTokens.length > 1 && (
        <ChoiceGroup label="Token" cols={supportedTokens.length > 2 ? 3 : 2}>
          {supportedTokens.map((t) => (
            <Choice
              key={t.address}
              selected={token?.address === t.address}
              onSelect={() => setToken(t)}
              title={t.symbol}
              hint={`${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
            />
          ))}
        </ChoiceGroup>
      )}

      <HairlineGrid cols={2}>
        <Reading
          label="Your encrypted balance"
          value={balance.formatted ?? '—'}
          unit={symbol}
          loading={balance.isLoading && balance.formatted === null}
          sub="Decrypted in this browser"
        />
        <Reading
          label="Auditor"
          value={aud.isLoading ? '…' : aud.isAuditorSet ? 'Set' : 'Not set'}
          sub={aud.isAuditorSet ? 'Can read this amount' : 'Required to send'}
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
          The auditor public key isn&apos;t set, so transfers will revert. Open{' '}
          <Link href="/console/encrypted-erc/deploy/auditor" className={INLINE_LINK}>
            Set Auditor
          </Link>{' '}
          first.
        </Alert>
      )}

      <div className="flex flex-col [&>div]:mb-4">
        <Input
          label="Recipient EVM address"
          value={recipient}
          onChange={setRecipient}
          placeholder="0x..."
          className="font-mono"
          error={recipient && !recipientValid ? 'Invalid EVM address' : null}
        />
        <Input
          label="Amount"
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

      {(busy || tr.status === 'success') && (
        <ProgressList steps={progressFrom(TRANSFER_PHASES, tr.status, tr.status === 'success')} />
      )}

      {tr.error && (
        <Alert variant="error">
          {tr.error}
          {(tr.error === EERC_BALANCE_PROOF_MISMATCH_MESSAGE || tr.error === EERC_PRIVATE_KEY_INVALID_MESSAGE) && (
            <>
              {' '}
              <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
                Open Register
              </Link>
              .
            </>
          )}
          {tr.error === EERC_BALANCE_UNINITIALIZED_MESSAGE && (
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
      {tr.status === 'success' && tr.txHash && (
        <Alert variant="success">
          Transfer confirmed.{' '}
          <EERCTxLink chainId={activeChainId} txHash={tr.txHash}>
            {tr.txHash.slice(0, 10)}…
          </EERCTxLink>
        </Alert>
      )}

      <Button
        variant="primary"
        loading={busy}
        loadingText={LOADING_TEXT[tr.status]}
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
        Send privately
      </Button>

      <Disclosure summary="What happens during a private transfer?">
        <p>
          The amount is encrypted three times: to you, the recipient, and the auditor. A zero-knowledge proof then shows
          your balance covers the amount, the three encryptions agree, and your new balance is correct.
        </p>
        <p>
          The proof uses the TRANSFER circuit (ptau 15, about a 36 MB zkey). It is CPU-heavy, so expect 5–20 seconds. It
          runs entirely in your browser; no server sees the amount or your private key.
        </p>
      </Disclosure>
    </EERCToolShell>
  );
}

export default withConsoleToolMetadata(PrivateTransfer, metadata);
