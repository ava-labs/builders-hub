'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { loadIdentity } from '@/lib/eerc/identity';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { listKnownChains } from '@/lib/eerc/deployments';
import { Rise } from '@/components/explorer-v2/ui';
import { EERCStepNav } from '../shared/EERCStepNav';
import { HeroCard } from './HeroCard';
import { EncryptedBalanceCard } from './EncryptedBalanceCard';
import { CompareCard } from './CompareCard';
import { RecentActivityCard } from './RecentActivityCard';

/**
 * Encrypted-ERC overview hub: the tool tabs, a headline with the next action
 * and on-chain status, the journey track, then the user's encrypted balance
 * next to their recent activity, and the public-vs-encrypted explainer.
 *
 * Data wiring stays here because it spans every card: address → hero,
 * registration → status strip, balance → balance card + journey "deposit"
 * tick, deployment & auditor → status strip.
 */
function Overview() {
  const { address } = useAccount();
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  // Pick whichever mode the connected chain has so the deposit tick
  // green-lights against the deployment the user can actually interact
  // with (deposit/withdraw routes are converter-only). On Fuji both
  // deployments share a Registrar so converter is preferred.
  const balanceDeployment = converter.deployment ?? standalone.deployment;
  const balanceMode: 'standalone' | 'converter' = converter.deployment ? 'converter' : 'standalone';
  const balanceToken = balanceMode === 'converter' ? converter.deployment?.supportedTokens?.[0] : undefined;
  const balance = useEERCBalance(balanceDeployment, balanceMode, balanceToken);

  // `useEERCRegistration` reads `Registrar.getUserPublicKey` so the
  // journey only ticks "register" once the on-chain pubkey is set — not
  // when the user has merely derived a key locally.
  const reg = useEERCRegistration(deployment);
  const isRegistered = reg.status === 'registered';

  // `refresh` is wrapped in `useCallback` inside the hook with
  // `[publicClient, deployment]` as its deps, so including it here is stable.
  const auditor = useEERCAuditorAndTokenId(balanceDeployment, balanceToken?.address);
  const auditorRefresh = auditor.refresh;
  useEffect(() => {
    if (balanceDeployment) auditorRefresh();
  }, [balanceDeployment, auditorRefresh]);

  // `hasIdentity` reflects the localStorage cache, used purely for the
  // "key cached" hint. Re-resolved whenever the registration hook reports
  // a new identity in case the user just registered.
  const [hasIdentity, setHasIdentity] = useState(false);
  useEffect(() => {
    if (!address || !deployment) {
      setHasIdentity(false);
      return;
    }
    const cached = loadIdentity(address, deployment.registrar);
    setHasIdentity(cached !== null);
  }, [address, deployment, reg.identity]);

  const stepsDone = useMemo(() => {
    const set = new Set<string>();
    if (address) set.add('connect');
    if (isRegistered) set.add('register');
    if (balance.decryptedCents && balance.decryptedCents > 0n) set.add('deposit');
    return set;
  }, [address, isRegistered, balance.decryptedCents]);

  const walletChainId = useWalletStore((s) => s.walletChainId);
  const known = listKnownChains();
  const chainEntry = known.find((k) => k.chainId === walletChainId && k.modes.length > 0) ?? null;
  const isOnConnectedChain = Boolean(chainEntry);

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <EERCStepNav />

      <div className="flex flex-col gap-8">
        <Rise>
          <HeroCard
            address={address}
            isRegistered={isRegistered}
            hasIdentity={hasIdentity}
            stepsDone={stepsDone}
            chainName={chainEntry?.chainName ?? null}
            chainId={chainEntry?.chainId ?? walletChainId}
            isOnConnectedChain={isOnConnectedChain}
            auditorAddress={auditor.auditorAddress}
            auditorLoading={auditor.isLoading}
          />
        </Rise>

        <Rise delay={0.06} className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-5">
          <EncryptedBalanceCard
            className="lg:col-span-2"
            address={address}
            isRegistered={isRegistered}
            isOnConnectedChain={isOnConnectedChain}
            balance={balance}
            mode={balanceMode}
            tokenSymbol={balanceToken?.symbol ?? null}
          />
          <RecentActivityCard className="lg:col-span-3" />
        </Rise>

        <Rise delay={0.12}>
          <CompareCard />
        </Rise>
      </div>
    </div>
  );
}

export default Overview;
