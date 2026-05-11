'use client';

import { useRouter } from 'next/navigation';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useBridgeContext } from '../hooks/useBridgeContext';
import type { BridgePhase } from '../types';
import { PhaseChainGate } from '../PhaseChainGate';
import { TokenInspector } from './TokenInspector';
import { HomeInspector } from './HomeInspector';
import { RemoteInspector } from './RemoteInspector';
import { RegisterInspector } from './RegisterInspector';
import { CollateralInspector } from './CollateralInspector';
import { LiveInspector } from './LiveInspector';

function useStepNavigator() {
  const router = useRouter();
  return (next: BridgePhase) => router.push(`/console/ictt/${next}`);
}

/** Phases that act on the Home chain require the wallet to be on that chain. */
function useHomeChainGate(ctx: ReturnType<typeof useBridgeContext>) {
  const selectedL1 = useSelectedL1();
  const target = ctx.homeL1 ?? selectedL1 ?? null;
  // Pass the full L1 down to PhaseChainGate so it can fall back to
  // wallet_addEthereumChain when the wallet doesn't have this chain yet.
  return { requiredL1: target };
}

export function TokenStep() {
  const ctx = useBridgeContext({ step: 'token' });
  const navigate = useStepNavigator();
  const { requiredL1 } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredL1={requiredL1}>
      <TokenInspector
        onPhaseChange={navigate}
        underlyingTokenAddress={ctx.effectiveTokenAddress}
        onTokenSelected={ctx.setPendingTokenAddress}
        bridge={ctx.bridge}
        onStartNewBridge={ctx.startNewBridge}
        newBridgeIntent={ctx.newBridgeIntent}
      />
    </PhaseChainGate>
  );
}

export function HomeStep() {
  const ctx = useBridgeContext({ step: 'home' });
  const navigate = useStepNavigator();
  const { requiredL1 } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredL1={requiredL1}>
      <HomeInspector onPhaseChange={navigate} underlyingTokenAddress={ctx.effectiveTokenAddress} bridge={ctx.bridge} />
    </PhaseChainGate>
  );
}

export function RemoteStep() {
  const ctx = useBridgeContext({ step: 'remote' });
  const navigate = useStepNavigator();
  // Phase 3 deliberately skips PhaseChainGate at the wrapper level — the
  // destination dropdown must remain visible so the user can pick a different
  // L1 even when their wallet is on the wrong chain. The inspector itself
  // handles auto-switch + gates the deploy action.
  return <RemoteInspector onPhaseChange={navigate} bridge={ctx.bridge} remote={ctx.remote} />;
}

export function RegisterStep() {
  const ctx = useBridgeContext({ step: 'register' });
  const navigate = useStepNavigator();
  return (
    <PhaseChainGate requiredL1={ctx.remoteL1}>
      <RegisterInspector onPhaseChange={navigate} bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}

export function CollateralStep() {
  const ctx = useBridgeContext({ step: 'collateral' });
  const navigate = useStepNavigator();
  const { requiredL1 } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredL1={requiredL1}>
      <CollateralInspector onPhaseChange={navigate} bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}

export function LiveStep() {
  const ctx = useBridgeContext({ step: 'live' });
  const { requiredL1 } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredL1={requiredL1}>
      <LiveInspector bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}
