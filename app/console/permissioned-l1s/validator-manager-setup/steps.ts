import { type StepDefinition } from "@/components/console/step-flow";
import DeployProxyContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployProxyContract";
import DeployValidatorManager from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager";
import UpgradeProxy from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/UpgradeProxy";
import Initialize from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/Initialize";
import InitValidatorSet from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/InitValidatorSet";
import ReadContract from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ReadContract";

export const steps: StepDefinition[] = [
    { type: "single", key: "deploy-validator-manager", title: "Deploy Validator Manager", component: DeployValidatorManager },
    { type: "single", key: "deploy-proxy", title: "Deploy Proxy", component: DeployProxyContract },
    { type: "single", key: "upgrade-proxy", title: "Upgrade Proxy", component: UpgradeProxy },
    { type: "single", key: "initialize-manager", title: "Initialize Manager", component: Initialize },
    { type: "single", key: "init-validator-set", title: "Initialize Validator Set", component: InitValidatorSet },
    { type: "single", key: "read-contract", title: "Read Contract", component: ReadContract },
];
