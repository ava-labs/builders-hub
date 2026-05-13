'use client';

import { AutoSwitchChainGate } from '@/components/console/auto-switch-chain-gate';
import { useIcmContext } from '../hooks/useIcmContext';
import { MessengerInspector } from './MessengerInspector';
import { RegistryInspector } from './RegistryInspector';
import { RelayerInspector } from './RelayerInspector';
import { DemoInspector } from './DemoInspector';
import { LiveInspector } from './LiveInspector';

/**
 * Thin step wrappers exposed to `icm-steps.ts`. Each wrapper resolves the
 * active L1 from `useIcmContext` and gates rendering of its inspector
 * behind `AutoSwitchChainGate` so the wallet sits on the right chain
 * before any transaction is requested.
 */

export function MessengerStep() {
  const ctx = useIcmContext({ step: 'messenger' });
  return (
    <AutoSwitchChainGate requiredL1={ctx.activeL1}>
      <MessengerInspector />
    </AutoSwitchChainGate>
  );
}

export function RegistryStep() {
  const ctx = useIcmContext({ step: 'registry' });
  return (
    <AutoSwitchChainGate requiredL1={ctx.activeL1}>
      <RegistryInspector />
    </AutoSwitchChainGate>
  );
}

export function RelayerStep() {
  // The Relayer phase is configuration-only (no on-chain tx on the active
  // L1), so it deliberately skips the chain gate. Funding transactions
  // inside the inspector handle their own chain switches.
  return <RelayerInspector />;
}

export function DemoStep() {
  const ctx = useIcmContext({ step: 'demo' });
  return (
    <AutoSwitchChainGate requiredL1={ctx.activeL1}>
      <DemoInspector />
    </AutoSwitchChainGate>
  );
}

export function LiveStep() {
  const ctx = useIcmContext({ step: 'live' });
  return (
    <AutoSwitchChainGate requiredL1={ctx.activeL1}>
      <LiveInspector />
    </AutoSwitchChainGate>
  );
}
