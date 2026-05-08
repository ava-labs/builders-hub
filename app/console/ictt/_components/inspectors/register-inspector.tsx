'use client';

import { useState } from 'react';
import { zeroAddress } from 'viem';
import ERC20TokenRemoteABI from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorPanel } from '../inspector-panel';
import { ChainMismatchBanner } from './preflight-banner';
import { relativeTime } from '../relative-time';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

interface RegisterInspectorProps {
  bridge: BridgeState;
  accent: string;
  onClose: () => void;
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
  onClose,
  onAdvance,
  appendActivity,
  switchChain,
}: RegisterInspectorProps) {
  const walletClient = useResolvedWalletClient();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    if (!walletClient?.account || !viemChain) {
      setError('Wallet not connected');
      return;
    }
    if (!bridge.remoteAddress || !bridge.remoteChain) {
      setError('Deploy TokenRemote first');
      return;
    }
    if (walletChainId !== bridge.remoteChain.evmChainId) {
      setError(`Switch wallet to ${bridge.remoteChain.name} first`);
      return;
    }

    setIsRegistering(true);
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client for destination');

      const feeInfo: readonly [`0x${string}`, bigint] = [zeroAddress, 0n];
      const { request } = await client.simulateContract({
        address: bridge.remoteAddress as `0x${string}`,
        abi: ERC20TokenRemoteABI.abi,
        functionName: 'registerWithHome',
        args: [feeInfo],
        chain: viemChain,
        account: walletClient.account,
      });

      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Register With Home' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });

      appendActivity({
        kind: 'register',
        label: `Remote → Home register message sent (${bridge.remoteChain.name} → ${bridge.homeChain?.name ?? 'home'})`,
        txHash: hash,
        chainId: viemChain.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Register failed';
      setError(msg);
      appendActivity({ kind: 'error', label: `Register failed: ${msg}` });
    } finally {
      setIsRegistering(false);
    }
  };

  const elapsed = bridge.lastChecked ? relativeTime(bridge.lastChecked) : '—';
  const onSwitchToRemote = bridge.remoteChain
    ? () => switchChain(bridge.remoteChain!.evmChainId, !!bridge.remoteChain!.isTestnet)
    : undefined;

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
      onClose={onClose}
      preflight={
        bridge.remoteChain ? (
          <ChainMismatchBanner
            expectedChain={bridge.remoteChain}
            walletChainId={walletChainId}
            onSwitch={onSwitchToRemote}
          />
        ) : null
      }
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
          Remote is registered with Home. Collateral status: {bridge.collateralNeeded === 0n ? 'fully funded' : `needs ${bridge.collateralNeeded.toString()} more`}.
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
