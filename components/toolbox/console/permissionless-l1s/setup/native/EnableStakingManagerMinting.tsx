"use client";

import { useState, useEffect } from "react";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

const metadata: ConsoleToolMetadata = {
  title: "Enable Staking Manager Minting",
  description: "Grant the Native Token Staking Manager permission to mint rewards.",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance,
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function EnableStakingManagerMinting() {
  const { nativeStakingManagerAddress } = useToolboxStore();
  const [isNativeStaking, setIsNativeStaking] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a native staking manager address stored
    if (nativeStakingManagerAddress) {
      setIsNativeStaking(true);
    }
  }, [nativeStakingManagerAddress]);

  return (
    <CheckPrecompile
      configKey="contractNativeMinterConfig"
      precompileName="Native Minter"
    >
      <div className="space-y-4">
        <Callout type="info">
          <p className="font-semibold mb-2">Why is this needed?</p>
          <p>The Native Token Staking Manager needs permission to mint native tokens as rewards for validators and delegators.
            You must add the staking manager address to the Native Minter allowlist.</p>
          {nativeStakingManagerAddress && (
            <p className="mt-2">
              <strong>Your Native Token Staking Manager Address:</strong> <code className="text-xs">{nativeStakingManagerAddress}</code>
            </p>
          )}
        </Callout>

        {!nativeStakingManagerAddress && (
          <Callout>
            <p>No native staking manager address found. Please deploy and initialize a Native Token Staking Manager first.</p>
          </Callout>
        )}

        {nativeStakingManagerAddress && (
          <div className="mt-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add your Native Token Staking Manager to the allowlist below:
            </p>
          </div>
        )}
      </div>

      <AllowlistComponent
        precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
        precompileType="Minter"
        defaultEnabledAddress={nativeStakingManagerAddress}
      />
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(EnableStakingManagerMinting, metadata);