"use client";

import { Container } from "../components/Container";
import { AllowlistComponent } from "../components/AllowListComponents";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

export default function DeployerAllowlist() {
  return (
    <div className="space-y-6">
      <div className="w-full">
        <AllowlistComponent
          precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
          precompileType="Deployer"
        />
      </div>
    </div>
  );
}
