'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useEERCDeployment } from '@/hooks/eerc/useEERCDeployment';
import { useEERCBalance } from '@/hooks/eerc/useEERCBalance';
import { useEERCRegistration } from '@/hooks/eerc/useEERCRegistration';
import { loadIdentity } from '@/lib/eerc/identity';
import { boardContainer, boardItem } from '@/components/console/motion';
import { EERCStepNav } from '../shared/EERCStepNav';
import { EERCKeyframes } from '../shared/EERCKeyframes';
import { HeroCard } from './HeroCard';
import { JourneyCard } from './JourneyCard';
import { CanonicalDeploymentCard } from './CanonicalDeploymentCard';
import { CompareCard } from './CompareCard';
import { RecentActivityCard } from './RecentActivityCard';

/**
 * Encrypted-ERC overview hub.
 *
 * The previous monolith (~1k lines) doubled as both layout and component
 * library, duplicating `EERCStepNav` inline and shipping its own copies
 * of the accent / status maps and keyframes. After Task 5 the page is a
 * thin orchestrator: each card lives in its own file under `Overview/*`,
 * styles + animations are sourced from `shared/eerc-step-styles.ts` and
 * `shared/EERCKeyframes.tsx`, and the cross-tool nav is the same
 * `<EERCStepNav />` rendered on every leaf page.
 *
 * Data wiring stays in this file because it spans every card: address →
 * hero / journey, registration status → journey "register" tick, balance
 * → "deposit" tick, deployment → CanonicalDeploymentCard. Cards remain
 * presentational so a future redesign can rearrange the grid without
 * touching the hooks.
 */
function Overview() {
  const { address } = useAccount();
  const standalone = useEERCDeployment('standalone');
  const converter = useEERCDeployment('converter');
  const deployment = standalone.deployment ?? converter.deployment;

  // Pick whichever mode the connected chain has so the Journey "deposit"
  // tick green-lights against the deployment the user can actually
  // interact with (the deposit/withdraw routes are converter-only). On
  // Fuji both deployments share a Registrar so converter is preferred.
  const balanceDeployment = converter.deployment ?? standalone.deployment;
  const balanceMode: 'standalone' | 'converter' = converter.deployment ? 'converter' : 'standalone';
  const balanceToken = balanceMode === 'converter' ? converter.deployment?.supportedTokens?.[0] : undefined;
  const balance = useEERCBalance(balanceDeployment, balanceMode, balanceToken);

  // `useEERCRegistration` reads `Registrar.getUserPublicKey` so the
  // Journey card only ticks "register" once the on-chain pubkey is set —
  // not when the user has merely derived a key locally.
  const reg = useEERCRegistration(deployment);
  const isRegistered = reg.status === 'registered';

  // `hasIdentity` reflects the localStorage cache, used purely for the
  // hero "BJJ cached" badge. We re-resolve it whenever the registration
  // hook reports a new identity in case the user just registered.
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

  return (
    <div className="relative -m-4 md:-m-8 p-4 md:p-8">
      <EERCKeyframes />

      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(148 163 184 / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(148 163 184 / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      <motion.div className="relative max-w-6xl mx-auto" variants={boardContainer} initial="hidden" animate="visible">
        {/* Row 1 — hero spans the full width */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardItem}>
          <HeroCard address={address} isRegistered={isRegistered} hasIdentity={hasIdentity} />
        </motion.div>

        {/* Row 2 — journey progress + canonical deployment context */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3" variants={boardContainer}>
          <JourneyCard className="md:col-span-4" stepsDone={stepsDone} />
          <CanonicalDeploymentCard className="md:col-span-2" />
        </motion.div>

        {/* Row 3 — same step nav as every leaf tool page (no inline duplicate) */}
        <motion.div className="mb-3" variants={boardItem}>
          <EERCStepNav />
        </motion.div>

        {/* Row 4 — teaching aid (CompareCard) + live tx history */}
        <motion.div className="grid grid-cols-1 md:grid-cols-6 gap-3" variants={boardContainer}>
          <CompareCard className="md:col-span-3" />
          <RecentActivityCard className="md:col-span-3" />
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Overview;
