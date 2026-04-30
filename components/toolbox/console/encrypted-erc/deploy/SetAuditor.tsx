'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { isAddress } from 'viem';
import { BookOpen, Check } from 'lucide-react';
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
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm">
        <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">No Encrypted ERC deployment on this chain.</p>
        <p className="text-zinc-600 dark:text-zinc-400">Switch to Avalanche Fuji or deploy your own.</p>
      </div>
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
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      {deployments.map(({ mode, deployment, chainId }) => (
        <DeploymentCard key={deployment.encryptedERC} mode={mode} deployment={deployment} chainId={chainId} />
      ))}
      <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
          Why is setting an auditor required?
        </summary>
        <div className="space-y-2 pt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p>
            Every state-changing op ships with a Poseidon ciphertext encrypted to the auditor&apos;s public key. The
            contract refuses to process any op before an auditor is set, because otherwise the audit trail would be
            missing from day-one transactions.
          </p>
          <p>
            The auditor is chosen by address, but the decryption key comes from that address&apos;s Registrar entry — so
            the candidate must register first. The owner can rotate the auditor at any time; pre-rotation txs remain
            decryptable only by the old auditor&apos;s key.
          </p>
        </div>
      </details>
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

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {mode === 'standalone' ? 'Standalone deployment' : 'Converter deployment'}
        </h3>
        <code className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{deployment.encryptedERC}</code>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <Field label="Current auditor">
          <span className="flex items-center gap-1.5">
            <code className="font-mono break-all">{currentAuditor ?? '—'}</code>
            {isZeroAuditor && <span className="text-amber-600 dark:text-amber-400">(not set)</span>}
          </span>
        </Field>
        <Field label="You">
          <code className="font-mono break-all">{myAddress ?? '—'}</code>
        </Field>
      </div>

      <Input label="Auditor candidate" value={candidate} onChange={setCandidate} placeholder="0x..." />
      {candidate && !candidateValid && (
        <div className="text-[11px] text-red-600 dark:text-red-400">Invalid address</div>
      )}
      {candidateValid && candidateRegistered === false && (
        <div className="text-[11px] text-red-600 dark:text-red-400">
          Candidate is not registered on the Registrar — they must register first.
        </div>
      )}
      {isMatchingCandidate && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <Check className="w-3 h-3" />
          Already set to this candidate.
        </div>
      )}
      {error && <div className="text-[11px] text-red-600 dark:text-red-400">{error}</div>}
      {txHash && (
        <div className="text-[11px]">
          <EERCTxLink chainId={chainId} txHash={txHash}>
            Auditor set — {txHash.slice(0, 10)}...
          </EERCTxLink>
        </div>
      )}

      <Button
        variant="primary"
        disabled={!candidateValid || candidateRegistered !== true || !!isMatchingCandidate}
        loading={submitting}
        onClick={onSubmit}
      >
        Set Auditor
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

export default withConsoleToolMetadata(SetAuditor, metadata);
