'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { useEERCAuditorAndTokenId } from '@/hooks/eerc/useEERCAuditorAndTokenId';
import { loadIdentity } from '@/lib/eerc/identity';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { listKnownChains } from '@/lib/eerc/deployments';
import { boardContainer, boardItem } from '@/components/console/motion';
import { EERCKeyframes } from '../shared/EERCKeyframes';
import { HeroCard } from './HeroCard';
import { EncryptedBalanceCard } from './EncryptedBalanceCard';
import { CompareCard } from './CompareCard';
import { RecentActivityCard } from './RecentActivityCard';

/**
 * Encrypted-ERC overview hub.
 *
 * The hero now reads as a small dashboard in its own right: a status
 * row across the top (network · identity · auditor) sits above the
 * title, then the journey stepper sits below the CTAs. Below the hero,
 * an `EncryptedBalanceCard` shows the user's actual on-chain encrypted
 * balance (decrypted client-side via the BJJ identity) next to a tx
 * activity feed; the public-vs-encrypted explainer pins the bottom for
 * first-time visitors.
 *
 * The previous Network card was retired — its information (chain name,
 * deployed modes, token symbol) was already present in the hero status
 * row and the new balance card. Keeping it on the hub would have been
 * duplicate, dashboard-quality real-estate spent on text the user had
 * just read.
 *
 * Data wiring stays here because it spans every card: address → hero,
 * registration → status row, balance → encrypted-balance card +
 * stepper "deposit" tick, deployment & auditor → status row + balance
 * card metadata.
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
  // progress strip only ticks "register" once the on-chain pubkey is
  // set — not when the user has merely derived a key locally.
  const reg = useEERCRegistration(deployment);
  const isRegistered = reg.status === 'registered';

  // Auditor address powers the hero status row. `refresh` is wrapped
  // in `useCallback` inside the hook with `[publicClient, deployment]`
  // as its deps, so including it here is stable.
  const auditor = useEERCAuditorAndTokenId(balanceDeployment, balanceToken?.address);
  const auditorRefresh = auditor.refresh;
  useEffect(() => {
    if (balanceDeployment) auditorRefresh();
  }, [balanceDeployment, auditorRefresh]);

  // `hasIdentity` reflects the localStorage cache, used purely for the
  // hero "BJJ cached" hint. Re-resolved whenever the registration hook
  // reports a new identity in case the user just registered.
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

  // Resolve the chain name for the hero status pill. Pulls from the
  // wallet store first, then falls back to the canonical Fuji entry.
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const known = listKnownChains();
  const chainEntry = known.find((k) => k.chainId === walletChainId && k.modes.length > 0) ?? null;
  const isOnConnectedChain = Boolean(chainEntry);

  return (
    <div className="relative -m-4 md:-m-8 p-4 md:p-8">
      <EERCKeyframes />

      <motion.div className="relative max-w-6xl mx-auto" variants={boardContainer} initial="hidden" animate="visible">
        {/* Row 1 — hero hub: status row + brand + journey stepper */}
        <motion.div className="mb-3" variants={boardItem}>
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
        </motion.div>

        {/* Row 2 — encrypted balance + recent activity. Both cards
            use TileShell's built-in `h-full` and the grid intentionally
            stretches them to a shared height so the row reads as a
            balanced pair. The activity feed will pad with empty space
            below its rows when the balance card is the taller of the
            two. */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardContainer}>
          <EncryptedBalanceCard
            className="md:col-span-2"
            address={address}
            isRegistered={isRegistered}
            isOnConnectedChain={isOnConnectedChain}
            balance={balance}
            mode={balanceMode}
            tokenSymbol={balanceToken?.symbol ?? null}
          />
          <RecentActivityCard className="md:col-span-4" />
        </motion.div>

        {/* Row 3 — teaching aid, full width */}
        <motion.div variants={boardItem}>
          <CompareCard />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Overview;
