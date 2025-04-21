"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import {
  SetAdminComponent,
  SetEnabledComponent,
  SetManagerComponent,
  RemoveAllowListComponent,
  ReadAllowListComponent,
} from "../components/AllowListComponents";

// Default Warp Messenger address
const DEFAULT_WARP_MESSENGER_ADDRESS =
  "0x0200000000000000000000000000000000000005";

export default function WarpMessenger() {
  const { publicClient, walletEVMAddress, walletChainId } = useWalletStore();
  const [warpMessengerAddress, setWarpMessengerAddress] = useState<string>(
    DEFAULT_WARP_MESSENGER_ADDRESS
  );
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
    if (!warpMessengerAddress) {
      setError("Warp Messenger address is required");
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
      if (warpMessengerAddress === DEFAULT_WARP_MESSENGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
        return;
      }

      // Verify the address is a valid Warp Messenger contract
      const code = await publicClient.getBytecode({
        address: warpMessengerAddress as `0x${string}`,
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
      if (warpMessengerAddress === DEFAULT_WARP_MESSENGER_ADDRESS) {
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
        title="Configure Warp Messenger"
        description="Set the address of the Warp Messenger precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <EVMAddressInput
            label="Warp Messenger Address"
            value={warpMessengerAddress}
            onChange={setWarpMessengerAddress}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!warpMessengerAddress || !walletEVMAddress}
            >
              Use Default Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWarpMessengerAddress("")}
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
      <Container
        title="Warp Messenger Management"
        description="Manage the Warp Messenger precompile contract. This allows you to control cross-chain messaging operations on the network."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}
        </div>
      </Container>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SetEnabledComponent precompileAddress={warpMessengerAddress} />
        <SetManagerComponent precompileAddress={warpMessengerAddress} />
        <SetAdminComponent precompileAddress={warpMessengerAddress} />
        <RemoveAllowListComponent precompileAddress={warpMessengerAddress} />
        <ReadAllowListComponent precompileAddress={warpMessengerAddress} />
      </div>
    </div>
  );
}
