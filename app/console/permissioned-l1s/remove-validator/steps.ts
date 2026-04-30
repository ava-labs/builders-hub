import { type StepDefinition } from "@/components/console/step-flow";
import SelectSubnetStep from "@/components/toolbox/console/permissioned-l1s/remove-validator/steps/SelectSubnetStep";
import InitiateRemovalStep from "@/components/toolbox/console/permissioned-l1s/remove-validator/steps/InitiateRemovalStep";
import PChainRemovalStep from "@/components/toolbox/console/permissioned-l1s/remove-validator/steps/PChainRemovalStep";
import CompleteRemovalStep from "@/components/toolbox/console/permissioned-l1s/remove-validator/steps/CompleteRemovalStep";
import VerifyValidatorSetStep from "@/components/toolbox/console/permissioned-l1s/shared/VerifyValidatorSetStep";

export const steps: StepDefinition[] = [
  { type: "single", key: "select-subnet", title: "Select L1 Subnet", component: SelectSubnetStep },
  { type: "single", key: "initiate-removal", title: "Initiate Removal", component: InitiateRemovalStep },
  { type: "single", key: "pchain-removal", title: "P-Chain Weight Update", component: PChainRemovalStep },
  { type: "single", key: "complete-removal", title: "Complete Removal", component: CompleteRemovalStep },
  { type: "single", key: "verify-validator-set", title: "Verify Validator Set", optional: true, component: VerifyValidatorSetStep },
];
