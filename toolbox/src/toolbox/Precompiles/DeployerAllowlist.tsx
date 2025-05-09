"use client";

import { AllowlistComponent } from "../components/AllowListComponents";
import { CheckPrecompile } from "../components/CheckPrecompile";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

export default function DeployerAllowlist() {
  return (
    <CheckPrecompile
      configKey="contractDeployerAllowListConfig"
      precompileName="Deployer Allowlist"
    >
      <AllowlistComponent
        precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
        precompileType="Deployer"
      />
    </CheckPrecompile>
  );
}
