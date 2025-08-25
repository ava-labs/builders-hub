"use client";

import { AllowlistComponent } from "../../components/AllowListComponents";
import { CheckPrecompile } from "../../components/CheckPrecompile";
import { CheckWalletRequirements } from "../../components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/hooks/useWalletRequirements";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

export default function DeployerAllowlist() {
  return (
    <CheckWalletRequirements configKey={[
        WalletRequirementsConfigKey.EVMChainBalance,
    ]}>
      <CheckPrecompile
        configKey="contractDeployerAllowListConfig"
        precompileName="Deployer Allowlist"
      >
        <AllowlistComponent
          precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
          precompileType="Deployer"
        />
      </CheckPrecompile>
    </CheckWalletRequirements>
  );
}
