import { type StepDefinition } from '@/components/console/step-flow';
import { type QuestionnaireAnswers } from '@/components/toolbox/stores/createL1FlowStore';

// ── Layer-1 creation (P-Chain) ───────────────────────────────
import CreateSubnet from '@/components/toolbox/console/layer-1/create/CreateSubnet';
import CreateChain from '@/components/toolbox/console/layer-1/create/CreateChain';
import ConvertSubnetToL1 from '@/components/toolbox/console/layer-1/create/ConvertSubnetToL1';

// ── Node hosting ─────────────────────────────────────────────
import AvalancheGoDockerL1 from '@/components/toolbox/console/layer-1/AvalancheGoDockerL1';
import ManagedTestnetNodes from '@/components/toolbox/console/testnet-infra/managed-testnet-nodes/ManagedTestnetNodes';

// ── Validator Manager (PoA foundation) ───────────────────────
import DeployValidatorManager from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager';
import ProxySetup from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ProxySetup';
import Initialize from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/Initialize';
import InitValidatorSet from '@/components/toolbox/console/permissioned-l1s/validator-manager-setup/InitValidatorSet';

// ── Multisig (PoA + C-Chain only) ────────────────────────────
import DeployPoAManager from '@/components/toolbox/console/permissioned-l1s/multisig-setup/DeployPoAManager';
import TransferOwnership from '@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership';

// ── PoS Native staking ──────────────────────────────────────
import NativeDeployStep from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployStep';
import NativeDeployRewardCalcStep from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployRewardCalculatorStep';
import NativeInitializeStep from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/InitializeStep';
import NativeEnableMintingStep from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/EnableMintingStep';
import NativeTransferOwnershipStep from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/TransferOwnershipStep';

// ── PoS ERC20 staking ───────────────────────────────────────
import ERC20DeployTokenStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployERC20TokenStep';
import ERC20DeployStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployStep';
import ERC20DeployRewardCalcStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployRewardCalculatorStep';
import ERC20InitializeStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/InitializeStep';
import ERC20EnableMintingStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/EnableMintingStep';
import ERC20TransferOwnershipStep from '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/TransferOwnershipStep';

// ── ICM Relayer ─────────────────────────────────────────────
import ManagedTestnetRelayers from '@/components/toolbox/console/testnet-infra/managed-testnet-relayers/ManagedTestnetRelayers';

/**
 * Generates a complete deployment flow based on questionnaire answers.
 *
 * Question order:
 *   Q1: Starting point (new / convert existing)
 *   Q2: Validator management (PoA / PoS Native / PoS ERC20)
 *   Q3: VM location (L1 / C-Chain)
 *   Q4: Ownership (multisig — PoA + C-Chain only)
 *   Q5: Hosting (managed / docker)
 */
