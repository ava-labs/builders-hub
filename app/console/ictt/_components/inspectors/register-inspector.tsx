'use client';

import { useState } from 'react';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { useRegisterRemote } from '@/components/toolbox/console/ictt/hooks/useRegisterRemote';
import { InspectorPanel } from '../inspector-panel';
import { usePreflight } from '../use-preflight';
import { useKeyboardSubmit } from '../use-keyboard-submit';
import { relativeTime } from '../relative-time';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

interface RegisterInspectorProps {
  bridge: BridgeState;
  accent: string;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Register phase: send a registerWithHome ICM message from the remote
 * contract back to the home contract. The home then sees a CollateralAdded
 * event with collateralNeeded > 0, after which the bridge moves to the
 * Collateral phase.
 *
 * The action must be sent from the *destination* (remote) chain. Polling
 * for the registered flag is done by `useBridgeState` — it'll flip the
 * phase to `done` when the home confirms registration.
 */
export function RegisterInspector({
  bridge,
  accent,
  onAdvance,
  appendActivity,
  switchChain,
}: RegisterInspectorProps) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { run: runRegister, isRegistering, error: registerError } = useRegisterRemote();
  const { banner: preflight } = usePreflight({ expectedChain: bridge.remoteChain, switchChain });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRegister = async () => {
    setLocalError(null);
    if (!bridge.remoteAddress || !bridge.remoteChain) {
      setLocalError('Deploy TokenRemote first');
      return;
    }
    if (walletChainId !== bridge.remoteChain.evmChainId) {
      setLocalError(`Switch wallet to ${bridge.remoteChain.name} first`);
      return;
    }

    try {
      const result = await runRegister({ remoteAddress: bridge.remoteAddress });
      appendActivity({
        kind: 'register',
        label: `Remote → Home register message sent (${bridge.remoteChain.name} → ${
          bridge.homeChain?.name ?? 'home'
        })`,
        txHash: result.hash,
        chainId: viemChain?.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Register failed';
      appendActivity({ kind: 'error', label: `Register failed: ${msg}` });
    }
  };

  const elapsed = bridge.lastChecked ? relativeTime(bridge.lastChecked) : '—';
  const error = localError || registerError;
  // Cmd+Enter submits the active primary action: "Continue" when the
  // bridge is registered, otherwise "Send ICM register message".
  const canSubmit = bridge.registered || (!!bridge.remoteAddress && !isRegistering);
  useKeyboardSubmit({
    onSubmit: bridge.registered ? onAdvance : handleRegister,
    enabled: canSubmit,
  });

  return (
    <InspectorPanel
      phase="register"
      accent={accent}
      title="Register Remote with Home"
      description="Sends an ICM message from the Remote contract to the Home contract announcing itself. Wait ~30s for delivery."
      meta={
        bridge.registered
          ? `Registered. Last polled ${elapsed} ago.`
          : `One-way trip. Avg 28s · last polled ${elapsed} ago.`
      }
      showSubmitShortcut={canSubmit}
      primaryAction={
        bridge.registered ? (
          <Button onClick={onAdvance} variant="secondary" stickLeft>
            Continue → Collateral
          </Button>
        ) : (
          <>
            <Button onClick={bridge.refresh} variant="outline" size="sm" stickLeft>
              Check now
            </Button>
            <Button
              onClick={handleRegister}
              loading={isRegistering}
              loadingText="Sending ICM..."
              disabled={!bridge.remoteAddress || isRegistering}
              stickLeft
            >
              Send ICM register message →
            </Button>
          </>
        )
      }
      preflight={preflight}
    >
      <Input
        label="From (Remote address)"
        value={bridge.remoteAddress ?? ''}
        disabled
        helperText={`On ${bridge.remoteChain?.name ?? 'remote'}`}
      />
      <Input
        label="To (Home blockchain ID, hex)"
        value={(() => {
          if (!bridge.homeChain?.id) return '';
          try {
            return cb58ToHex(bridge.homeChain.id);
          } catch {
            return bridge.homeChain.id;
          }
        })()}
        disabled
        helperText={`Home contract on ${bridge.homeChain?.name ?? 'home'}: ${bridge.homeAddress ?? '—'}`}
      />

      {bridge.registered && (
        <Note variant="success">
          Remote is registered with Home. Collateral status:{' '}
          {bridge.collateralNeeded === 0n ? 'fully funded' : `needs ${bridge.collateralNeeded.toString()} more`}.
        </Note>
      )}

      {error && (
        <Note variant="destructive">
          <p>{error}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
