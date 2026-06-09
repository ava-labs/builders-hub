import { type StepDefinition } from '@/components/console/step-flow';
import SelectL1ForUpgrade from '@/components/toolbox/console/layer-1/upgrade/SelectL1ForUpgrade';
import UpgradeJsonBuilder from '@/components/toolbox/console/layer-1/upgrade/UpgradeJsonBuilder';
import { getL1UpgradeStore } from '@/components/toolbox/stores/l1UpgradeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { validateL1UpgradeSelection } from '@/lib/console/l1-upgrade-selection';

function hasValidUpgradeSelection() {
  if (typeof window === 'undefined') return true;
  const { isTestnet } = useWalletStore.getState();
  const selection = getL1UpgradeStore(Boolean(isTestnet)).getState();
  return validateL1UpgradeSelection(selection).length === 0;
}

export const steps: StepDefinition[] = [
  {
    type: 'single',
    key: 'select-l1',
    title: 'Select L1',
    component: SelectL1ForUpgrade,
    canProceed: hasValidUpgradeSelection,
  },
  {
    type: 'single',
    key: 'upgrade-json',
    title: 'Upgrade JSON',
    component: UpgradeJsonBuilder,
  },
];
