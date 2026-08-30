'use client';

import { Suspense } from 'react';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { AccountRequirementsConfigKey } from '@/components/toolbox/hooks/useAccountRequirements';
import { DashboardBody } from './_components/DashboardBody';

function MyL1DashboardInner() {
  return (
    <CheckRequirements
      toolRequirements={[
        WalletRequirementsConfigKey.WalletConnected,
        AccountRequirementsConfigKey.UserLoggedIn,
      ]}
    >
      <DashboardBody />
    </CheckRequirements>
  );
}

export default function MyL1DashboardPage() {
  // useSearchParams requires Suspense in Next 15+ for static-export safety.
  // The fallback is intentionally null — DashboardBody owns its own skeleton
  // via useLoadedOnce, so a Suspense-level skeleton would render briefly and
  // get swapped for the inner one (double-flash).
  return (
    <Suspense fallback={null}>
      <MyL1DashboardInner />
    </Suspense>
  );
}
