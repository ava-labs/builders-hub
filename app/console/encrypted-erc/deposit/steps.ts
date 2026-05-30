import type { StepDefinition } from '@/components/console/step-flow';
import WrapAvaxStep from '@/components/toolbox/console/encrypted-erc/deposit-steps/WrapAvaxStep';
import DepositStep from '@/components/toolbox/console/encrypted-erc/deposit-steps/DepositStep';

export const steps: StepDefinition[] = [
  { type: 'single', key: 'wrap-avax', title: 'Wrap AVAX', component: WrapAvaxStep, requiredChain: 'c-chain' },
  { type: 'single', key: 'deposit', title: 'Deposit', component: DepositStep, requiredChain: 'c-chain' },
];
