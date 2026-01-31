"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { ResultField } from "@/components/toolbox/components/ResultField";
import rewardManagerAbi from "@/contracts/precompiles/RewardManager.json";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { PrecompileCodeViewer } from "@/components/console/precompile-code-viewer";
import { cn } from "@/components/toolbox/lib/utils";
import { Gift, Users, MapPin, XCircle, RefreshCw } from "lucide-react";

// Default Reward Manager address
const DEFAULT_REWARD_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000004";

const TABS = [
  { id: "allow", label: "Allow Recipients", icon: Users, function: "allowFeeRecipients" },
  { id: "set", label: "Set Address", icon: MapPin, function: "setRewardAddress" },
  { id: "disable", label: "Disable Rewards", icon: XCircle, function: "disableRewards" },
] as const;

type TabId = typeof TABS[number]["id"];

const metadata: ConsoleToolMetadata = {
  title: "Reward Manager",
  description: "Manage reward settings for the network including fee recipients and reward addresses",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

interface StatusCardProps {
  title: string;
  value: string | null;
  status?: "active" | "inactive" | "loading";
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function StatusCard({ title, value, status, onRefresh, isRefreshing }: StatusCardProps) {
  return (
    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
        <div className="flex items-center gap-2">
          {status && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              status === "active" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
              status === "inactive" && "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
              status === "loading" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            )}>
              {status === "loading" ? "Checking..." : status === "active" ? "Active" : "Inactive"}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-500", isRefreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>
      {value && (
        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">{value}</p>
      )}
    </div>
  );
}

function RewardManager({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("allow");

  // Action states
  const [isAllowingFeeRecipients, setIsAllowingFeeRecipients] = useState(false);
  const [isDisablingRewards, setIsDisablingRewards] = useState(false);
  const [isSettingRewardAddress, setIsSettingRewardAddress] = useState(false);
  const [isCheckingFeeRecipients, setIsCheckingFeeRecipients] = useState(false);
  const [isCheckingRewardAddress, setIsCheckingRewardAddress] = useState(false);

  // Result states
  const [txHash, setTxHash] = useState<string | null>(null);
  const [rewardAddress, setRewardAddress] = useState<string>("");
  const [isFeeRecipientsAllowed, setIsFeeRecipientsAllowed] = useState<boolean | null>(null);
  const [currentRewardAddress, setCurrentRewardAddress] = useState<string | null>(null);

  // Code viewer highlight state
  const [highlightFunction, setHighlightFunction] = useState<string>("allowFeeRecipients");

  const handleAllowFeeRecipients = async () => {
    if (!coreWalletClient.account) {
      throw new Error("Please connect your wallet first");
    }

    setIsAllowingFeeRecipients(true);
    setTxHash(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "allowFeeRecipients",
        account: coreWalletClient.account,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkFeeRecipientsAllowed();
        onSuccess?.();
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
    if (!coreWalletClient.account) {
      throw new Error("Please connect your wallet first");
    }

    setIsDisablingRewards(true);
    setTxHash(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "disableRewards",
        account: coreWalletClient.account,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkCurrentRewardAddress();
        onSuccess?.();
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
    if (!coreWalletClient.account) {
      throw new Error("Please connect your wallet first");
    }

    if (!rewardAddress) {
      throw new Error("Reward address is required");
    }

    setIsSettingRewardAddress(true);
    setTxHash(null);

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_REWARD_MANAGER_ADDRESS as `0x${string}`,
        abi: rewardManagerAbi.abi,
        functionName: "setRewardAddress",
        args: [rewardAddress],
        account: coreWalletClient.account,
        chain: viemChain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        await checkCurrentRewardAddress();
        onSuccess?.();
      } else {
        throw new Error("Transaction failed");
      }
    } finally {
      setIsSettingRewardAddress(false);
    }
  };

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setTxHash(null);
    const tab = TABS.find(t => t.id === tabId);
    if (tab) {
      setHighlightFunction(tab.function);
    }
  };

  const isAnyOperationInProgress =
    isAllowingFeeRecipients ||
    isDisablingRewards ||
    isSettingRewardAddress;

  const canSetRewardAddress = Boolean(
    rewardAddress &&
    walletEVMAddress &&
    coreWalletClient &&
    !isSettingRewardAddress
  );

  return (
    <CheckPrecompile
      configKey="rewardManagerConfig"
      precompileName="Reward Manager"
    >
      <PrecompileCodeViewer
        precompileName="RewardManager"
        highlightFunction={highlightFunction}
        collapsibleSections={[
          {
            title: "Manage Allowlist",
            defaultOpen: false,
            children: (
              <AllowlistComponent
                precompileAddress={DEFAULT_REWARD_MANAGER_ADDRESS}
                precompileType="Reward Manager"
                onSuccess={onSuccess}
              />
            ),
          },
        ]}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Gift className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Reward Configuration</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure fee recipients and reward distribution
              </p>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatusCard
              title="Fee Recipients"
              value={isFeeRecipientsAllowed !== null ? (isFeeRecipientsAllowed ? "Validators can set custom fee recipients" : "Fee recipients not allowed") : null}
              status={isCheckingFeeRecipients ? "loading" : isFeeRecipientsAllowed === null ? undefined : isFeeRecipientsAllowed ? "active" : "inactive"}
              onRefresh={checkFeeRecipientsAllowed}
              isRefreshing={isCheckingFeeRecipients}
            />
            <StatusCard
              title="Reward Address"
              value={currentRewardAddress || "Not set"}
              status={isCheckingRewardAddress ? "loading" : currentRewardAddress ? "active" : "inactive"}
              onRefresh={checkCurrentRewardAddress}
              isRefreshing={isCheckingRewardAddress}
            />
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="pt-2">
            {activeTab === "allow" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Allow validators to specify their own fee recipient address. When enabled, each validator
                  can direct transaction fees to their preferred address.
                </p>
                <Button
                  variant="primary"
                  onClick={handleAllowFeeRecipients}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                  loading={isAllowingFeeRecipients}
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Allow Fee Recipients
                </Button>
              </div>
            )}

            {activeTab === "set" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Set a specific address to receive all block rewards. This address will receive
                  all transaction fees from the network.
                </p>
                <EVMAddressInput
                  label="Reward Address"
                  value={rewardAddress}
                  onChange={setRewardAddress}
                  disabled={isSettingRewardAddress}
                />
                <Button
                  variant="primary"
                  onClick={handleSetRewardAddress}
                  disabled={!canSetRewardAddress}
                  loading={isSettingRewardAddress}
                  className="w-full"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Set Reward Address
                </Button>
              </div>
            )}

            {activeTab === "disable" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Disable reward distribution entirely. Transaction fees will be burned instead of
                  being distributed to validators or a reward address.
                </p>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Warning:</strong> This will prevent any rewards from being distributed.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleDisableRewards}
                  disabled={!walletEVMAddress || isAnyOperationInProgress}
                  loading={isDisablingRewards}
                  className="w-full"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Disable Rewards
                </Button>
              </div>
            )}
          </div>

          {/* Success Message */}
          {txHash && (
            <ResultField
              label="Transaction Successful"
              value={txHash}
              showCheck={true}
            />
          )}
        </div>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(RewardManager, metadata);
