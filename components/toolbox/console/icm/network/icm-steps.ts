import { type StepDefinition } from '@/components/console/step-flow';
import { MessengerStep, RegistryStep, RelayerStep, DemoStep, LiveStep } from './inspectors/wrappers';

export const ICM_BASE_PATH = '/console/icm';

export const icmSteps: StepDefinition[] = [
  {
    type: 'single',
    key: 'messenger',
    title: 'Messenger',
    component: MessengerStep,
  },
  {
    type: 'single',
    key: 'registry',
    title: 'Registry',
    component: RegistryStep,
  },
  {
    type: 'single',
    key: 'relayer',
    title: 'Relayer',
    component: RelayerStep,
  },
  {
    type: 'single',
    key: 'demo',
    title: 'Demo',
    component: DemoStep,
  },
  {
    type: 'single',
    key: 'live',
    title: 'Live',
    component: LiveStep,
  },
];

export const ICM_STEP_KEYS = icmSteps.map((s) => s.key) as ReadonlyArray<string>;

export function isValidIcmStep(value: string | undefined | null): value is (typeof ICM_STEP_KEYS)[number] {
  return Boolean(value && ICM_STEP_KEYS.includes(value));
}
