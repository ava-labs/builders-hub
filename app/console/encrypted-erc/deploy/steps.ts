import type { StepDefinition } from '@/components/console/step-flow';
import ConfigureStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/ConfigureStep';
import DeployLibraryStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/DeployLibraryStep';
import DeployVerifiersStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/DeployVerifiersStep';
import DeployRegistrarStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/DeployRegistrarStep';
import DeployEERCStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/DeployEERCStep';
import FinalizeStep from '@/components/toolbox/console/encrypted-erc/deploy/steps/FinalizeStep';

export const steps: StepDefinition[] = [
  { type: 'single', key: 'configure', title: 'Configure', component: ConfigureStep },
  { type: 'single', key: 'deploy-library', title: 'Deploy BabyJubJub', component: DeployLibraryStep },
  { type: 'single', key: 'deploy-verifiers', title: 'Deploy Verifiers', component: DeployVerifiersStep },
  { type: 'single', key: 'deploy-registrar', title: 'Deploy Registrar', component: DeployRegistrarStep },
  { type: 'single', key: 'deploy-eerc', title: 'Deploy EncryptedERC', component: DeployEERCStep },
  { type: 'single', key: 'finalize', title: 'Register + Set Auditor', component: FinalizeStep },
];
