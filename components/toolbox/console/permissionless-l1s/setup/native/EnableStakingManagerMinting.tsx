"use client";

import { useState, useEffect } from "react";
import { useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { Container } from "@/components/toolbox/components/Container";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { Callout } from "fumadocs-ui/components/callout";

// Default Native Minter address
const DEFAULT_NATIVE_MINTER_ADDRESS = "0x0200000000000000000000000000000000000001";

export default function EnableStakingManagerMinting() {
  const { nativeStakingManagerAddress } = useToolboxStore();
  const [isNativeStaking, setIsNativeStaking] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a native staking manager address stored
    if (nativeStakingManagerAddress) {
      setIsNativeStaking(true);
    }
  }, [nativeStakingManagerAddress]);

  return (
    <CheckWalletRequirements configKey={[
      WalletRequirementsConfigKey.EVMChainBalance
    ]}>
      <CheckPrecompile
        configKey="contractNativeMinterConfig"
        precompileName="Native Minter"
      >
        <Container
          title="Enable Staking Manager Minting"
          description="Grant the Native Token Staking Manager permission to mint rewards."
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

            <Callout type="warn">
              <p className="font-semibold mb-2">Skip this step if using ERC20 Token Staking</p>
              <p>This step is only required for Native Token Staking Manager. If you deployed an ERC20 Token Staking Manager, 
                 you can skip this step as the ERC20 token should handle its own minting permissions.</p>
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
        </Container>

        <AllowlistComponent
          precompileAddress={DEFAULT_NATIVE_MINTER_ADDRESS}
          precompileType="Minter"
        />
      </CheckPrecompile>
    </CheckWalletRequirements>
  );
}
