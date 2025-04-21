"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Container } from "./Container";
import { Button } from "../../components/Button";
import { EVMAddressInput } from "./EVMAddressInput";
import { ResultField } from "./ResultField";
import allowListAbi from "../../../contracts/precompiles/AllowList.json";

// Role types
const ROLES = {
  NONE: 0,
  ENABLED: 1,
  MANAGER: 2,
  ADMIN: 3,
};

// Component for setting Enabled permissions
export function SetEnabledComponent({
  precompileAddress,
}: {
  precompileAddress: string;
}) {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [enabledAddress, setEnabledAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetEnabled = async () => {
    if (!enabledAddress) {
      setError("Enabled address is required");
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
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: allowListAbi.abi,
        functionName: "setEnabled",
        args: [enabledAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting enabled failed:", error);
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

  return (
    <Container
      title="Set Enabled"
      description="These addresses can use the precompiled contract (e.g., mint native tokens) but cannot modify the allow list."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Enabled Address"
          value={enabledAddress}
          onChange={setEnabledAddress}
        />

        <Button
          onClick={handleSetEnabled}
          loading={isProcessing}
          variant="primary"
          disabled={!enabledAddress || !walletEVMAddress}
        >
          {!walletEVMAddress ? "Connect Wallet to Set Enabled" : "Set Enabled"}
        </Button>

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

// Component for setting Manager permissions
export function SetManagerComponent({
  precompileAddress,
}: {
  precompileAddress: string;
}) {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [managerAddress, setManagerAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetManager = async () => {
    if (!managerAddress) {
      setError("Manager address is required");
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
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: allowListAbi.abi,
        functionName: "setManager",
        args: [managerAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting manager failed:", error);
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

  return (
    <Container
      title="Set Manager"
      description="Can add or remove Enabled addresses but cannot modify Admins or Managers."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Manager Address"
          value={managerAddress}
          onChange={setManagerAddress}
        />

        <Button
          onClick={handleSetManager}
          loading={isProcessing}
          variant="primary"
          disabled={!managerAddress || !walletEVMAddress}
        >
          {!walletEVMAddress ? "Connect Wallet to Set Manager" : "Set Manager"}
        </Button>

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

// Component for setting Admin permissions
export function SetAdminComponent({
  precompileAddress,
}: {
  precompileAddress: string;
}) {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminAddress, setAdminAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetAdmin = async () => {
    if (!adminAddress) {
      setError("Admin address is required");
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
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: allowListAbi.abi,
        functionName: "setAdmin",
        args: [adminAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Setting admin failed:", error);
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

  return (
    <Container
      title="Set Admin"
      description="Full control over the allow list, including the ability to add or remove Admins, Managers, and Enabled addresses."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Admin Address"
          value={adminAddress}
          onChange={setAdminAddress}
        />

        <Button
          onClick={handleSetAdmin}
          loading={isProcessing}
          variant="primary"
          disabled={!adminAddress || !walletEVMAddress}
        >
          {!walletEVMAddress ? "Connect Wallet to Set Admin" : "Set Admin"}
        </Button>

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

// Component for setting None permissions
export function RemoveAllowListComponent({
  precompileAddress,
}: {
  precompileAddress: string;
}) {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [removeAddress, setRemoveAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    if (!removeAddress) {
      setError("Address to remove is required");
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
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: allowListAbi.abi,
        functionName: "setNone",
        args: [removeAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Removing from allowlist failed:", error);
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

  return (
    <Container
      title="Remove from Allowlist"
      description="Remove all permissions for an address. This will prevent the address from using the precompiled contract or modifying the allow list."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Address"
          value={removeAddress}
          onChange={setRemoveAddress}
        />

        <Button
          onClick={handleRemove}
          loading={isProcessing}
          variant="primary"
          disabled={!removeAddress || !walletEVMAddress}
        >
          {!walletEVMAddress ? "Connect Wallet to Remove" : "Remove Address"}
        </Button>

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

// Component for reading permissions
export function ReadAllowListComponent({
  precompileAddress,
}: {
  precompileAddress: string;
}) {
  const { publicClient } = useWalletStore();
  const [isReading, setIsReading] = useState(false);
  const [readAddress, setReadAddress] = useState<string>("");
  const [readResult, setReadResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRead = async () => {
    if (!readAddress) {
      setError("Address to read is required");
      return;
    }

    setIsReading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: precompileAddress as `0x${string}`,
        abi: allowListAbi.abi,
        functionName: "readAllowList",
        args: [readAddress],
      });

      setReadResult(Number(result));
    } catch (error) {
      console.error("Reading failed:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setIsReading(false);
    }
  };

  return (
    <Container
      title="Read Allowlist"
      description="Check the current role of an address in the allow list. Roles include Admin, Manager, Enabled, or None."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Address to Read"
          value={readAddress}
          onChange={setReadAddress}
        />

        <Button
          onClick={handleRead}
          loading={isReading}
          variant="primary"
          disabled={!readAddress}
        >
          Read
        </Button>

        {readResult !== null && (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Current Role:{" "}
              {Object.keys(ROLES).find(
                (key) => ROLES[key as keyof typeof ROLES] === readResult
              )}
            </p>
          </div>
        )}
      </div>
    </Container>
  );
}
