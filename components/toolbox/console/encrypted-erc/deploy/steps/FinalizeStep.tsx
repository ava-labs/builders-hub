'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { Check, BookOpen, GraduationCap } from 'lucide-react';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { useEERCNotifiedWrite } from '@/hooks/eerc/useEERCNotifiedWrite';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { EERCTxLink } from '../../shared/EERCTxLink';
import { REGISTRAR_SOURCES, ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';

const FINALIZE_SOURCES = [
  ...REGISTRAR_SOURCES,
  ENCRYPTED_ERC_SOURCES.find((s) => s.filename === 'AuditorManager.sol')!,
];

/**
 * Closing step: register the deployer as a user + appoint them as auditor.
 * Re-uses {@link useEERCRegistration} — same hook as the standalone Register
 * tool, just fed a handcrafted deployment object.
 */
export default function FinalizeStep() {
  const s = useEERCDeployStore();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();
  const chainId = useWalletStore((state) => state.walletChainId);
  const notifiedWrite = useEERCNotifiedWrite();

  const fakeDeployment: EERCDeployment | undefined = useMemo(() => {
    if (!s.encryptedERCAddress || !s.registrarAddress) return undefined;
    return {
      label: `${s.mode} deployment`,
      encryptedERC: s.encryptedERCAddress as Hex,
      registrar: s.registrarAddress as Hex,
      babyJubJubLibrary: s.babyJubJubAddress as Hex,
      verifiers: {
        registration: s.verifiers.registration as Hex,
        mint: s.verifiers.mint as Hex,
        transfer: s.verifiers.transfer as Hex,
        withdraw: s.verifiers.withdraw as Hex,
        burn: s.verifiers.burn as Hex,
      },
      auditorAddress: '0x0000000000000000000000000000000000000000' as Hex,
      decimals: s.decimals,
      deployedAtBlock: 0,
    };
  }, [s]);

  const reg = useEERCRegistration(fakeDeployment);

  const [auditorTxHash, setAuditorTxHash] = React.useState<Hex | null>(null);
  const [settingAuditor, setSettingAuditor] = React.useState(false);

  const setSelfAsAuditor = async () => {
    if (!walletClient || !publicClient || !address || !s.encryptedERCAddress) return;
    setSettingAuditor(true);
    s.setGlobalError(null);
    try {
      const hash = await notifiedWrite(
        {
          address: s.encryptedERCAddress as Hex,
          abi: EncryptedERCArtifact.abi,
          functionName: 'setAuditorPublicKey',
          args: [address],
        },
        'Set encrypted-ERC auditor (deploy finalize)',
      );
      await publicClient.waitForTransactionReceipt({ hash });
      setAuditorTxHash(hash);
      s.setLastTxHash(hash);
    } catch (err) {
      s.setGlobalError(err instanceof Error ? err.message : 'setAuditor failed');
    } finally {
      setSettingAuditor(false);
    }
  };

  const prereqsMissing = !fakeDeployment;

  const registerDone = reg.status === 'registered';
  const auditorDone = auditorTxHash !== null;

  return (
    <ContractDeployViewer contracts={FINALIZE_SOURCES}>
      <div className="flex flex-col h-[500px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {prereqsMissing && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              Prior deploy steps aren&apos;t complete — the EncryptedERC and Registrar addresses are missing from the
              flow store. Go back to deploy them, then return here. The buttons below are disabled until that's done.
            </div>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Two transactions finalize the deployment: <strong>register</strong> binds a BabyJubJub identity to your
            address, and <strong>setAuditorPublicKey</strong> points the contract's audit-PCT target at that same
            identity so mints, transfers, withdrawals, and burns succeed.
          </p>

          {/* Step A: Register */}
          <StepCard
            num={1}
            done={registerDone}
            title="Register your BabyJubJub identity"
            subtitle="Signs a deterministic message, derives your BJJ key, and submits a Groth16 proof to the Registrar."
          >
            {registerDone ? (
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                <div>Registered.</div>
                <code className="block break-all bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                  pubKey.x: {reg.onChainPublicKey?.[0].toString()}
                </code>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={() =>
                  reg.register().catch(() => {
                    /* surfaced via reg.error */
                  })
                }
                loading={reg.status === 'deriving-key' || reg.status === 'proving' || reg.status === 'submitting'}
              >
                {reg.status === 'deriving-key'
                  ? 'Signing...'
                  : reg.status === 'proving'
                    ? 'Generating proof...'
                    : reg.status === 'submitting'
                      ? 'Submitting...'
                      : 'Register'}
              </Button>
            )}
            {reg.error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{reg.error}</div>}
          </StepCard>

          {/* Step B: Set Auditor */}
          <StepCard
            num={2}
            done={auditorDone}
            disabled={!registerDone}
            title="Set yourself as auditor"
            subtitle="Owner-only. Points setAuditorPublicKey at your newly-registered BJJ identity so all ops emit audit PCTs."
          >
            {auditorDone ? (
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Auditor set —{' '}
                <EERCTxLink chainId={chainId} txHash={auditorTxHash!} className="underline">
                  {auditorTxHash!.slice(0, 10)}...
                </EERCTxLink>
              </div>
            ) : (
              <Button variant="primary" onClick={setSelfAsAuditor} loading={settingAuditor} disabled={!registerDone}>
                Set auditor
              </Button>
            )}
          </StepCard>

          {s.globalError && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-xs text-red-700 dark:text-red-300">
              {s.globalError}
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-[11px] space-y-1">
            <div className="font-medium text-zinc-700 dark:text-zinc-300">Your deployment</div>
            <div className="font-mono text-zinc-500 dark:text-zinc-400 break-all">
              EncryptedERC: {s.encryptedERCAddress}
            </div>
            <div className="font-mono text-zinc-500 dark:text-zinc-400 break-all">Registrar: {s.registrarAddress}</div>
            <div className="font-mono text-zinc-500 dark:text-zinc-400 break-all">
              BabyJubJub lib: {s.babyJubJubAddress}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/academy/encrypted-erc/04-usability-eerc"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
              </Link>
              <a
                href={`https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/auditor/AuditorManager.sol`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                AuditorManager
              </a>
            </div>
            <a
              href={`https://github.com/ava-labs/EncryptedERC/tree/${EERC_COMMIT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
            >
              @{EERC_COMMIT.slice(0, 7)}
            </a>
          </div>
        </div>
      </div>
    </ContractDeployViewer>
  );
}

function StepCard({
  num,
  title,
  subtitle,
  done,
  disabled,
  children,
}: {
  num: number;
  title: string;
  subtitle: string;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const base = done
    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
    : disabled
      ? 'bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50'
      : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700';
  const iconClass = done
    ? 'bg-green-500 text-white'
    : disabled
      ? 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300';
  return (
    <div className={`p-4 rounded-xl border transition-colors ${base}`}>
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${iconClass}`}
        >
          {done ? <Check className="w-4 h-4" /> : num}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm font-medium ${disabled ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-100'}`}
          >
            {title}
          </h3>
          <p
            className={`mt-1 text-xs leading-relaxed ${disabled ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-600 dark:text-zinc-400'}`}
          >
            {subtitle}
          </p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
