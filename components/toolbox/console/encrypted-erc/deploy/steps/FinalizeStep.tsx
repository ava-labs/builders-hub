'use client';

import React, { useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { Step, Steps } from '@/components/toolbox/components/Steps';
import { useEERCDeployStore } from '@/components/toolbox/stores/eercDeployStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useEERCRegistration, type RegistrationStatus } from '@/hooks/eerc/useEERCRegistration';
import { useEERCNotifiedWrite } from '@/hooks/eerc/useEERCNotifiedWrite';
import { EERCToolShell } from '../../shared/EERCToolShell';
import { HashChip, SpecRow } from '@/components/explorer-v2/ui';
import { EERCTxLink } from '../../shared/EERCTxLink';
import { REGISTRAR_SOURCES, ENCRYPTED_ERC_SOURCES, EERC_COMMIT } from '@/lib/eerc/contractSources';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';
import { ProgressList, progressFrom } from '../../shared/ui';
import { Missing, MONO, PaneSection, Plate, StatusTag, WorkingCaption, PANE_HEIGHT } from '../ui';

const FINALIZE_SOURCES = [
  ...REGISTRAR_SOURCES,
  ENCRYPTED_ERC_SOURCES.find((s) => s.filename === 'AuditorManager.sol')!,
];

const REG_PROGRESS = [
  { key: 'deriving-key', label: 'Sign the message in your wallet' },
  { key: 'proving', label: 'Generate the proof' },
  { key: 'submitting', label: 'Confirm the register transaction' },
] as const;

const REG_CAPTION: Partial<Record<RegistrationStatus, string>> = {
  'deriving-key': 'Signing…',
  proving: 'Generating proof…',
  submitting: 'Submitting…',
};

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
  const regCaption = REG_CAPTION[reg.status];

  const contracts: { label: string; value: string }[] = [
    { label: 'EncryptedERC', value: s.encryptedERCAddress },
    { label: 'Registrar', value: s.registrarAddress },
    { label: 'BabyJubJub lib', value: s.babyJubJubAddress },
    { label: 'Registration verifier', value: s.verifiers.registration },
    { label: 'Mint verifier', value: s.verifiers.mint },
    { label: 'Transfer verifier', value: s.verifiers.transfer },
    { label: 'Withdraw verifier', value: s.verifiers.withdraw },
    { label: 'Burn verifier', value: s.verifiers.burn },
  ];

  return (
    <EERCToolShell
      contracts={FINALIZE_SOURCES}
      showNav={false}
      height={PANE_HEIGHT}
      academyHref="/academy/encrypted-erc/04-usability-eerc"
      footerLinks={[
        {
          label: 'AuditorManager',
          href: `https://github.com/ava-labs/EncryptedERC/blob/${EERC_COMMIT}/contracts/auditor/AuditorManager.sol`,
        },
      ]}
    >
      {prereqsMissing && (
        <Alert variant="warning">
          The EncryptedERC and Registrar addresses are missing. Go back and deploy them, then return here. The buttons
          below stay disabled until then.
        </Alert>
      )}

      <Steps>
        <Step>
          <div>
            <h3>Register your BabyJubJub identity</h3>
            <p>
              Sign a fixed message to derive your BJJ key, then submit a Groth16 proof that binds it to your address.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {registerDone ? (
              <Plate>
                <SpecRow label="Status">
                  <StatusTag status="done" label="Registered" />
                </SpecRow>
                <SpecRow label="Public key x">
                  <span className={`${MONO} break-all`}>{reg.onChainPublicKey?.[0].toString()}</span>
                </SpecRow>
              </Plate>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    reg.register().catch(() => {
                      /* surfaced via reg.error */
                    })
                  }
                  loading={reg.status === 'deriving-key' || reg.status === 'proving' || reg.status === 'submitting'}
                  loadingText={regCaption}
                >
                  Register
                </Button>
                {reg.status === 'checking' && <WorkingCaption>Checking the Registrar…</WorkingCaption>}
                {regCaption && (
                  <ProgressList
                    steps={progressFrom(REG_PROGRESS, reg.status, false).map((p) =>
                      p.key === 'proving' && p.state === 'active'
                        ? { ...p, label: 'Generate the proof in your browser (a few seconds)' }
                        : p,
                    )}
                  />
                )}
              </>
            )}
            {reg.error && <Alert variant="error">{reg.error}</Alert>}
          </div>
        </Step>

        <Step>
          <div className={registerDone ? undefined : 'opacity-60'}>
            <h3>Set yourself as auditor</h3>
            <p>
              Owner only. Points setAuditorPublicKey at your new BJJ identity, so every mint, transfer, withdrawal and
              burn carries an audit ciphertext.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {auditorDone ? (
              <Plate>
                <SpecRow label="Status">
                  <StatusTag status="done" label="Auditor set" />
                </SpecRow>
                <SpecRow label="Transaction">
                  <EERCTxLink
                    chainId={chainId}
                    txHash={auditorTxHash!}
                    className="font-mono text-[12.5px] text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
                  >
                    {auditorTxHash!.slice(0, 10)}…{auditorTxHash!.slice(-4)}
                  </EERCTxLink>
                </SpecRow>
              </Plate>
            ) : (
              <>
                {!registerDone && (
                  <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">Register first.</p>
                )}
                <Button
                  variant="primary"
                  onClick={setSelfAsAuditor}
                  loading={settingAuditor}
                  loadingText="Setting auditor…"
                  disabled={!registerDone}
                >
                  Set auditor
                </Button>
                {settingAuditor && <WorkingCaption>Confirm in your wallet, then wait for the receipt.</WorkingCaption>}
              </>
            )}
          </div>
        </Step>
      </Steps>

      {s.globalError && <Alert variant="error">{s.globalError}</Alert>}

      <PaneSection label="Deployed contracts">
        <Plate>
          {contracts.map((c) => (
            <SpecRow key={c.label} label={c.label}>
              {c.value ? <HashChip value={c.value} len={18} /> : <Missing />}
            </SpecRow>
          ))}
        </Plate>
      </PaneSection>
    </EERCToolShell>
  );
}
