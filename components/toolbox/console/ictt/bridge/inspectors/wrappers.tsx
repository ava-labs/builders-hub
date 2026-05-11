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
  return {
    requiredChainId: target?.evmChainId ?? null,
    requiredChainName: target?.name ?? null,
  };
}

export function TokenStep() {
  const ctx = useBridgeContext({ step: 'token' });
  const navigate = useStepNavigator();
  const { requiredChainId, requiredChainName } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredChainId={requiredChainId} requiredChainName={requiredChainName}>
      <TokenInspector
        onPhaseChange={navigate}
        underlyingTokenAddress={ctx.effectiveTokenAddress}
        onTokenSelected={ctx.setPendingTokenAddress}
      />
    </PhaseChainGate>
  );
}

export function HomeStep() {
  const ctx = useBridgeContext({ step: 'home' });
  const navigate = useStepNavigator();
  const { requiredChainId, requiredChainName } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredChainId={requiredChainId} requiredChainName={requiredChainName}>
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
    <PhaseChainGate requiredChainId={ctx.remoteL1?.evmChainId ?? null} requiredChainName={ctx.remoteL1?.name ?? null}>
      <RegisterInspector onPhaseChange={navigate} bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}

export function CollateralStep() {
  const ctx = useBridgeContext({ step: 'collateral' });
  const navigate = useStepNavigator();
  const { requiredChainId, requiredChainName } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredChainId={requiredChainId} requiredChainName={requiredChainName}>
      <CollateralInspector onPhaseChange={navigate} bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}

export function LiveStep() {
  const ctx = useBridgeContext({ step: 'live' });
  const { requiredChainId, requiredChainName } = useHomeChainGate(ctx);
  return (
    <PhaseChainGate requiredChainId={requiredChainId} requiredChainName={requiredChainName}>
      <LiveInspector bridge={ctx.bridge} remote={ctx.remote} />
    </PhaseChainGate>
  );
}
