"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { AllowListWrapper } from "../components/AllowListComponents";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

export default function DeployerAllowlist() {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const [deployerAllowlistAddress, setDeployerAllowlistAddress] =
    useState<string>(DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSetAddress = async () => {
    setIsProcessing(true);

    // Skip bytecode verification for the default address
    if (deployerAllowlistAddress === DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS) {
      setIsAddressSet(true);
      setIsProcessing(false);
      return;
    }

    // Verify the address is a valid Deployer AllowList contract
    const code = await publicClient.getBytecode({
      address: deployerAllowlistAddress as `0x${string}`,
    });

    if (!code || code === "0x") {
      throw new Error("Invalid contract address");
    }

    setIsAddressSet(true);
    setIsProcessing(false);
  };

  const canSetAddress = Boolean(
    deployerAllowlistAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Deployer AllowList"
        description="Set the address of the Deployer AllowList precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          <EVMAddressInput
            value={deployerAllowlistAddress}
            onChange={setDeployerAllowlistAddress}
            label="Deployer Allowlist Address"
            disabled={isProcessing}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!canSetAddress}
              loading={isProcessing}
            >
              Set Deployer AllowList Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDeployerAllowlistAddress("")}
              disabled={isProcessing}
            >
              Clear Address
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <div className="space-y-6">
      <div className="w-full">
        <AllowListWrapper
          precompileAddress={deployerAllowlistAddress}
          precompileType="Deployer"
        />
      </div>
    </div>
  );
}
