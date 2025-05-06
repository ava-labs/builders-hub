"use client";

import { useState } from "react";
import { useWalletStore } from "../../lib/walletStore";
import { useViemChainStore } from "../toolboxStore";
import { Button } from "../../components/Button";
import { Container } from "../components/Container";
import { EVMAddressInput } from "../components/EVMAddressInput";
import { AllowlistComponent } from "../components/AllowListComponents";
import rewardManagerAbi from "../../../contracts/precompiles/RewardManager.json";
import { CheckCircle, Edit, Users, Wallet } from "lucide-react";
import { cn } from "../../lib/utils";

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
  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();

  // Fee config state
  const [isAllowingFeeRecipients, setIsAllowingFeeRecipients] = useState(false);
  const [isDisablingRewards, setIsDisablingRewards] = useState(false);
  const [isSettingRewardAddress, setIsSettingRewardAddress] = useState(false);
  const [isCheckingFeeRecipients, setIsCheckingFeeRecipients] = useState(false);
  const [isCheckingRewardAddress, setIsCheckingRewardAddress] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string>("");
  const [isFeeRecipientsAllowed, setIsFeeRecipientsAllowed] = useState<boolean | null>(null);
  const [currentRewardAddress, setCurrentRewardAddress] = useState<string | null>(null);

  const handleAllowFeeRecipients = async () => {
    if (!walletEVMAddress || !coreWalletClient) {
      throw new Error("Please connect your wallet first");
    }

    setIsAllowingFeeRecipients(true);
    setActiveTransaction("allow-fee-recipients");

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
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
        throw new Error("Transaction failed");
      }
    } finally {
      setIsAllowingFeeRecipients(false);
    }
  };

  const checkFeeRecipientsAllowed = async () => {
    setIsCheckingFeeRecipients(true);

    const result = await publicClient.readContract({
      address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
      abi: rewardManagerAbi.abi,
      functionName: "areFeeRecipientsAllowed",
    });

    setIsFeeRecipientsAllowed(result as boolean);
    setIsCheckingFeeRecipients(false);
  };

  const handleDisableRewards = async () => {
    if (!walletEVMAddress || !coreWalletClient) {
      throw new Error("Please connect your wallet first");
    }

    setIsDisablingRewards(true);
    setActiveTransaction("disable-rewards");

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
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
        throw new Error("Transaction failed");
      }
    } finally {
      setIsDisablingRewards(false);
    }
  };

  const checkCurrentRewardAddress = async () => {
    setIsCheckingRewardAddress(true);

    const result = await publicClient.readContract({
      address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
      abi: rewardManagerAbi.abi,
      functionName: "currentRewardAddress",
    });

    setCurrentRewardAddress(result as string);
    setIsCheckingRewardAddress(false);
  };

  const handleSetRewardAddress = async () => {
    if (!walletEVMAddress || !coreWalletClient) {
      throw new Error("Please connect your wallet first");
    }

    if (!rewardAddress) {
      throw new Error("Reward address is required");
    }

    setIsSettingRewardAddress(true);
    setActiveTransaction("set-reward-address");

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
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
        throw new Error("Transaction failed");
      }
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

  const canSetRewardAddress = Boolean(
    rewardAddress &&
    walletEVMAddress &&
    coreWalletClient &&
    !isSettingRewardAddress &&
    !isDisablingRewards &&
    !isCheckingRewardAddress
  );

  return (
    <div className="space-y-6">
      <Container
        title="Reward Manager"
        description="Manage reward settings for the network"
      >
        <div className="space-y-4">
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
                disabled={!canSetRewardAddress}
                loading={isSettingRewardAddress}
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
        <AllowlistComponent
          precompileAddress={DEFAULT_REWARD_MANAGER_ADDRESS}
          precompileType="Reward Manager"
        />
      </div>
    </div>
  );
}
