"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { PrecompileAddressInput } from "../components/PrecompileAddressInput";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { AllowListWrapper } from "../components/AllowListComponents";
import rewardManagerAbi from "../../../contracts/precompiles/RewardManager.json";
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "../../lib/utils";
import Image from "next/image";

// Default Reward Manager address
const DEFAULT_REWARD_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000004";

interface StatusBadgeProps {
  status: boolean | null;
  loadingText?: string;
  isLoading?: boolean;
}

const StatusBadge = ({ status, loadingText, isLoading }: StatusBadgeProps) => {
  if (isLoading)
    return (
      <span className="text-sm text-muted-foreground">
        {loadingText || "Loading..."}
      </span>
    );
  if (status === null) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      )}
    >
      {status ? "Enabled" : "Disabled"}
    </span>
  );
};

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
  const [isAllowingFeeRecipients, setIsAllowingFeeRecipients] = useState(false);
  const [isDisablingRewards, setIsDisablingRewards] = useState(false);
  const [isSettingRewardAddress, setIsSettingRewardAddress] = useState(false);
  const [isCheckingFeeRecipients, setIsCheckingFeeRecipients] = useState(false);
  const [isCheckingRewardAddress, setIsCheckingRewardAddress] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | null>(
    null
  );

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

    setIsAllowingFeeRecipients(true);
    setError(null);
    setActiveTransaction("allow-fee-recipients");

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
      setIsAllowingFeeRecipients(false);
    }
  };

  const checkFeeRecipientsAllowed = async () => {
    try {
      setIsCheckingFeeRecipients(true);
      setError(null);

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
    } finally {
      setIsCheckingFeeRecipients(false);
    }
  };

  const handleDisableRewards = async () => {
    if (!walletEVMAddress) {
      setError("Please connect your wallet first");
      return;
    }

    setIsDisablingRewards(true);
    setError(null);
    setActiveTransaction("disable-rewards");

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
      setIsDisablingRewards(false);
    }
  };

  const checkCurrentRewardAddress = async () => {
    try {
      setIsCheckingRewardAddress(true);
      setError(null);

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
    } finally {
      setIsCheckingRewardAddress(false);
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

    setIsSettingRewardAddress(true);
    setError(null);
    setActiveTransaction("set-reward-address");

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
      setIsSettingRewardAddress(false);
    }
  };

  const isAnyOperationInProgress =
    isAllowingFeeRecipients ||
    isDisablingRewards ||
    isSettingRewardAddress ||
    isCheckingFeeRecipients ||
    isCheckingRewardAddress;

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

          <PrecompileAddressInput
            value={rewardManagerAddress}
            onChange={setRewardManagerAddress}
            precompileName="Reward Manager"
            defaultAddress={DEFAULT_REWARD_MANAGER_ADDRESS}
          />

          <div className="flex space-x-4">
            <Button
              variant="primary"
              onClick={handleSetAddress}
              disabled={!rewardManagerAddress || !walletEVMAddress}
            >
              Set Reward Manager Address
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
        description="Manage reward settings for the network"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-100">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="space-y-4 p-4">
            {/* Fee Recipients Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Fee Recipients</span>
                {isFeeRecipientsAllowed !== null && (
                  <StatusBadge status={isFeeRecipientsAllowed} />
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  onClick={handleAllowFeeRecipients}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                >
                  {isAllowingFeeRecipients
                    ? "Processing..."
                    : "Allow Fee Recipients"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={checkFeeRecipientsAllowed}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                >
                  {isCheckingFeeRecipients ? "Checking..." : "Check Status"}
                </Button>
              </div>

              {activeTransaction === "allow-fee-recipients" && txHash && (
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Transaction Successful
                      </p>
                      <p className="text-xs font-mono text-green-700 break-all">
                        {txHash}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rewards Management Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Rewards Management</span>
                {currentRewardAddress && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  onClick={handleDisableRewards}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                >
                  {isDisablingRewards ? "Processing..." : "Disable Rewards"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={checkCurrentRewardAddress}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                >
                  {isCheckingRewardAddress
                    ? "Checking..."
                    : "Check Current Address"}
                </Button>
              </div>

              {currentRewardAddress && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                  <p className="text-sm font-medium text-slate-700">
                    Current Reward Address
                  </p>
                  <p className="text-xs font-mono break-all">
                    {currentRewardAddress}
                  </p>
                </div>
              )}

              {activeTransaction === "disable-rewards" && txHash && (
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Transaction Successful
                      </p>
                      <p className="text-xs font-mono text-green-700 break-all">
                        {txHash}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Set Reward Address Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Set Reward Address</span>
              </div>
              <div className="space-y-2">
                <EVMAddressInput
                  value={rewardAddress}
                  onChange={setRewardAddress}
                  disabled={isAnyOperationInProgress}
                  showError={isSettingRewardAddress && !rewardAddress}
                />
              </div>

              <Button
                variant="primary"
                onClick={handleSetRewardAddress}
                disabled={!walletEVMAddress || isAnyOperationInProgress}
                className="w-full"
              >
                {isSettingRewardAddress
                  ? "Processing..."
                  : "Set Reward Address"}
              </Button>

              {activeTransaction === "set-reward-address" && txHash && (
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Transaction Successful
                      </p>
                      <p className="text-xs font-mono text-green-700 break-all">
                        {txHash}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>

      <div className="w-full">
        <AllowListWrapper
          precompileAddress={rewardManagerAddress}
          precompileType="Reward Manager"
        />
      </div>
    </div>
  );
}
