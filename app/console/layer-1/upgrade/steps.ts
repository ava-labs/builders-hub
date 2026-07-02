import { type StepDefinition } from '@/components/console/step-flow';
import SelectL1ForUpgrade from '@/components/toolbox/console/layer-1/upgrade/SelectL1ForUpgrade';
import UpgradeJsonBuilder from '@/components/toolbox/console/layer-1/upgrade/UpgradeJsonBuilder';

export const steps: StepDefinition[] = [
  {
    type: 'single',
    key: 'select-l1',
    title: 'Select L1',
    component: SelectL1ForUpgrade,
  },
  {
    type: 'single',
    key: 'upgrade-json',
    title: 'Upgrade JSON',
    component: UpgradeJsonBuilder,
  },
];
