"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { PrecompileAddressInput } from "../components/PrecompileAddressInput";
import {
  SetAdminComponent,
  SetEnabledComponent,
  SetManagerComponent,
  RemoveAllowListComponent,
  ReadAllowListComponent,
  AllowListWrapper,
} from "../components/AllowListComponents";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

export default function DeployerAllowlist() {
  const { publicClient, walletEVMAddress, walletChainId } = useWalletStore();
  const [deployerAllowlistAddress, setDeployerAllowlistAddress] =
    useState<string>(DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS);
  const [error, setError] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);

  const verifyChainConnection = async () => {
    try {
      // Get the current chain ID
      const currentChainId = await publicClient.getChainId();
      console.log("Current chain ID:", currentChainId);

      // Get the current block number to verify connection
      const blockNumber = await publicClient.getBlockNumber();
      console.log("Current block number:", blockNumber);

      return true;
    } catch (error) {
      console.error("Chain verification failed:", error);
      return false;
    }
  };

  const handleSetAddress = async () => {
    if (!deployerAllowlistAddress) {
      setError("Deployer AllowList address is required");
      return;
    }

    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      // Verify chain connection
      const isConnected = await verifyChainConnection();
      if (!isConnected) {
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
        return;
      }

      // Skip bytecode verification for the default address
      if (deployerAllowlistAddress === DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
        return;
      }

      // Verify the address is a valid Deployer AllowList contract
      const code = await publicClient.getBytecode({
        address: deployerAllowlistAddress as `0x${string}`,
      });

      if (!code || code === "0x") {
        setError("Invalid contract address");
        return;
      }

      setIsAddressSet(true);
      setError(null);
    } catch (error) {
      console.error("Error verifying contract:", error);
      // If it's the default address, we'll still proceed
      if (deployerAllowlistAddress === DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to verify contract address"
        );
      }
    }
  };

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Deployer AllowList"
        description="Set the address of the Deployer AllowList precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <PrecompileAddressInput
            value={deployerAllowlistAddress}
            onChange={setDeployerAllowlistAddress}
            precompileName="Deployer AllowList"
            defaultAddress={DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!deployerAllowlistAddress || !walletEVMAddress}
            >
              Set Deployer AllowList Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDeployerAllowlistAddress("")}
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
