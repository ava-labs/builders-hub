import { describe, expect, it, vi } from 'vitest';
import { generateCreateL1Steps, getStepLabel } from '@/components/toolbox/console/create-l1/generateSteps';
import type {
  HostingOption,
  QuestionnaireAnswers,
  ValidatorType,
  VMLocation,
} from '@/components/toolbox/stores/createL1FlowStore';

// The step components pull in wallet and chain clients that do not load in the node environment. The labels and
// titles do not depend on them, so each one is a stub.
const { Stub } = vi.hoisted(() => ({ Stub: () => null }));
vi.mock('@/components/toolbox/console/layer-1/create/CreateSubnet', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/layer-1/create/CreateChain', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/layer-1/create/ConvertSubnetToL1', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/layer-1/AvalancheGoDockerL1', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/testnet-infra/managed-testnet-nodes/ManagedTestnetNodes', () => ({
  default: Stub,
}));
vi.mock('@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager', () => ({
  default: Stub,
}));
vi.mock('@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ProxySetup', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/permissioned-l1s/validator-manager-setup/Initialize', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/permissioned-l1s/validator-manager-setup/InitValidatorSet', () => ({
  default: Stub,
}));
vi.mock('@/components/toolbox/console/permissioned-l1s/multisig-setup/DeployPoAManager', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/permissioned-l1s/multisig-setup/TransferOwnership', () => ({ default: Stub }));
vi.mock('@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployStep', () => ({
  default: Stub,
}));
vi.mock(
  '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/DeployRewardCalculatorStep',
  () => ({ default: Stub }),
);
vi.mock('@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/InitializeStep', () => ({
  default: Stub,
}));
vi.mock('@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/EnableMintingStep', () => ({
  default: Stub,
}));
vi.mock(
  '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/TransferOwnershipStep',
  () => ({ default: Stub }),
);
vi.mock(
  '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployERC20TokenStep',
  () => ({ default: Stub }),
);
vi.mock('@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployStep', () => ({
  default: Stub,
}));
vi.mock(
  '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/DeployRewardCalculatorStep',
  () => ({ default: Stub }),
);
vi.mock('@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/InitializeStep', () => ({
  default: Stub,
}));
vi.mock('@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/EnableMintingStep', () => ({
  default: Stub,
}));
vi.mock(
  '@/components/toolbox/console/permissionless-l1s/erc20-staking-manager-setup/steps/TransferOwnershipStep',
  () => ({ default: Stub }),
);
vi.mock('@/components/toolbox/console/testnet-infra/managed-testnet-relayers/ManagedTestnetRelayers', () => ({
  default: Stub,
}));

const validatorTypes: ValidatorType[] = ['poa', 'pos-native', 'pos-erc20'];
const vmLocations: VMLocation[] = ['l1', 'c-chain'];
const hostings: HostingOption[] = ['managed', 'docker'];

const allAnswers: QuestionnaireAnswers[] = validatorTypes.flatMap((validatorType) =>
  vmLocations.flatMap((vmLocation) =>
    hostings.flatMap((hosting) =>
      [false, true].map((multisig) => ({
        startingPoint: 'new' as const,
        validatorType,
        vmLocation,
        multisig,
        hosting,
        interoperability: true,
      })),
    ),
  ),
);

describe('getStepLabel', () => {
  it('uses the step titles for Create Chain and Initialize Validator Set', () => {
    expect(getStepLabel('create-chain')).toBe('Create Chain');
    expect(getStepLabel('init-validator-set')).toBe('Initialize Validator Set');
  });

  it.each(allAnswers)('matches every step title for %o', (answers) => {
    const steps = generateCreateL1Steps(answers);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(getStepLabel(step.key), step.key).toBe(step.title);
    }
  });

  it('returns the key for an unknown step', () => {
    expect(getStepLabel('no-such-step')).toBe('no-such-step');
  });
});
