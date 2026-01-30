import { type StepDefinition } from "@/components/console/step-flow";
import DeployValidatorManager from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager";
import ProxySetup from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/ProxySetup";
import Initialize from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/Initialize";
import InitValidatorSet from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/InitValidatorSet";

export const steps: StepDefinition[] = [
    { type: "single", key: "deploy-validator-manager", title: "Deploy Validator Manager", component: DeployValidatorManager },
    { type: "single", key: "proxy-setup", title: "Proxy Setup", component: ProxySetup },
    { type: "single", key: "initialize-manager", title: "Initialize Manager", component: Initialize },
    { type: "single", key: "init-validator-set", title: "Initialize Validator Set", component: InitValidatorSet },
];
