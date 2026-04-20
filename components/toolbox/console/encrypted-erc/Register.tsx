'use client';

import React from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';

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

  const busy =
    reg.status === 'checking' ||
    reg.status === 'deriving-key' ||
    reg.status === 'proving' ||
    reg.status === 'submitting';

  return (
    <div className="space-y-6">
      <StepList status={reg.status} />

      {reg.status === 'registered' ? (
        <RegisteredPanel
          address={address}
          registrar={deployment.registrar}
          onChainKey={reg.onChainPublicKey}
          hasLocalKey={reg.identity !== null}
          onResetLocal={reg.resetIdentity}
        />
      ) : (
        <UnregisteredPanel
          address={address}
          registrar={deployment.registrar}
          cachedIdentity={reg.identity}
          busy={busy}
          onRegister={() =>
            reg.register().catch(() => {
              /* surfaced via reg.error */
            })
          }
          onResetLocal={reg.resetIdentity}
        />
      )}

      {reg.error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          {reg.error}
        </div>
      )}

      <Educational />
    </div>
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
    <ol className="space-y-2 rounded-lg border bg-card p-4">
      {steps.map((s) => (
        <li key={s.key} className="flex items-center gap-3 text-sm">
          <span
            className={
              s.done
                ? 'inline-flex size-5 items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-400 text-xs'
                : s.active
                  ? 'inline-flex size-5 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs animate-pulse'
                  : 'inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs'
            }
          >
            {s.done ? '\u2713' : s.active ? '\u2022' : ''}
          </span>
          <span className={s.done ? 'line-through text-muted-foreground' : s.active ? 'font-medium' : ''}>
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
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-medium">Register your encrypted identity</h3>
          <p className="text-sm text-muted-foreground">
            You'll be asked to sign a message — this deterministically derives your BabyJubJub private key, so the same
            wallet always produces the same encrypted identity.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <Field label="EVM address" value={address ?? '-'} />
        <Field label="Registrar" value={registrar} />
      </div>
      {cachedIdentity && (
        <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300">
          A BJJ identity is cached locally for this address but not yet registered on-chain. Click Register to submit
          it, or{' '}
          <button className="underline" onClick={onResetLocal}>
            reset cached key
          </button>{' '}
          to re-derive from scratch.
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onRegister} loading={busy}>
          {busy ? 'Working...' : 'Register'}
        </Button>
      </div>
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
    <div className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-5">
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-green-500/20 text-sm">
          \u2713
        </span>
        <h3 className="text-base font-medium">Registered on-chain</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <Field label="EVM address" value={address ?? '-'} />
        <Field label="Registrar" value={registrar} />
        <Field label="Public key x" value={onChainKey?.[0].toString() ?? '-'} />
        <Field label="Public key y" value={onChainKey?.[1].toString() ?? '-'} />
      </div>
      <p className="text-sm text-muted-foreground">
        {hasLocalKey
          ? "Your BJJ private key is cached locally so decrypt + transfer tools won't re-prompt for a signature."
          : 'No local private key — decrypt tools will ask you to sign once to re-derive it.'}{' '}
        <button className="underline" onClick={onResetLocal}>
          {hasLocalKey ? 'Clear local key' : 'Re-derive from signature'}
        </button>
      </p>
    </div>
  );
}

function NoDeployment() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6">
      <h3 className="text-base font-medium mb-2">No deployment on this chain</h3>
      <p className="text-sm text-muted-foreground">
        There is no canonical Encrypted ERC deployment recorded for the chain you're currently connected to. Switch to
        Avalanche Fuji to use the canonical demo deployment, or use the{' '}
        <Link href="/console/encrypted-erc/deploy" className="underline">
          Deploy Your Own
        </Link>{' '}
        wizard on your L1.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground">{label}</div>
      <code className="block break-all font-mono text-[11px]">{value}</code>
    </div>
  );
}

function Educational() {
  return (
    <details className="rounded-lg border bg-muted/20 p-4 text-sm">
      <summary className="cursor-pointer font-medium">How does registration work?</summary>
      <div className="space-y-2 pt-3 text-muted-foreground">
        <p>
          Encrypted ERC uses the BabyJubJub curve for ElGamal encryption. Your "encrypted identity" is a keypair on that
          curve: a secret scalar + the point you get by multiplying the curve's base point by that scalar.
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
