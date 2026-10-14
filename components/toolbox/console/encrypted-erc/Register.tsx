'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { BookOpen, Check } from 'lucide-react';
import {
  withConsoleToolMetadata,
  type ConsoleToolMetadata,
} from '@/components/toolbox/components/WithConsoleToolMetadata';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { EERCToolShell } from './shared/EERCToolShell';
import { Disclosure, EmptyBoard, Panel, ProgressList, progressFrom } from './shared/ui';
import { REGISTRAR_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import { localIdentityMatchesRegistrar } from '@/lib/eerc/identityValidation';

const metadata: ConsoleToolMetadata = {
  title: 'Register Encrypted ERC Keys',
  description: (
    <>
      Derive a BabyJubJub identity from a wallet signature and publish its public key on-chain. You do this once per{' '}
      <span className="font-mono text-xs">Registrar</span>, before any encrypted transfer. Standalone and converter
      deployments that share a Registrar share the registration.
    </>
  ),
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
};

const TEXT_ACTION =
  'font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-50 dark:decoration-zinc-600 dark:hover:decoration-zinc-100';

const REGISTER_PHASES = [
  { key: 'deriving-key', label: 'Sign a message to derive your BabyJubJub identity' },
  { key: 'proving', label: 'Generate the zero-knowledge registration proof' },
  { key: 'submitting', label: 'Submit the proof to the Registrar' },
] as const;

const LOADING_TEXT: Partial<Record<ReturnType<typeof useEERCRegistration>['status'], string>> = {
  checking: 'Checking registration…',
  'deriving-key': 'Waiting for signature…',
  proving: 'Generating proof…',
  submitting: 'Submitting…',
};

// Named export — used by step-flow consumers (steps.ts) so they consume the
// raw component WITHOUT the metadata wrapper, which would otherwise stack a
// second <Container> + a duplicate <CheckRequirements> on top of the
// step-flow chrome.
export function Register() {
  const { address } = useAccount();
  // Both modes share the same Registrar on Fuji, so either deployment resolves to
  // the correct one — prefer standalone, fall back to converter for custom L1s.
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  const reg = useEERCRegistration(deployment);
  const localKeyMatchesOnChain = localIdentityMatchesRegistrar(reg.identity, reg.onChainPublicKey);

  if (!deployment) {
    return <NoDeployment />;
  }

  const busy =
    reg.status === 'checking' ||
    reg.status === 'deriving-key' ||
    reg.status === 'proving' ||
    reg.status === 'submitting';

  return (
    <EERCToolShell
      contracts={REGISTRAR_SOURCES}
      height={640}
      footerLinks={[
        {
          label: 'Registrar source',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/Registrar.sol`,
          icon: <BookOpen />,
        },
      ]}
    >
      {reg.status === 'registered' ? (
        <RegisteredPanel
          address={address}
          registrar={deployment.registrar}
          onChainKey={reg.onChainPublicKey}
          hasLocalKey={reg.identity !== null}
          localKeyMatchesOnChain={localKeyMatchesOnChain}
          onResetLocal={reg.resetIdentity}
          onDeriveLocal={reg.deriveIdentity}
        />
      ) : (
        <>
          <ProgressList steps={progressFrom(REGISTER_PHASES, reg.status, false)} />
          <UnregisteredPanel
            address={address}
            registrar={deployment.registrar}
            cachedIdentity={reg.identity}
            busy={busy}
            loadingText={LOADING_TEXT[reg.status]}
            onRegister={() =>
              reg.register().catch(() => {
                /* surfaced via reg.error */
              })
            }
            onResetLocal={reg.resetIdentity}
          />
        </>
      )}

      {reg.error && <Alert variant="error">{reg.error}</Alert>}

      <Educational />
    </EERCToolShell>
  );
}

function AddressValue({ value }: { value: string | undefined }) {
  return value ? <HashChip value={value} len={12} /> : <span className="font-mono text-zinc-400">—</span>;
}

function UnregisteredPanel({
  address,
  registrar,
  cachedIdentity,
  busy,
  loadingText,
  onRegister,
  onResetLocal,
}: {
  address: string | undefined;
  registrar: string;
  cachedIdentity: { publicKey: [bigint, bigint] } | null;
  busy: boolean;
  loadingText?: string;
  onRegister: () => void;
  onResetLocal: () => void;
}) {
  return (
    <Panel label="Register your encrypted identity" bodyClassName="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        You sign one fixed message. The same wallet always produces the same BabyJubJub key, so your encrypted balance
        can be recovered from your wallet alone.
      </p>
      <SpecPlate className="border-y border-zinc-200 dark:border-zinc-800">
        <SpecRow label="EVM address">
          <AddressValue value={address} />
        </SpecRow>
        <SpecRow label="Registrar">
          <AddressValue value={registrar} />
        </SpecRow>
      </SpecPlate>
      {cachedIdentity && (
        <Alert variant="info">
          A BabyJubJub identity is cached in this browser but not registered on-chain yet. Click{' '}
          <strong>Register</strong> to submit it, or{' '}
          <button type="button" className={TEXT_ACTION} onClick={onResetLocal}>
            reset the cached key
          </button>{' '}
          to derive it again.
        </Alert>
      )}
      <Button variant="primary" onClick={onRegister} loading={busy} loadingText={loadingText}>
        Register
      </Button>
    </Panel>
  );
}

function RegisteredPanel({
  address,
  registrar,
  onChainKey,
  hasLocalKey,
  localKeyMatchesOnChain,
  onResetLocal,
  onDeriveLocal,
}: {
  address: string | undefined;
  registrar: string;
  onChainKey: [bigint, bigint] | null;
  hasLocalKey: boolean;
  localKeyMatchesOnChain: boolean | null;
  onResetLocal: () => void;
  onDeriveLocal: () => Promise<void>;
}) {
  const [isReDeriving, setIsReDeriving] = useState(false);

  const handleReDerive = async () => {
    if (isReDeriving) return;
    setIsReDeriving(true);
    try {
      await onDeriveLocal();
    } catch {
      /* surfaced via reg.error in parent */
    } finally {
      setIsReDeriving(false);
    }
  };
  const hasLocalKeyMismatch = hasLocalKey && localKeyMatchesOnChain === false;

  return (
    <div className="flex flex-col gap-4">
      <Panel
        label="Registered on-chain"
        action={
          <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Published
          </span>
        }
        bodyClassName="flex flex-col gap-3"
      >
        <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your BabyJubJub public key is published on this Registrar.
        </p>
        <SpecPlate className="border-t border-zinc-200 dark:border-zinc-800">
          <SpecRow label="EVM address">
            <AddressValue value={address} />
          </SpecRow>
          <SpecRow label="Registrar">
            <AddressValue value={registrar} />
          </SpecRow>
          <SpecRow label="Public key x">
            <span className="break-all font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
              {onChainKey?.[0].toString() ?? '—'}
            </span>
          </SpecRow>
          <SpecRow label="Public key y">
            <span className="break-all font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
              {onChainKey?.[1].toString() ?? '—'}
            </span>
          </SpecRow>
        </SpecPlate>
      </Panel>

      {hasLocalKeyMismatch ? (
        <Alert variant="warning">
          <p>
            The key cached in this browser doesn&apos;t match the public key on-chain. Deposit, transfer, and withdraw
            are blocked until they match.
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={TEXT_ACTION} onClick={onResetLocal}>
              Clear local key
            </button>
            <button type="button" className={TEXT_ACTION} onClick={handleReDerive} disabled={isReDeriving}>
              {isReDeriving ? 'Deriving…' : 'Derive again from wallet'}
            </button>
          </p>
        </Alert>
      ) : hasLocalKey ? (
        <Alert variant="info">
          Your private key is cached in this browser, so the decrypt and transfer tools won&apos;t ask you to sign
          again.{' '}
          <button type="button" className={TEXT_ACTION} onClick={onResetLocal}>
            Clear local key
          </button>
        </Alert>
      ) : (
        <Alert variant="info">
          No private key in this browser. The decrypt tools will ask you to sign once to derive it.{' '}
          <button type="button" className={TEXT_ACTION} onClick={handleReDerive} disabled={isReDeriving}>
            {isReDeriving ? 'Deriving…' : 'Derive now'}
          </button>
        </Alert>
      )}
    </div>
  );
}

function NoDeployment() {
  return (
    <EmptyBoard
      eyebrow="No deployment on this chain"
      action={{ href: '/console/encrypted-erc/deploy', label: 'Deploy your own' }}
    >
      There&apos;s no Encrypted ERC deployment recorded for this chain. Switch to Avalanche Fuji for the demo
      deployment, or deploy your own on your L1.
    </EmptyBoard>
  );
}

function Educational() {
  return (
    <Disclosure summary="How does registration work?">
      <p>
        Encrypted ERC uses ElGamal encryption on the BabyJubJub curve. Your encrypted identity is a keypair on that
        curve: a secret scalar, and the point you get by multiplying the curve&apos;s base point by it.
      </p>
      <p>
        The keypair is derived from your wallet so you can always recover it. You sign a fixed string; the first 32
        bytes of the signature go through Blake512 and SHA-256 to make a BabyJubJub scalar.
      </p>
      <p>
        Your public key is then written to the <em>Registrar</em> contract. Senders look it up by your EVM address to
        encrypt amounts to you. A Groth16 proof binds your EVM address, public key, and chain ID without revealing the
        private key.
      </p>
    </Disclosure>
  );
}

export default withConsoleToolMetadata(Register, metadata);
