import { type StepDefinition } from '@/components/console/step-flow';
import { TokenStep, HomeStep, RemoteStep, RegisterStep, CollateralStep, LiveStep } from './inspectors/wrappers';

export const BRIDGE_BASE_PATH = '/console/ictt';

export const bridgeSteps: StepDefinition[] = [
  {
    type: 'single',
    key: 'token',
    title: 'Token',
    optional: true,
    component: TokenStep,
  },
  {
    type: 'single',
    key: 'home',
    title: 'Home',
    component: HomeStep,
  },
  {
    type: 'single',
    key: 'remote',
    title: 'Remote',
    component: RemoteStep,
  },
  {
    type: 'single',
    key: 'register',
    title: 'Register',
    component: RegisterStep,
  },
  {
    type: 'single',
    key: 'collateral',
    title: 'Collateral',
    component: CollateralStep,
  },
  {
    type: 'single',
    key: 'live',
    title: 'Live',
    component: LiveStep,
  },
];

export const BRIDGE_STEP_KEYS = bridgeSteps.map((s) => s.key) as ReadonlyArray<string>;

export function isValidBridgeStep(value: string | undefined | null): value is (typeof BRIDGE_STEP_KEYS)[number] {
  return Boolean(value && BRIDGE_STEP_KEYS.includes(value));
}
