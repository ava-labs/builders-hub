'use client';

import CreateL1Questionnaire from '@/components/toolbox/console/create-l1/CreateL1Questionnaire';
import { CheckRequirements } from '@/components/toolbox/components/CheckRequirements';
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';

export default function Page() {
  return (
    <CheckRequirements toolRequirements={[WalletRequirementsConfigKey.WalletConnected]}>
      <CreateL1Questionnaire />
    </CheckRequirements>
  );
}
