'use client';

import BasicSetupForm from '@/components/toolbox/console/create-l1/basic/BasicSetupForm';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { AccountRequirementsConfigKey } from '@/components/toolbox/hooks/useAccountRequirements';

/**
 * Basic Setup entry — gated behind the shared CheckRequirements guard
 * rather than hand-rolling wallet + testnet + login checks inside the
 * form. This matches every other console tool and keeps the messaging,
 * CTAs, and recovery actions consistent across the app.
 *
 * Requirements:
 *   - WalletConnected: owner defaults to the connected wallet, and the
 *     deploy backend needs a real EVM address from the user.
 *   - TestnetRequired: Basic Setup is Fuji-only for MVP; the
 *     orchestrator rejects mainnet requests anyway.
 *   - UserLoggedIn: every deploy is linked to a Builder Hub account
 *     (quick-l1 /deploy rejects requests without a session-derived
 *     userId — see lib/quick-l1/types.ts).
 */
export default function Page() {
  return (
    <CheckRequirements
      toolRequirements={[
        WalletRequirementsConfigKey.WalletConnected,
        WalletRequirementsConfigKey.TestnetRequired,
        AccountRequirementsConfigKey.UserLoggedIn,
      ]}
    >
      <BasicSetupForm />
    </CheckRequirements>
  );
}
