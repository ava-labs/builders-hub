"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { ResultField } from "../components/ResultField";
import {
  SetAdminComponent,
  SetEnabledComponent,
  SetManagerComponent,
  RemoveAllowListComponent,
  ReadAllowListComponent,
} from "../components/AllowListComponents";
import rewardManagerAbi from "../../../contracts/precompiles/RewardManager.json";

// Default Reward Manager address
const DEFAULT_REWARD_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000004";

export default function RewardManager() {
  const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } =
    useWalletStore();
  const viemChain = useViemChainStore();
  const [rewardManagerAddress, setRewardManagerAddress] = useState<string>(
    DEFAULT_REWARD_MANAGER_ADDRESS
  );
  const [rewardAddress, setRewardAddress] = useState<string>("");
  const [isFeeRecipientsAllowed, setIsFeeRecipientsAllowed] = useState<
    boolean | null
  >(null);
  const [currentRewardAddress, setCurrentRewardAddress] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isAddressSet, setIsAddressSet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const verifyChainConnection = async () => {
    try {
      const currentChainId = await publicClient.getChainId();
      console.log("Current chain ID:", currentChainId);

      const blockNumber = await publicClient.getBlockNumber();
      console.log("Current block number:", blockNumber);

      return true;
    } catch (error) {
      console.error("Chain verification failed:", error);
      return false;
    }
  };

  const handleSetAddress = async () => {
    if (!rewardManagerAddress) {
      setError("Reward Manager address is required");
      return;
    }

    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      const isConnected = await verifyChainConnection();
      if (!isConnected) {
        setError(
          "Failed to connect to the network. Please ensure your wallet is connected to the correct L1 chain (Current Chain ID: " +
            walletChainId +
            ")"
        );
        return;
      }

      if (rewardManagerAddress === DEFAULT_REWARD_MANAGER_ADDRESS) {
        setIsAddressSet(true);
        setError(null);
        return;
      }

      const code = await publicClient.getBytecode({
        address: rewardManagerAddress as `0x${string}`,
      });

      if (!code || code === "0x") {
        setError("Invalid contract address");
        return;
      }

      setIsAddressSet(true);
      setError(null);
    } catch (error) {
      console.error("Error verifying contract:", error);
      if (rewardManagerAddress === DEFAULT_REWARD_MANAGER_ADDRESS) {
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

  const handleAllowFeeRecipients = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: rewardManagerAddress as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "allowFeeRecipients",
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkFeeRecipientsAllowed();
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Error allowing fee recipients:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to allow fee recipients"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableRewards = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: rewardManagerAddress as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "disableRewards",
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkCurrentRewardAddress();
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Error disabling rewards:", error);
      setError(
        error instanceof Error ? error.message : "Failed to disable rewards"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetRewardAddress = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!rewardAddress) {
      setError("Reward address is required");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: rewardManagerAddress as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "setRewardAddress",
        args: [rewardAddress],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkCurrentRewardAddress();
      } else {
        setError("Transaction failed");
      }
    } catch (error) {
      console.error("Error setting reward address:", error);
      setError(
        error instanceof Error ? error.message : "Failed to set reward address"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const checkFeeRecipientsAllowed = async () => {
    try {
      const result = await publicClient.readContract({
        address: rewardManagerAddress as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "areFeeRecipientsAllowed",
      });

      setIsFeeRecipientsAllowed(result as boolean);
    } catch (error) {
      console.error("Error checking fee recipients status:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to check fee recipients status"
      );
    }
  };

  const checkCurrentRewardAddress = async () => {
    try {
      const result = await publicClient.readContract({
        address: rewardManagerAddress as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "currentRewardAddress",
      });

      setCurrentRewardAddress(result as string);
    } catch (error) {
      console.error("Error checking current reward address:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to check current reward address"
      );
    }
  };

  if (!isAddressSet) {
    return (
      <Container
        title="Configure Reward Manager"
        description="Set the address of the Reward Manager precompile contract. The default address is pre-filled, but you can change it if needed."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <EVMAddressInput
            label="Reward Manager Address"
            value={rewardManagerAddress}
            onChange={setRewardManagerAddress}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!rewardManagerAddress || !walletEVMAddress}
            >
              Use Default Address
            </Button>
            <Button
              variant="secondary"
              onClick={() => setRewardManagerAddress("")}
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
        title="Reward Manager"
        description="Manage reward settings for the network."
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 text-red-700 bg-red-100 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button
                variant="primary"
                onClick={handleAllowFeeRecipients}
                loading={isProcessing}
                disabled={!walletEVMAddress}
              >
                Allow Fee Recipients
              </Button>
              <Button
                variant="secondary"
                onClick={checkFeeRecipientsAllowed}
                disabled={!walletEVMAddress}
              >
                Check Fee Recipients Status
              </Button>
            </div>

            {isFeeRecipientsAllowed !== null && (
              <ResultField
                label="Fee Recipients Status"
                value={isFeeRecipientsAllowed ? "Allowed" : "Not Allowed"}
              />
            )}

            <div className="flex space-x-4">
              <Button
                variant="primary"
                onClick={handleDisableRewards}
                loading={isProcessing}
                disabled={!walletEVMAddress}
              >
                Disable Rewards
              </Button>
              <Button
                variant="secondary"
                onClick={checkCurrentRewardAddress}
                disabled={!walletEVMAddress}
              >
                Check Current Reward Address
              </Button>
            </div>

            {currentRewardAddress && (
              <ResultField
                label="Current Reward Address"
                value={currentRewardAddress}
              />
            )}

            <div className="space-y-2">
              <EVMAddressInput
                label="Set Reward Address"
                value={rewardAddress}
                onChange={setRewardAddress}
              />
              <Button
                variant="primary"
                onClick={handleSetRewardAddress}
                loading={isProcessing}
                disabled={!walletEVMAddress || !rewardAddress}
              >
                Set Reward Address
              </Button>
            </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SetEnabledComponent precompileAddress={rewardManagerAddress} />
        <SetManagerComponent precompileAddress={rewardManagerAddress} />
        <SetAdminComponent precompileAddress={rewardManagerAddress} />
        <RemoveAllowListComponent precompileAddress={rewardManagerAddress} />
        <ReadAllowListComponent precompileAddress={rewardManagerAddress} />
      </div>
    </div>
  );
}
