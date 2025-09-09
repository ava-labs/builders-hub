"use client";

import StepFlow, { type StepDefinition } from "../../../../components/console/step-flow";
import ToolboxConsoleWrapper from "../../../../toolbox/src/components/ToolboxConsoleWrapper";
import DeployValidatorManager from "@/toolbox/src/toolbox/ValidatorManager/DeployValidatorManager";
import UpgradeProxy from "@/toolbox/src/toolbox/Proxy/UpgradeProxy";
import QueryL1ValidatorSet from "@/toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet";
import MigrateV1ToV2 from "@/toolbox/src/toolbox/ValidatorManager/MigrateV1ToV2";

export default function Page() {
  const steps: StepDefinition[] = [
    {
      type: "single",
      key: "deploy-validator-manager",
      title: "Deploy Validator Manager v2",
      description: "Deploy the new ValidatorMessages library and ValidatorManager v2 contract",
      component: DeployValidatorManager,
    },
    {
      type: "single",
      key: "upgrade-proxy",
      title: "Upgrade Proxy",
      description: "Update the proxy to point to the new ValidatorManager v2 implementation",
      component: UpgradeProxy,
    },
    {
      type: "single",
      key: "query-validators",
      title: "Query L1 Validators",
      description: "View and identify validators that need to be migrated from v1 to v2",
      component: QueryL1ValidatorSet,
    },
    {
      type: "single",
      key: "migrate-validators",
      title: "Migrate Validators",
      description: "Migrate individual validators from v1 to v2 format",
      component: MigrateV1ToV2,
    },
  ];

  return (
    <ToolboxConsoleWrapper>
      <StepFlow steps={steps} />
    </ToolboxConsoleWrapper>
  );
}