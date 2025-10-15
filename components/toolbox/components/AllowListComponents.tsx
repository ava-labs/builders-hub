"use client";

import { useState } from "react";
import { useWalletStore } from "../stores/walletStore";
import { useViemChainStore } from "../stores/toolboxStore";
import { Button } from "./Button";
import { EVMAddressInput } from "./EVMAddressInput";
import { ResultField } from "./ResultField";
import allowListAbi from "../../../contracts/precompiles/AllowList.json";
import { useConnectedWallet } from "../contexts/ConnectedWalletContext";

// Component for setting Enabled permissions
function SetEnabledComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
}) {
  const { publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [enabledAddress, setEnabledAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetEnabled = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName: "setEnabled",
        args: [enabledAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
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

  const canSetEnabled = Boolean(
    enabledAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Enabled Address"
          value={enabledAddress}
          onChange={setEnabledAddress}
          disabled={isProcessing}
        />

        <Button
          onClick={handleSetEnabled}
          loading={isProcessing}
          variant="primary"
          disabled={!canSetEnabled}
        >
          {!walletEVMAddress
            ? `Connect Wallet to Set Enabled ${precompileType}`
            : `Set Enabled ${precompileType}`}
        </Button>

        {txHash && (
          <ResultField
            label="Transaction Successful"
            value={txHash}
            showCheck={true}
          />
        )}
      </div>
    </>
  );
};

// Component for setting Manager permissions
function SetManagerComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
}) {
  const { publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [managerAddress, setManagerAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetManager = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName: "setManager",
        args: [managerAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
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

  const canSetManager = Boolean(
    managerAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Manager Address"
          value={managerAddress}
          onChange={setManagerAddress}
          disabled={isProcessing}
        />

        <Button
          onClick={handleSetManager}
          loading={isProcessing}
          variant="primary"
          disabled={!canSetManager}
        >
          {!walletEVMAddress
            ? "Connect Wallet to Set Manager"
            : `Set Manager ${precompileType}`}
        </Button>

        {txHash && (
          <ResultField
            label="Transaction Successful"
            value={txHash}
            showCheck={true}
          />
        )}
      </div>
    </>
  );
}

// Component for setting Admin permissions
function SetAdminComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
}) {
  const { publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminAddress, setAdminAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSetAdmin = async () => {

    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName: "setAdmin",
        args: [adminAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
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

  const canSetAdmin = Boolean(
    adminAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Admin Address"
          value={adminAddress}
          onChange={setAdminAddress}
          disabled={isProcessing}
        />

        <Button
          onClick={handleSetAdmin}
          loading={isProcessing}
          variant="primary"
          disabled={!canSetAdmin}
        >
          {!walletEVMAddress
            ? "Connect Wallet to Set Admin"
            : `Set Admin ${precompileType}`}
        </Button>

        {txHash && (
          <ResultField
            label="Transaction Successful"
            value={txHash}
            showCheck={true}
          />
        )}
      </div>
    </>
  );
}

// Component for setting None permissions
function RemoveAllowListComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
}) {
  const { publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [removeAddress, setRemoveAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
        functionName: "setNone",
        args: [removeAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
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

  const canRemove = Boolean(
    removeAddress &&
    walletEVMAddress &&
    !isProcessing
  );

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Address"
          value={removeAddress}
          onChange={setRemoveAddress}
          disabled={isProcessing}
        />

        <Button
          onClick={handleRemove}
          loading={isProcessing}
          variant="primary"
          disabled={!canRemove}
        >
          {!walletEVMAddress
            ? "Connect Wallet to Remove"
            : `Remove from ${precompileType} Allowlist`}
        </Button>

        {txHash && (
          <ResultField
            label="Transaction Successful"
            value={txHash}
            showCheck={true}
          />
        )}
      </div>
    </>
  );
}

// Component for reading permissions
function ReadAllowListComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
}) {
  const { publicClient } = useWalletStore();
  const [isReading, setIsReading] = useState(false);
  const [readAddress, setReadAddress] = useState<string>("");
  const [readResult, setReadResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRead = async () => {
    setIsReading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: precompileAddress as `0x${string}`,
        abi: abi,
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

  const canRead = Boolean(readAddress && !isReading);

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
        )}

        <EVMAddressInput
          label="Address to Read"
          value={readAddress}
          onChange={setReadAddress}
          disabled={isReading}
        />

        <Button
          onClick={handleRead}
          loading={isReading}
          variant="primary"
          disabled={!canRead}
        >
          Read
        </Button>

        {readResult !== null && (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Current Role:{" "}
              {readResult === 0
                ? "None"
                : readResult === 1
                  ? "Enabled"
                  : readResult === 2
                    ? "Admin"
                    : readResult === 3
                      ? "Manager"
                      : `Unknown (${readResult})`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// Wrapper component for all allowlist components
export function AllowlistComponent({
  precompileAddress,
  precompileType = "precompiled contract",
  abi = allowListAbi.abi,
  onSuccess,
}: {
  precompileAddress: string;
  precompileType?: string;
  abi?: any;
  onSuccess?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SetEnabledComponent
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
          />
          <SetManagerComponent
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
          />
          <SetAdminComponent
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
          />
          <RemoveAllowListComponent
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
            onSuccess={onSuccess}
          />
          <ReadAllowListComponent
            precompileAddress={precompileAddress}
            precompileType={precompileType}
            abi={abi}
          />
        </div>
      </div>
    </div>
  );
}
