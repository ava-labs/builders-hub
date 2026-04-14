import { type StepDefinition } from '@/components/console/step-flow';
import { type QuestionnaireAnswers } from '@/components/toolbox/stores/createL1FlowStore';

// Layer-1 creation steps (P-Chain)
import CreateSubnet from '@/components/toolbox/console/layer-1/create/CreateSubnet';
import CreateChain from '@/components/toolbox/console/layer-1/create/CreateChain';
import ConvertSubnetToL1 from '@/components/toolbox/console/layer-1/create/ConvertSubnetToL1';

// Permissioned validator manager steps (PoA)
import DeployValidatorManager from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager';
import ProxySetup from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ProxySetup';
import Initialize from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/Initialize';
import InitValidatorSet from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/InitValidatorSet';

/**
 * Generates a linear step sequence based on questionnaire answers.
 *
 * Two primary orderings depending on VM location:
 *
 * VM on L1 (recommended):
 *   1. Create Subnet (P-Chain)
 *   2. Create Chain (P-Chain, includes Genesis Builder)
 *   3. Convert to L1 (P-Chain, uses predeployed proxy address from genesis)
 *   4. Deploy ValidatorManager implementation (EVM on L1)
 *   5. Proxy Setup — upgrade proxy to point at implementation (EVM on L1)
 *   6. Initialize ValidatorManager (EVM on L1)
 *   7. Init Validator Set (EVM on L1)
 *
 * VM on C-Chain:
 *   1. Create Subnet (P-Chain)
 *   2. Deploy ValidatorManager on C-Chain (EVM)
 *   3. Proxy Setup on C-Chain (EVM) — point proxy to VM implementation
 *   4. Initialize ValidatorManager on C-Chain (EVM)
 *   5. Create Chain (P-Chain) — genesis
 *   6. Convert to L1 (P-Chain, uses C-Chain VM address)
 *   7. Init Validator Set on C-Chain (EVM)
 */
export function generateCreateL1Steps(answers: QuestionnaireAnswers): StepDefinition[] {
  const steps: StepDefinition[] = [];

  // Step 1: Create Subnet (skip if converting existing)
  if (answers.startingPoint === 'new') {
    steps.push({
      type: 'single',
      key: 'create-subnet',
      title: 'Create Subnet',
      component: CreateSubnet,
    });
  }

  if (answers.vmLocation === 'l1') {
    // --- VM on L1 path ---
    // Genesis Builder + Create Chain (genesis includes predeployed proxy)
    steps.push({
      type: 'single',
      key: 'create-chain',
      title: 'Create Chain',
      component: CreateChain,
    });

    // Convert to L1
    steps.push({
      type: 'single',
      key: 'convert-to-l1',
      title: 'Convert to L1',
      component: ConvertSubnetToL1,
    });

    // Deploy VM implementation on L1
    steps.push({
      type: 'single',
      key: 'deploy-validator-manager',
      title: 'Deploy Validator Manager',
      component: DeployValidatorManager,
    });

    // Upgrade genesis proxy to point at implementation
    steps.push({
      type: 'single',
      key: 'proxy-setup',
      title: 'Proxy Setup',
      component: ProxySetup,
    });

    // Initialize the validator manager
    steps.push({
      type: 'single',
      key: 'initialize-manager',
      title: 'Initialize Manager',
      component: Initialize,
    });

    // Init validator set
    steps.push({
      type: 'single',
      key: 'init-validator-set',
      title: 'Initialize Validator Set',
      component: InitValidatorSet,
    });
  } else {
    // --- VM on C-Chain path ---
    // Deploy VM on C-Chain first
    steps.push({
      type: 'single',
      key: 'deploy-validator-manager',
      title: 'Deploy Validator Manager',
      component: DeployValidatorManager,
    });

    // Deploy/upgrade proxy on C-Chain
    steps.push({
      type: 'single',
      key: 'proxy-setup',
      title: 'Proxy Setup',
      component: ProxySetup,
    });

    // Initialize on C-Chain (before creating chain)
    steps.push({
      type: 'single',
      key: 'initialize-manager',
      title: 'Initialize Manager',
      component: Initialize,
    });

    // Now create the chain with genesis
    steps.push({
      type: 'single',
      key: 'create-chain',
      title: 'Create Chain',
      component: CreateChain,
    });

    // Convert to L1 using C-Chain address
    steps.push({
      type: 'single',
      key: 'convert-to-l1',
      title: 'Convert to L1',
      component: ConvertSubnetToL1,
    });

    // Init validator set on C-Chain
    steps.push({
      type: 'single',
      key: 'init-validator-set',
      title: 'Initialize Validator Set',
      component: InitValidatorSet,
    });
  }

  return steps;
}

/**
 * Returns a human-readable label for each step key, used in the preview.
 */
export function getStepLabel(key: string): string {
  const labels: Record<string, string> = {
    'create-subnet': 'Create Subnet (P-Chain)',
    'create-chain': 'Create Chain (P-Chain + Genesis)',
    'convert-to-l1': 'Convert to L1 (P-Chain)',
    'deploy-validator-manager': 'Deploy Validator Manager (EVM)',
    'proxy-setup': 'Proxy Setup (EVM)',
    'initialize-manager': 'Initialize Validator Manager (EVM)',
    'init-validator-set': 'Initialize Validator Set (EVM)',
  };
  return labels[key] ?? key;
}
