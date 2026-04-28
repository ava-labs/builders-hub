'use client';

import { Suspense } from 'react';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { AccountRequirementsConfigKey } from '@/components/toolbox/hooks/useAccountRequirements';
import { DashboardBody } from './_components/DashboardBody';
import { HeaderSkeleton } from './_components/states';

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
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <MyL1DashboardInner />
    </Suspense>
  );
}
