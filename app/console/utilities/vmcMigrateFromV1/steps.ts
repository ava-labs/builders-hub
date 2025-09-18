import { type StepDefinition } from "@/components/console/step-flow";
import DeployValidatorManager from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/DeployValidatorManager";
import UpgradeProxy from "@/components/toolbox/console/permissioned-l1s/validator-manager-setup/UpgradeProxy";
import QueryL1ValidatorSet from "@/components/toolbox/console/permissioned-l1s/QueryL1ValidatorSet";
import MigrateV1ToV2 from "@/components/toolbox/console/utilities/vmcMigrateFromV1/MigrateV1ToV2";

export const steps: StepDefinition[] = [
    {
      type: "single",
      key: "deploy-validator-manager",
      title: "Deploy Validator Manager v2",
      component: DeployValidatorManager,
    },
    {
      type: "single",
      key: "upgrade-proxy",
      title: "Upgrade Proxy",
      component: UpgradeProxy,
    },
    {
      type: "single",
      key: "query-validators",
      title: "Query L1 Validators",
      component: QueryL1ValidatorSet,
    },
    {
      type: "single",
      key: "migrate-validators",
      title: "Migrate Validators",
      component: MigrateV1ToV2,
    },
];
