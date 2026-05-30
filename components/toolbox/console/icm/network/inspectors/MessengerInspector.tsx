'use client';

import { useEffect } from 'react';
import TeleporterMessenger from '@/components/toolbox/console/icm/setup/TeleporterMessenger';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import TeleporterMessengerAddress from '@/contracts/icm-contracts-releases/v1.0.0/TeleporterMessenger_Contract_Address_v1.0.0.txt.json';
import type { Address } from '@/components/toolbox/console/icm/network/types';

/**
 * Messenger phase inspector. Wraps the existing `TeleporterMessenger`
 * deploy tool and observes its outcome so the ICM context store is kept
 * up-to-date with the deployment state for the active L1.
 *
 * The probe runs once per (L1, walletChainId) mount and re-fires when the
 * user navigates away and back. It writes `messengerDeployedAt` only when
 * the deterministic contract address actually has bytecode — purely
 * additive, never clears a previously-recorded timestamp.
 */
export function MessengerInspector() {
  const selectedL1 = useSelectedL1();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const upsertChain = useIcmSetupStore((s) => s.upsertChain);
  const setMessengerDeployed = useIcmSetupStore((s) => s.setMessengerDeployed);
  const setLastActiveL1 = useIcmSetupStore((s) => s.setLastActiveL1);
  const chainStatus = useIcmSetupStore((s) => (selectedL1 ? (s.chains[selectedL1.id] ?? null) : null));

  useEffect(() => {
    if (!selectedL1) return;
    setLastActiveL1(selectedL1.id);
    if (!chainStatus) upsertChain(selectedL1.id, {});
  }, [selectedL1, chainStatus, setLastActiveL1, upsertChain]);

  useEffect(() => {
    if (!selectedL1) return;
    if (chainStatus?.messengerDeployedAt) return;
    let cancelled = false;
    const probe = async () => {
      try {
        const client = makePublicClientForChain(selectedL1.rpcUrl);
        if (!client) return;
        const code = await client.getBytecode({
          address: (TeleporterMessengerAddress as { content: string }).content as Address,
        });
        if (cancelled) return;
        if (code && code.length > 2) {
          setMessengerDeployed(selectedL1.id, Date.now());
        }
      } catch {
        // RPC failures are non-fatal — the user can deploy via the tool itself.
      }
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [selectedL1, chainStatus?.messengerDeployedAt, walletChainId, setMessengerDeployed]);

  return <TeleporterMessenger />;
}
