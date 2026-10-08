'use client';

import { useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_HOME_PLUS_REMOTE_SOURCES } from '@/lib/ictt/contractSources';
import { useRegisterRemote } from '../hooks/useRegisterRemote';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { BODY, Inspector, Route, RouteEnd, Timeline, TimelineStep, type TimelineState } from '../ui';
import type { Address, Bridge, BridgePhase, Remote } from '../types';

interface RegisterInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function RegisterInspector({ onPhaseChange, bridge, remote }: RegisterInspectorProps) {
  const remoteL1 = useL1ByChainId(remote?.l1Id ?? '');
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { sendRegister, isRegistering, error, lastTxHash, homePollState, pollAttempts, pollMaxAttempts } =
    useRegisterRemote({
      bridgeId: bridge?.id as Bridge['id'],
      remote,
      homeAddress: (bridge?.homeAddress ?? null) as Address | null,
      homeRpcUrl: homeL1?.rpcUrl ?? null,
    });
  const [submittedTx, setSubmittedTx] = useState<Address | null>(null);

  const txUrl = buildTxUrl(remoteL1, submittedTx ?? lastTxHash ?? null);
  const localTxConfirmed = Boolean(submittedTx || lastTxHash);
  const isDelivered = homePollState === 'delivered' || Boolean(remote?.registeredAt);
  const isPolling = homePollState === 'polling';
  const isTimeout = homePollState === 'timeout';

  const handleRegister = async () => {
    const result = await sendRegister();
    if (result) setSubmittedTx(result.txHash);
  };

  const rowTwoState: RowState = isDelivered ? 'complete' : isPolling ? 'active' : isTimeout ? 'error' : 'idle';
  const rowThreeState: RowState = isDelivered ? 'complete' : isTimeout ? 'error' : 'idle';

  const rowTwoDetail = isDelivered
    ? 'Relayer delivered the registration message to Home.'
    : isPolling
      ? `Waiting for delivery (${pollAttempts}/${pollMaxAttempts}). The relayer usually takes ~30 seconds on Fuji.`
      : isTimeout
        ? 'Timed out — re-send the registration below.'
        : 'The ICM relayer carries the message.';

  const rowThreeDetail = isDelivered
    ? remote?.registeredAt
      ? `Registered at ${new Date(remote.registeredAt).toLocaleTimeString()}.`
      : 'Home contract confirmed registration.'
    : isTimeout
      ? 'No on-chain confirmation yet — re-send to retry.'
      : 'Status flips once the Home contract receives the message.';

  return (
    <ContractDeployViewer contracts={ICTT_HOME_PLUS_REMOTE_SOURCES}>
      <Inspector
        label="Phase 4 · Register"
        banner={!remote?.address && <Alert variant="warning">Deploy a TokenRemote in Phase 3 first.</Alert>}
        footer={
          <>
            <Button
              onClick={handleRegister}
              disabled={!remote?.address}
              loading={isRegistering || isPolling}
              loadingText={isPolling ? 'Waiting for relayer…' : 'Registering…'}
              variant={isDelivered ? 'outline' : 'primary'}
              className="w-auto"
              icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            >
              {isTimeout || isDelivered ? 'Re-send registration' : 'Register Remote'}
            </Button>
            {isDelivered && (
              <Button
                onClick={() => onPhaseChange('collateral')}
                className="w-auto"
                icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
              >
                Continue to Collateral
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <p className={BODY}>
            One transaction on {remoteL1?.name ?? 'the Remote chain'} asks {homeL1?.name ?? 'Home'} to register this
            Remote. The relayer carries it across.
          </p>

          <Route
            from={
              <RouteEnd
                side="Sends · Remote"
                l1={remoteL1 ?? null}
                name={remoteL1?.name ?? 'Remote chain'}
                detail={remote?.address ? `TokenRemote ${truncateAddress(remote.address)}` : undefined}
              />
            }
            to={
              <RouteEnd
                side="Receives · Home"
                l1={homeL1 ?? null}
                name={homeL1?.name ?? 'Home chain'}
                detail={bridge?.homeAddress ? `TokenHome ${truncateAddress(bridge.homeAddress)}` : undefined}
              />
            }
          />

          <Timeline label="Registration progress">
            <TimelineStep
              index={1}
              label={`Submit tx on ${remoteL1?.name ?? 'Remote'}`}
              state={localTxConfirmed ? 'complete' : isRegistering ? 'active' : 'idle'}
              detail={
                localTxConfirmed ? (
                  <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                    {truncateAddress((submittedTx ?? lastTxHash) as Address)}
                  </code>
                ) : (
                  'Calls registerWithHome on the Remote contract.'
                )
              }
              href={txUrl}
            />
            <TimelineStep index={2} label="ICM relays the message" state={rowTwoState} detail={rowTwoDetail} />
            <TimelineStep
              index={3}
              label={`${homeL1?.name ?? 'Home'} marks the Remote registered`}
              state={rowThreeState}
              detail={rowThreeDetail}
            />
          </Timeline>

          {isTimeout && (
            <Alert variant="warning">
              The relayer didn&apos;t deliver in {Math.round((pollMaxAttempts * 4) / 60)} minutes. Re-send the
              registration; the TokenRemote stays valid.
            </Alert>
          )}

          {error && <Alert variant="error">{error.message}</Alert>}
        </div>
      </Inspector>
    </ContractDeployViewer>
  );
}

type RowState = TimelineState;
