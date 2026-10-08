'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { isAddress } from 'viem';
import { Check } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCNotifiedWrite } from '@/hooks/eerc/useEERCNotifiedWrite';
import { EERCToolShell } from '../shared/EERCToolShell';
import { EERCTxLink } from '../shared/EERCTxLink';
import { Disclosure, EmptyBoard, EYEBROW } from '../shared/ui';
import { Alert } from '@/components/toolbox/components/Alert';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { WorkingCaption } from './ui';
import { ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';

const metadata: ConsoleToolMetadata = {
  title: 'Set Encrypted ERC Auditor',
  description: (
    <>
      Owner-only. Appoints a registered address as the auditor — its BabyJubJub public key becomes the
      compliance-decryption key for all subsequent mints, transfers, withdrawals, and burns on this deployment.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

type Mode = 'standalone' | 'converter';

function SetAuditor() {
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployments: { mode: Mode; deployment: EERCDeployment; chainId: number }[] = [];
  if (standalone.isReady && standalone.deployment)
    deployments.push({ mode: 'standalone', deployment: standalone.deployment, chainId: standalone.chainId });
  if (converter.isReady && converter.deployment)
    deployments.push({ mode: 'converter', deployment: converter.deployment, chainId: converter.chainId });

  if (deployments.length === 0) {
    return (
      <EmptyBoard
        eyebrow="No deployment"
        action={{ href: '/console/encrypted-erc/deploy/configure', label: 'Deploy your own' }}
      >
        There is no Encrypted ERC deployment on this chain. Switch to Avalanche Fuji or deploy your own.
      </EmptyBoard>
    );
  }

  return (
    <EERCToolShell
      contracts={ENCRYPTED_ERC_SOURCES}
      height={640}
      footerLinks={[
        {
          label: 'setAuditorPublicKey() source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/EncryptedERC.sol`,
        },
      ]}
    >
      {deployments.map(({ mode, deployment, chainId }) => (
        <DeploymentCard key={deployment.encryptedERC} mode={mode} deployment={deployment} chainId={chainId} />
      ))}
      <Disclosure summary="Why is an auditor required?">
        <p>
          Every state-changing operation carries a Poseidon ciphertext encrypted to the auditor&apos;s public key. The
          contract rejects operations until an auditor is set, so the audit trail is complete from the first
          transaction.
        </p>
        <p>
          You pick the auditor by address, but the decryption key comes from that address&apos;s Registrar entry, so the
          candidate must register first. The owner can rotate the auditor at any time. Transactions from before a
          rotation stay decryptable only with the old auditor&apos;s key.
        </p>
      </Disclosure>
    </EERCToolShell>
  );
}

function DeploymentCard({ mode, deployment, chainId }: { mode: Mode; deployment: EERCDeployment; chainId: number }) {
  const { address: myAddress } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();
  const notifiedWrite = useEERCNotifiedWrite();

  const [currentAuditor, setCurrentAuditor] = useState<Hex | null>(null);
  const [candidate, setCandidate] = useState<string>(myAddress ?? '');
  const [candidateRegistered, setCandidateRegistered] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  useEffect(() => {
    if (myAddress && !candidate) setCandidate(myAddress);
  }, [myAddress, candidate]);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    try {
      const auditor = (await publicClient.readContract({
        address: deployment.encryptedERC,
        abi: EncryptedERCArtifact.abi,
        functionName: 'auditor',
        args: [],
      })) as Hex;
      setCurrentAuditor(auditor);
    } catch {
      /* ignore */
    }
  }, [publicClient, deployment]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancel = false;
    async function check() {
      if (!publicClient || !isAddress(candidate)) {
        setCandidateRegistered(null);
        return;
      }
      try {
        const pk = (await publicClient.readContract({
          address: deployment.registrar,
          abi: RegistrarArtifact.abi,
          functionName: 'getUserPublicKey',
          args: [candidate],
        })) as readonly [bigint, bigint];
        if (cancel) return;
        setCandidateRegistered(pk[0] !== 0n || pk[1] !== 0n);
      } catch {
        if (cancel) return;
        setCandidateRegistered(null);
      }
    }
    check();
    return () => {
      cancel = true;
    };
  }, [candidate, publicClient, deployment]);

  const candidateValid = isAddress(candidate);
  const isZeroAuditor = currentAuditor && /^0x0+$/i.test(currentAuditor);
  const isMatchingCandidate =
    currentAuditor && candidateValid && currentAuditor.toLowerCase() === candidate.toLowerCase();

  const onSubmit = async () => {
    if (!walletClient || !publicClient || !candidateValid || !candidateRegistered) return;
    setError(null);
    setTxHash(null);
    setSubmitting(true);
    try {
      const hash = await notifiedWrite(
        {
          address: deployment.encryptedERC,
          abi: EncryptedERCArtifact.abi,
          functionName: 'setAuditorPublicKey',
          args: [candidate as Hex],
        },
        'Set encrypted-ERC auditor',
      );
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set auditor');
    } finally {
      setSubmitting(false);
    }
  };

  const candidateError =
    candidate && !candidateValid
      ? 'Invalid address.'
      : candidateValid && candidateRegistered === false
        ? 'This address is not registered on the Registrar. It must register first.'
        : null;

  return (
    <section className="border border-zinc-200 dark:border-zinc-800">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className={EYEBROW}>{mode === 'standalone' ? 'Standalone deployment' : 'Converter deployment'}</p>
        <HashChip value={deployment.encryptedERC} len={10} />
      </div>

      <div className="border-b border-zinc-200 px-4 dark:border-zinc-800">
        <SpecPlate>
          <SpecRow label="Current auditor">
            {currentAuditor === null ? (
              <span className="font-mono text-zinc-400 dark:text-zinc-500">—</span>
            ) : isZeroAuditor ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                Not set
              </span>
            ) : (
              <HashChip value={currentAuditor} len={18} />
            )}
          </SpecRow>
          <SpecRow label="You">
            {myAddress ? (
              <HashChip value={myAddress} len={18} />
            ) : (
              <span className="font-mono text-zinc-400 dark:text-zinc-500">—</span>
            )}
          </SpecRow>
        </SpecPlate>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Input
          label="Auditor candidate"
          value={candidate}
          onChange={setCandidate}
          placeholder="0x..."
          className="font-mono"
          error={candidateError}
        />
        {isMatchingCandidate && (
          <p className="-mt-3 flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            The auditor is already this address.
          </p>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        {txHash && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
            <span className={EYEBROW}>Auditor set</span>
            <EERCTxLink
              chainId={chainId}
              txHash={txHash}
              className="font-mono text-[12.5px] text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
            >
              {txHash.slice(0, 10)}…{txHash.slice(-4)}
            </EERCTxLink>
          </p>
        )}

        <Button
          variant="primary"
          disabled={!candidateValid || candidateRegistered !== true || !!isMatchingCandidate}
          loading={submitting}
          loadingText="Setting auditor…"
          onClick={onSubmit}
        >
          Set auditor
        </Button>
        {submitting && <WorkingCaption>Confirm in your wallet, then wait for the receipt.</WorkingCaption>}
      </div>
    </section>
  );
}

export default withConsoleToolMetadata(SetAuditor, metadata);
