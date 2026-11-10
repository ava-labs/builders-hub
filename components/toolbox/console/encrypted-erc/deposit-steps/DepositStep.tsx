'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits, parseAbi, parseUnits } from 'viem';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Alert } from '@/components/toolbox/components/Alert';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCDeposit } from '@/hooks/eerc/useEERCDeposit';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { EERCToolShell } from '../shared/EERCToolShell';
import { EERCTxLink } from '../shared/EERCTxLink';
import { Code, EmptyBoard, FRAME, HairlineGrid, INLINE_LINK, Reading } from '../shared/ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';

/**
 * Step 2 of the Deposit flow — wrap WAVAX into its encrypted form. Requires
 * the user to have already completed step 1 (hold some WAVAX) and to have
 * registered a BJJ identity.
 */
export default function DepositStep() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const converter = useEERCDeployment('converter');
  const deployment = converter.deployment;
  const token = deployment?.supportedTokens?.[0];
  const aud = useEERCAuditorAndTokenId(deployment, token?.address);
  const dep = useEERCDeposit(deployment, token);

  const [wavaxBalance, setWavaxBalance] = useState<bigint | null>(null);
  const [amount, setAmount] = useState('');

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !token) return;
    const bal = (await publicClient.readContract({
      address: token.address,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;
    setWavaxBalance(bal);
  }, [address, publicClient, token]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (dep.status === 'success') refresh();
  }, [dep.status, refresh]);

  let depositWei: bigint | null = null;
  let parseError: string | null = null;
  if (amount && token) {
    try {
      depositWei = parseUnits(amount, token.decimals);
    } catch {
      parseError = 'Invalid amount';
    }
  }
  const preview = depositWei !== null ? dep.preview(depositWei) : { cents: 0n, dustWei: 0n };

  const canSubmit =
    depositWei !== null &&
    depositWei > 0n &&
    preview.cents > 0n &&
    wavaxBalance !== null &&
    depositWei <= wavaxBalance &&
    aud.isAuditorSet;
  const hasAllowance = depositWei !== null && dep.currentAllowance !== null && dep.currentAllowance >= depositWei;
  const canApprove =
    depositWei !== null && depositWei > 0n && wavaxBalance !== null && depositWei <= wavaxBalance && !hasAllowance;

  // The deposit hook reuses `confirming` for both wallet-side phases, so
  // we partition it by `hasAllowance` to know which button is the one
  // actively waiting on chain. While `approving` is true *both* buttons
  // show a spinner — the row reads as one in-flight 1→2 sequence rather
  // than the deposit step looking idle while step 1 is mid-confirmation.
  const approving = dep.status === 'approving' || (dep.status === 'confirming' && !hasAllowance);
  const depositing = dep.status === 'depositing' || (dep.status === 'confirming' && hasAllowance);
  const checkingAllowance = dep.status === 'checking-allowance';
  const busy = approving || depositing || checkingAllowance;

  useEffect(() => {
    if (depositWei !== null && depositWei > 0n) {
      dep.refreshAllowance().catch(() => {
        /* surfaced when the user tries to submit */
      });
    }
  }, [depositWei, dep.refreshAllowance]);

  if (!deployment || !token) {
    return (
      <EmptyBoard eyebrow="No converter deployment on this chain">
        Switch to Avalanche Fuji to use the demo converter.
      </EmptyBoard>
    );
  }

  const hasAmount = depositWei !== null && depositWei > 0n;

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      showNav={false}
      academyHref="/academy/encrypted-erc/04-usability-eerc"
      footerLinks={[
        {
          label: 'deposit() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol#L250`,
          icon: <BookOpen />,
        },
      ]}
    >
      <HairlineGrid cols={2}>
        <Reading
          label="WAVAX (public)"
          value={wavaxBalance === null ? '' : formatUnits(wavaxBalance, 18).slice(0, 7)}
          loading={wavaxBalance === null}
          sub="Available to deposit"
        />
        <Reading
          label="Encrypted credit"
          value={hasAmount ? (Number(preview.cents) / 100).toFixed(2) : '—'}
          unit="eWAVAX"
          sub={`${deployment.decimals}-decimal encrypted form`}
        />
      </HairlineGrid>

      {!aud.isAuditorSet && !aud.isLoading && (
        <Alert variant="warning">
          The auditor public key isn&apos;t set on this deployment, so deposits will revert. The deployment owner must
          finish{' '}
          <Link href="/console/encrypted-erc/register" className={INLINE_LINK}>
            Register
          </Link>{' '}
          and{' '}
          <Link href="/console/encrypted-erc/deploy/auditor" className={INLINE_LINK}>
            Set Auditor
          </Link>{' '}
          first.
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Approves WAVAX if the allowance is too low, then calls{' '}
          <Code>EncryptedERC.deposit(amount, token, amountPCT[7])</Code>. No proof needed: the amount is a Poseidon
          ciphertext under your public key.
        </p>
        <div className="[&>div]:mb-0">
          <Input
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="Amount of WAVAX to deposit"
            type="number"
            step="0.01"
            unit="WAVAX"
            className="font-mono"
            error={parseError}
          />
        </div>

        {hasAmount && depositWei !== null && (
          <div className={FRAME}>
            <SpecPlate className="px-4">
              <SpecRow label="Public">
                <span className="font-mono text-[12.5px]">{formatUnits(depositWei, token.decimals)} WAVAX</span>
              </SpecRow>
              <SpecRow label="Encrypted credit">
                <span className="font-mono text-[12.5px]">{(Number(preview.cents) / 100).toFixed(2)} eWAVAX</span>
              </SpecRow>
            </SpecPlate>
          </div>
        )}
        {hasAmount && preview.dustWei > 0n && (
          <Alert variant="warning">
            <strong>Dust refund:</strong> {formatUnits(preview.dustWei, token.decimals)} WAVAX doesn&apos;t fit the{' '}
            {deployment.decimals}-decimal encrypted form, so the contract sends it back to you.
          </Alert>
        )}
        {hasAmount && preview.cents === 0n && (
          <Alert variant="error">Amount too small: it converts to 0 cents. Enter at least 0.01 WAVAX.</Alert>
        )}
        {hasAmount && depositWei !== null && wavaxBalance !== null && depositWei > wavaxBalance && (
          <Alert variant="error">
            Exceeds your WAVAX balance ({formatUnits(wavaxBalance, token.decimals)}). Go back to step 1 to wrap more.
          </Alert>
        )}
      </div>

      <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {!hasAmount
          ? 'Enter an amount to see the two transactions.'
          : dep.currentAllowance === null
            ? 'Checking WAVAX allowance…'
            : hasAllowance
              ? 'Approval done. The deposit is ready to sign.'
              : 'Approve WAVAX first. Deposit unlocks once the approval confirms.'}
      </p>

      <Steps>
        <Step>
          <h3>Approve WAVAX</h3>
          <p>Let the converter move {amount || '0'} WAVAX from your wallet.</p>
          <Button
            variant={hasAllowance ? 'secondary' : 'primary'}
            loading={approving}
            loadingText={dep.status === 'approving' ? 'Approving WAVAX…' : 'Confirming approval…'}
            disabled={hasAllowance || !canApprove || busy}
            onClick={() => {
              if (depositWei !== null)
                dep.approve(depositWei).catch(() => {
                  /* surfaced via dep.error */
                });
            }}
          >
            {hasAllowance ? `Approved (${amount || '0'} WAVAX)` : `Approve ${amount || '0'} WAVAX`}
          </Button>
        </Step>
        <Step>
          <h3>Deposit</h3>
          <p>Lock the WAVAX and credit the same amount to your encrypted balance.</p>
          <Button
            variant="primary"
            // Deposit button spins during approve too — same
            // sequence, the user shouldn't see step 2 sit idle
            // while step 1 is pending in the wallet/chain.
            loading={approving || depositing}
            loadingText={
              approving ? 'Waiting for approval…' : dep.status === 'depositing' ? 'Depositing…' : 'Confirming deposit…'
            }
            disabled={!hasAllowance || !canSubmit || busy}
            onClick={() => {
              if (depositWei !== null)
                dep.deposit(depositWei).catch(() => {
                  /* surfaced via dep.error */
                });
            }}
          >
            Deposit
          </Button>
        </Step>
      </Steps>

      {dep.error && <Alert variant="error">{dep.error}</Alert>}
      {dep.status === 'success' && dep.txHash && (
        <Alert variant="success">
          Deposited.{' '}
          <EERCTxLink chainId={converter.chainId} txHash={dep.txHash}>
            {dep.txHash.slice(0, 10)}…
          </EERCTxLink>
        </Alert>
      )}
    </EERCToolShell>
  );
}