export function generateCreateL1Steps(answers: QuestionnaireAnswers): StepDefinition[] {
  const steps: StepDefinition[] = [];

  // ── Phase 1: Chain creation ────────────────────────────────

  const evmChain = answers.vmLocation === 'l1' ? ('l1' as const) : ('c-chain' as const);
  const isNew = answers.startingPoint === 'new';

  if (isNew) {
    // ── New L1 from scratch ────────────────────────────────
    steps.push({
      type: 'single',
      key: 'create-subnet',
      title: 'Create Subnet',
      component: CreateSubnet,
      requiredChain: 'p-chain',
    });

    // Node hosting — before Convert to L1 (nodes must be running)
    if (answers.hosting === 'managed') {
      steps.push({
        type: 'single',
        key: 'managed-nodes',
        title: 'Setup Managed Nodes',
        component: ManagedTestnetNodes,
        requiredChain: 'any',
      });
    } else if (answers.hosting === 'docker') {
      steps.push({
        type: 'single',
        key: 'docker-setup',
        title: 'Docker Node Setup',
        component: AvalancheGoDockerL1,
        requiredChain: 'any',
      });
    }

    if (answers.vmLocation === 'l1') {
      // VM on L1: chain (genesis has proxy) → convert → deploy on L1
      steps.push({
        type: 'single',
        key: 'create-chain',
        title: 'Create Chain',
        component: CreateChain,
        requiredChain: 'p-chain',
      });
      steps.push({
        type: 'single',
        key: 'convert-to-l1',
        title: 'Convert to L1',
        component: ConvertSubnetToL1,
        requiredChain: 'p-chain',
      });
      steps.push({
        type: 'single',
        key: 'deploy-validator-manager',
        title: 'Deploy Validator Manager',
        component: DeployValidatorManager,
        requiredChain: 'l1',
      });
      steps.push({
        type: 'single',
        key: 'proxy-setup',
        title: 'Proxy Setup',
        component: ProxySetup,
        requiredChain: 'l1',
      });
      steps.push({
        type: 'single',
        key: 'initialize-manager',
        title: 'Initialize Validator Manager',
        component: Initialize,
        requiredChain: 'l1',
      });
      steps.push({
        type: 'single',
        key: 'init-validator-set',
        title: 'Initialize Validator Set',
        component: InitValidatorSet,
        requiredChain: 'l1',
      });
    } else {
      // VM on C-Chain: deploy + init on C-Chain → chain → convert → init set
      steps.push({
        type: 'single',
        key: 'deploy-validator-manager',
        title: 'Deploy Validator Manager',
        component: DeployValidatorManager,
        requiredChain: 'c-chain',
      });
      steps.push({
        type: 'single',
        key: 'proxy-setup',
        title: 'Proxy Setup',
        component: ProxySetup,
        requiredChain: 'c-chain',
      });
      steps.push({
        type: 'single',
        key: 'initialize-manager',
        title: 'Initialize Validator Manager',
        component: Initialize,
        requiredChain: 'c-chain',
      });
      steps.push({
        type: 'single',
        key: 'create-chain',
        title: 'Create Chain',
        component: CreateChain,
        requiredChain: 'p-chain',
      });
      steps.push({
        type: 'single',
        key: 'convert-to-l1',
        title: 'Convert to L1',
        component: ConvertSubnetToL1,
        requiredChain: 'p-chain',
      });
      steps.push({
        type: 'single',
        key: 'init-validator-set',
        title: 'Initialize Validator Set',
        component: InitValidatorSet,
        requiredChain: 'c-chain',
      });
    }
  } else {
    // ── Convert existing subnet ────────────────────────────
    // They already have a chain running with nodes. Just need:
    // deploy VM → setup → convert → init validator set
    steps.push({
      type: 'single',
      key: 'deploy-validator-manager',
      title: 'Deploy Validator Manager',
      component: DeployValidatorManager,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'proxy-setup',
      title: 'Proxy Setup',
      component: ProxySetup,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'initialize-manager',
      title: 'Initialize Validator Manager',
      component: Initialize,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'convert-to-l1',
      title: 'Convert to L1',
      component: ConvertSubnetToL1,
      requiredChain: 'p-chain',
    });
    steps.push({
      type: 'single',
      key: 'init-validator-set',
      title: 'Initialize Validator Set',
      component: InitValidatorSet,
      requiredChain: evmChain,
    });
  }

  // ── Phase 2: PoS Staking Manager (same chain as VM) ──────

  if (answers.validatorType === 'pos-native') {
    steps.push({
      type: 'single',
      key: 'deploy-native-staking',
      title: 'Deploy Native Staking Manager',
      component: NativeDeployStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'deploy-reward-calculator',
      title: 'Deploy Reward Calculator',
      component: NativeDeployRewardCalcStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'initialize-staking',
      title: 'Initialize Staking Manager',
      component: NativeInitializeStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'enable-minting',
      title: 'Enable Minting',
      component: NativeEnableMintingStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'transfer-to-staking',
      title: 'Transfer Ownership → Staking Manager',
      component: NativeTransferOwnershipStep,
      requiredChain: evmChain,
    });
  }

  if (answers.validatorType === 'pos-erc20') {
    steps.push({
      type: 'single',
      key: 'deploy-erc20-token',
      title: 'Deploy ERC20 Token (Optional)',
      component: ERC20DeployTokenStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'deploy-erc20-staking',
      title: 'Deploy ERC20 Staking Manager',
      component: ERC20DeployStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'deploy-reward-calculator',
      title: 'Deploy Reward Calculator',
      component: ERC20DeployRewardCalcStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'initialize-staking',
      title: 'Initialize Staking Manager',
      component: ERC20InitializeStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'enable-minting',
      title: 'Enable Minting',
      component: ERC20EnableMintingStep,
      requiredChain: evmChain,
    });
    steps.push({
      type: 'single',
      key: 'transfer-to-staking',
      title: 'Transfer Ownership → Staking Manager',
      component: ERC20TransferOwnershipStep,
      requiredChain: evmChain,
    });
  }

  // ── Phase 3: Multisig (PoA + C-Chain only) ─────────────────

  if (answers.multisig && answers.validatorType === 'poa' && answers.vmLocation === 'c-chain') {
    steps.push({
      type: 'single',
      key: 'deploy-poa-manager',
      title: 'Deploy PoA Manager (Multisig)',
      component: DeployPoAManager,
    });
    steps.push({
      type: 'single',
      key: 'transfer-ownership',
      title: 'Transfer Ownership',
      component: TransferOwnership,
    });
  }

  // ── Phase 4: ICM Relayer ───────────────────────────────────

  if (answers.hosting === 'managed') {
    steps.push({
      type: 'single',
      key: 'managed-relayer',
      title: 'Setup Managed Relayer',
      component: ManagedTestnetRelayers,
    });
  }

  return steps;
}

/**
 * Human-readable labels for the flow preview.
 */
export function getStepLabel(key: string): string {
  const labels: Record<string, string> = {
    // Chain creation
    'create-subnet': 'Create Subnet',
    'create-chain': 'Create Chain + Genesis',
    'convert-to-l1': 'Convert to L1',
    // Node hosting
    'managed-nodes': 'Setup Managed Nodes',
    'docker-setup': 'Docker Node Setup',
    // Validator Manager
    'deploy-validator-manager': 'Deploy Validator Manager',
    'proxy-setup': 'Proxy Setup',
    'initialize-manager': 'Initialize Validator Manager',
    'init-validator-set': 'Init Validator Set',
    // PoS Native
    'deploy-native-staking': 'Deploy Native Staking Manager',
    'deploy-reward-calculator': 'Deploy Reward Calculator',
    'initialize-staking': 'Initialize Staking Manager',
    'enable-minting': 'Enable Minting',
    'transfer-to-staking': 'Transfer Ownership → Staking Manager',
    // PoS ERC20
    'deploy-erc20-token': 'Deploy ERC20 Token (Optional)',
    'deploy-erc20-staking': 'Deploy ERC20 Staking Manager',
    // Multisig
    'deploy-poa-manager': 'Deploy PoA Manager (Multisig)',
    'transfer-ownership': 'Transfer Ownership',
    // Relayer
    'managed-relayer': 'Setup Managed Relayer',
  };
  return labels[key] ?? key;
}
