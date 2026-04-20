'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { isAddress } from 'viem';
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
  const deployments: { mode: Mode; deployment: EERCDeployment }[] = [];
  if (standalone.isReady && standalone.deployment)
    deployments.push({ mode: 'standalone', deployment: standalone.deployment });
  if (converter.isReady && converter.deployment)
    deployments.push({ mode: 'converter', deployment: converter.deployment });

  if (deployments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm">
        <p className="font-medium mb-1">No Encrypted ERC deployment on this chain.</p>
        <p className="text-muted-foreground">Switch to Avalanche Fuji or deploy your own.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deployments.map(({ mode, deployment }) => (
        <DeploymentCard key={deployment.encryptedERC} mode={mode} deployment={deployment} />
      ))}
      <Educational />
    </div>
  );
}

function DeploymentCard({ mode, deployment }: { mode: Mode; deployment: EERCDeployment }) {
  const { address: myAddress } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();

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

  const onSubmit = async () => {
    if (!walletClient || !publicClient || !candidateValid || !candidateRegistered) return;
    setError(null);
    setTxHash(null);
    setSubmitting(true);
    try {
      const hash = await (walletClient as any).writeContract({
        address: deployment.encryptedERC,
        abi: EncryptedERCArtifact.abi,
        functionName: 'setAuditorPublicKey',
        args: [candidate as Hex],
      });
      setTxHash(hash as Hex);
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set auditor');
    } finally {
      setSubmitting(false);
    }
  };

  const isZeroAuditor = currentAuditor && /^0x0+$/i.test(currentAuditor);

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">
          {mode === 'standalone' ? 'Standalone deployment' : 'Converter deployment'}
        </h3>
        <code className="text-xs text-muted-foreground">{deployment.encryptedERC}</code>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Current auditor</div>
          <code className="block break-all font-mono">
            {currentAuditor ?? '—'}{' '}
            {isZeroAuditor && <span className="text-amber-600 dark:text-amber-400">(not set)</span>}
          </code>
        </div>
        <div>
          <div className="text-muted-foreground">You</div>
          <code className="block break-all font-mono">{myAddress ?? '—'}</code>
        </div>
      </div>

      <Input label="Auditor candidate" value={candidate} onChange={setCandidate} placeholder="0x..." />
      {candidate && !candidateValid && <div className="text-xs text-red-600 dark:text-red-400">Invalid address</div>}
      {candidateValid && candidateRegistered === false && (
        <div className="text-xs text-red-600 dark:text-red-400">
          Candidate is not registered on the Registrar — they must register first before they can serve as auditor.
        </div>
      )}
      {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
      {txHash && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-700 dark:text-green-300">
          Auditor set.{' '}
          <a
            href={`https://testnet.snowtrace.io/tx/${txHash}`}
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
        disabled={!candidateValid || candidateRegistered !== true}
        loading={submitting}
        onClick={onSubmit}
      >
        Set Auditor
      </Button>
    </div>
  );
}

function Educational() {
  return (
    <details className="rounded-lg border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium">Why is setting an auditor required?</summary>
      <div className="space-y-2 pt-3 text-muted-foreground">
        <p>
          Encrypted ERC's compliance model ships every mint, transfer, withdrawal, and burn with an extra auditor PCT —
          a Poseidon ciphertext of the amount encrypted under the auditor's public key. The contract refuses to process
          any of these operations before an auditor is set, because otherwise the audit trail would be missing on
          day-one transactions.
        </p>
        <p>
          The auditor is chosen by address, but the actual decryption key comes from that address's <em>Registrar</em>{' '}
          entry — so the candidate must register first. The owner (usually the deployer) can rotate the auditor at any
          time; pre-rotation transactions remain decryptable only by the old auditor's key.
        </p>
        <p>
          On the canonical Fuji demo, the deployer typically registers themselves and becomes the auditor — giving you a
          single identity that both deployed and audits the system.
        </p>
      </div>
    </details>
  );
}

export default withConsoleToolMetadata(SetAuditor, metadata);
