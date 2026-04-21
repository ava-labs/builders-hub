'use client';

import React from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Check, Key, BookOpen } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { EERCToolShell } from './shared/EERCToolShell';
import { REGISTRAR_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';

const metadata: ConsoleToolMetadata = {
  title: 'Register Encrypted ERC Keys',
  description: (
    <>
      Derive a BabyJubJub identity from a wallet signature and publish its public key on-chain. One-time per{' '}
      <span className="font-mono text-xs">Registrar</span>, required before any encrypted transfer. Works for both
      standalone and converter deployments sharing the same Registrar.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

function Register() {
  const { address } = useAccount();
  // Both modes share the same Registrar on Fuji, so either deployment resolves to
  // the correct one — prefer standalone, fall back to converter for custom L1s.
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  const reg = useEERCRegistration(deployment);

  if (!deployment) {
    return <NoDeployment />;
  }

  return (
    <EERCToolShell
      contracts={REGISTRAR_SOURCES}
      height={640}
      footerLinks={[
        {
          label: 'Registrar source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/Registrar.sol`,
          icon: <BookOpen className="w-3.5 h-3.5" />,
        },
      ]}
    >
      {reg.status === 'registered' ? (
        <RegisteredPanel
          address={address}
          registrar={deployment.registrar}
          onChainKey={reg.onChainPublicKey}
          hasLocalKey={reg.identity !== null}
          onResetLocal={reg.resetIdentity}
        />
      ) : (
        <>
          <StepList status={reg.status} />
          <UnregisteredPanel
            address={address}
            registrar={deployment.registrar}
            cachedIdentity={reg.identity}
            busy={
              reg.status === 'checking' ||
              reg.status === 'deriving-key' ||
              reg.status === 'proving' ||
              reg.status === 'submitting'
            }
            onRegister={() =>
              reg.register().catch(() => {
                /* surfaced via reg.error */
              })
            }
            onResetLocal={reg.resetIdentity}
          />
        </>
      )}

      {reg.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          {reg.error}
        </div>
      )}

      <Educational />
    </EERCToolShell>
  );
}

function StepList({ status }: { status: ReturnType<typeof useEERCRegistration>['status'] }) {
  const steps: { key: string; label: string; active: boolean; done: boolean }[] = [
    {
      key: 'derive',
      label: 'Sign message to derive BabyJubJub identity',
      active: status === 'deriving-key',
      done: status === 'proving' || status === 'submitting' || status === 'registered',
    },
    {
      key: 'prove',
      label: 'Generate zero-knowledge registration proof',
      active: status === 'proving',
      done: status === 'submitting' || status === 'registered',
    },
    {
      key: 'submit',
      label: 'Submit proof to Registrar',
      active: status === 'submitting',
      done: status === 'registered',
    },
  ];
  return (
    <ol className="space-y-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3 text-sm">
          <span
            className={
              s.done
                ? 'shrink-0 inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-500 text-white text-xs'
                : s.active
                  ? 'shrink-0 inline-flex w-5 h-5 items-center justify-center rounded-full bg-blue-500 text-white text-xs animate-pulse'
                  : 'shrink-0 inline-flex w-5 h-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-[11px]'
            }
          >
            {s.done ? <Check className="w-3 h-3" /> : i + 1}
          </span>
          <span
            className={
              s.done
                ? 'text-zinc-500 dark:text-zinc-500'
                : s.active
                  ? 'font-medium text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-600 dark:text-zinc-400'
            }
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function UnregisteredPanel({
  address,
  registrar,
  cachedIdentity,
  busy,
  onRegister,
  onResetLocal,
}: {
  address: string | undefined;
  registrar: string;
  cachedIdentity: { publicKey: [bigint, bigint] } | null;
  busy: boolean;
  onRegister: () => void;
  onResetLocal: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Key className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Register your encrypted identity</h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            You&apos;ll be asked to sign a deterministic message — the same wallet always produces the same BabyJubJub
            key, so your encrypted balance is recoverable from your wallet alone.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <Field label="EVM address" value={address ?? '—'} />
        <Field label="Registrar" value={registrar} />
      </div>
      {cachedIdentity && (
        <div className="rounded-md border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-3 text-xs text-blue-700 dark:text-blue-300">
          A BabyJubJub identity is cached locally for this address but not yet registered on-chain. Click{' '}
          <strong>Register</strong> to submit it, or{' '}
          <button className="underline" onClick={onResetLocal}>
            reset cached key
          </button>{' '}
          to re-derive from scratch.
        </div>
      )}
      <Button variant="primary" onClick={onRegister} loading={busy}>
        {busy ? 'Working…' : 'Register'}
      </Button>
    </div>
  );
}

function RegisteredPanel({
  address,
  registrar,
  onChainKey,
  hasLocalKey,
  onResetLocal,
}: {
  address: string | undefined;
  registrar: string;
  onChainKey: [bigint, bigint] | null;
  hasLocalKey: boolean;
  onResetLocal: () => void;
}) {
  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
          <Check className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Registered on-chain</h3>
          <p className="text-[11px] text-green-700/70 dark:text-green-400/70">
            Your BabyJubJub public key is published at this Registrar.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <Field label="EVM address" value={address ?? '—'} />
        <Field label="Registrar" value={registrar} />
        <Field label="Public key x" value={onChainKey?.[0].toString() ?? '—'} mono />
        <Field label="Public key y" value={onChainKey?.[1].toString() ?? '—'} mono />
      </div>
      <div className="rounded-md border border-green-200/50 dark:border-green-800/50 bg-white/50 dark:bg-zinc-900/30 p-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {hasLocalKey ? (
          <>
            Your BabyJubJub private key is cached locally so decrypt and transfer tools won&apos;t re-prompt for a
            signature.{' '}
            <button className="underline text-zinc-700 dark:text-zinc-300" onClick={onResetLocal}>
              Clear local key
            </button>
          </>
        ) : (
          <>
            No local private key — decrypt tools will ask you to sign once to re-derive it.{' '}
            <button className="underline text-zinc-700 dark:text-zinc-300" onClick={onResetLocal}>
              Re-derive now
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoDeployment() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6">
      <h3 className="text-base font-medium mb-2 text-zinc-900 dark:text-zinc-100">No deployment on this chain</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        There is no canonical Encrypted ERC deployment recorded for the chain you&apos;re currently connected to. Switch
        to Avalanche Fuji to use the canonical demo deployment, or use the{' '}
        <Link href="/console/encrypted-erc/deploy" className="underline">
          Deploy Your Own
        </Link>{' '}
        wizard on your L1.
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <code
        className={`block break-all ${mono ? 'font-mono text-[10px]' : 'font-mono text-[11px]'} text-zinc-700 dark:text-zinc-300`}
      >
        {value}
      </code>
    </div>
  );
}

function Educational() {
  return (
    <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
        How does registration work?
      </summary>
      <div className="space-y-2 pt-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <p>
          Encrypted ERC uses the BabyJubJub curve for ElGamal encryption. Your &quot;encrypted identity&quot; is a
          keypair on that curve: a secret scalar + the point you get by multiplying the curve&apos;s base point by that
          scalar.
        </p>
        <p>
          To make the keypair recoverable from your wallet alone, we derive it deterministically: you sign a fixed
          string with your EVM private key; the first 32 bytes of the signature feed through Blake512 and SHA-256 into a
          BabyJubJub scalar.
        </p>
        <p>
          Your public key is then written to the <em>Registrar</em> contract. Other users reference it by your EVM
          address when encrypting amounts to send to you. A Groth16 proof accompanies the registration — it proves the
          binding between (EVM address, BJJ public key, chain ID) without revealing your private key.
        </p>
      </div>
    </details>
  );
}

export default withConsoleToolMetadata(Register, metadata);
