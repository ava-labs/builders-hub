"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { ResultField } from "../components/ResultField";
import { EVMAddressInput } from "../components/EVMAddressInput";
import deployerAllowlistAbi from "../../../contracts/precompiles/DeployerAllowlist.json";

// Default Deployer AllowList address
const DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS =
  "0x0200000000000000000000000000000000000000";

// Role types
const ROLES = {
  NONE: 0,
  ENABLED: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export default function DeployerAllowlist() {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [deployerAllowlistAddress, setDeployerAllowlistAddress] =
    useState<string>(DEFAULT_DEPLOYER_ALLOWLIST_ADDRESS);
  const [addressToModify, setAddressToModify] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<number>(ROLES.ENABLED);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [currentRole, setCurrentRole] = useState<number | null>(null);

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

  const handleCheckRole = async () => {
    if (!addressToModify) {
      setError("Address to check is required");
      return;
    }

    try {
      const role = await publicClient.readContract({
        address: deployerAllowlistAddress as `0x${string}`,
        abi: deployerAllowlistAbi.abi,
        functionName: "readAllowList",
        args: [addressToModify],
      });

      setCurrentRole(Number(role));
      setError(null);
    } catch (error) {
      console.error("Error checking role:", error);
      setError(error instanceof Error ? error.message : "Failed to check role");
    }
  };

  const handleSetRole = async () => {
    if (!addressToModify) {
      setError("Address to modify is required");
      return;
    }

    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!coreWalletClient) {
      setError("Wallet client not found");
      return;
    }

    setIsProcessing(true);
    setError(null);

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

      let functionName: string;
      switch (selectedRole) {
        case ROLES.ADMIN:
          functionName = "setAdmin";
          break;
        case ROLES.ENABLED:
          functionName = "setEnabled";
          break;
        case ROLES.MANAGER:
          functionName = "setManager";
          break;
        case ROLES.NONE:
          functionName = "setNone";
          break;
        default:
          throw new Error("Invalid role selected");
      }

      const hash = await coreWalletClient.writeContract({
        address: deployerAllowlistAddress as `0x${string}`,
        abi: deployerAllowlistAbi.abi,
        functionName,
        args: [addressToModify],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        // Refresh the current role after setting
        await handleCheckRole();
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting role error:", error);
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError(
            `Failed to connect to the network. Please ensure you are connected to the correct L1 chain (Current Chain ID: ${walletChainId})`
          );
        } else {
          setError(error.message);
        }
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsProcessing(false);
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

          <EVMAddressInput
            label="Deployer AllowList Address"
            value={deployerAllowlistAddress}
            onChange={setDeployerAllowlistAddress}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!deployerAllowlistAddress || !walletEVMAddress}
            >
              Use Default Address
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
    <Container
      title="Manage Deployer AllowList"
      description="Set roles for addresses in the Deployer AllowList. Roles determine what actions an address can perform."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <div className="space-y-4">
          <EVMAddressInput
            label="Address to Modify"
            value={addressToModify}
            onChange={setAddressToModify}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            >
              <option value={ROLES.NONE}>None</option>
              <option value={ROLES.ENABLED}>Enabled</option>
              <option value={ROLES.MANAGER}>Manager</option>
              <option value={ROLES.ADMIN}>Admin</option>
            </select>
          </div>

          {currentRole !== null && (
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Current Role:{" "}
                {Object.keys(ROLES).find(
                  (key) => ROLES[key as keyof typeof ROLES] === currentRole
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex space-x-4">
          <Button
            variant="secondary"
            onClick={handleCheckRole}
            disabled={!addressToModify}
          >
            Check Current Role
          </Button>
          <Button
            variant="primary"
            onClick={handleSetRole}
            loading={isProcessing}
            disabled={!addressToModify || !walletEVMAddress}
          >
            {!walletEVMAddress ? "Connect Wallet to Set Role" : "Set Role"}
          </Button>
        </div>

        {txHash && (
          <ResultField
            label="Transaction Successful"
            value={txHash}
            showCheck={true}
          />
        )}
      </div>
    </Container>
  );
}
