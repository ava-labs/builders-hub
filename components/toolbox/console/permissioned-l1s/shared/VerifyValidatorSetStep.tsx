'use client';

import { QueryL1ValidatorSetInner } from '@/components/toolbox/console/permissioned-l1s/query-l1-validator-set';

/**
 * Final step in validator management flows — shows the current validator set
 * so the user can verify their changes took effect.
 */
export default function VerifyValidatorSetStep() {
  return <QueryL1ValidatorSetInner />;
}
