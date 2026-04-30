import type { StepDefinition } from '@/components/console/step-flow';
// Named export only — the default export is wrapped with
// withConsoleToolMetadata which re-renders <Container> + <CheckRequirements>.
// Inside a step-flow that produces duplicated chrome and runs the wallet
// requirements gate twice.
import { Register } from '@/components/toolbox/console/encrypted-erc/Register';

export const steps: StepDefinition[] = [
  { type: 'single', key: 'derive-and-register', title: 'Register Keys', component: Register, requiredChain: 'c-chain' },
];
