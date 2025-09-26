"use client";

import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

const metadata: ConsoleToolMetadata = {
  title: "Deployer Allowlist",
  description: "Control which addresses can deploy smart contracts on your L1",
  walletRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ]
};

function DeployerAllowlist({ onSuccess }: BaseConsoleToolProps) {
  return (
    <CheckPrecompile
      configKey="contractDeployerAllowListConfig"
      precompileName="Deployer Allowlist"
    >
      <AllowlistComponent
        precompileAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
        precompileType="Deployer"
        onSuccess={onSuccess}
      />
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(DeployerAllowlist, metadata);
