"use client";

import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { ResultField } from "@/components/toolbox/components/ResultField";
import feeManagerAbi from "@/contracts/precompiles/FeeManager.json";
import { AllowlistComponent } from "@/components/toolbox/components/AllowListComponents";
import { CheckPrecompile } from "@/components/toolbox/components/CheckPrecompile";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { PrecompileCodeViewer } from "@/components/console/precompile-code-viewer";
import { Settings, ChevronDown, ChevronRight, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/components/toolbox/lib/utils";

// Default Fee Manager address
const DEFAULT_FEE_MANAGER_ADDRESS =
  "0x0200000000000000000000000000000000000003";

const metadata: ConsoleToolMetadata = {
  title: "Fee Manager",
  description: "Configure dynamic fee parameters and manage allowlist for your L1",
  toolRequirements: [
    WalletRequirementsConfigKey.EVMChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

interface ConfigGroupProps {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ConfigGroup({ title, description, children, defaultOpen = true }: ConfigGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="text-left">
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{title}</span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 space-y-3 border-t border-zinc-200 dark:border-zinc-700">
          {children}
        </div>
      )}
    </div>
  );
}

interface ConfigDisplayProps {
  config: Record<string, string> | null;
  lastChangedAt: number | null;
}

function ConfigDisplay({ config, lastChangedAt }: ConfigDisplayProps) {
  if (!config) return null;

  const formatValue = (key: string, value: string) => {
    const num = BigInt(value);
    if (key === "minBaseFee") {
      // Convert to Gwei for display
      const gwei = Number(num) / 1e9;
      return `${value} (${gwei.toFixed(2)} Gwei)`;
    }
    return num.toLocaleString();
  };

  const configItems = [
    { key: "gasLimit", label: "Gas Limit", group: "Gas Limits" },
    { key: "targetGas", label: "Target Gas", group: "Gas Limits" },
    { key: "targetBlockRate", label: "Target Block Rate", group: "Block Rate" },
    { key: "baseFeeChangeDenominator", label: "Base Fee Change Denominator", group: "Block Rate" },
    { key: "minBaseFee", label: "Minimum Base Fee", group: "Fees" },
    { key: "minBlockGasCost", label: "Min Block Gas Cost", group: "Fees" },
    { key: "maxBlockGasCost", label: "Max Block Gas Cost", group: "Fees" },
    { key: "blockGasCostStep", label: "Block Gas Cost Step", group: "Fees" },
  ];

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Current Configuration</span>
        {lastChangedAt !== null && (
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            (Last changed at block {lastChangedAt.toLocaleString()})
          </span>
        )}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {configItems.map(({ key, label }) => (
          <div key={key} className="flex justify-between items-center px-4 py-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100">
              {config[key] ? formatValue(key, config[key]) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeeManager({ onSuccess }: BaseConsoleToolProps) {
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const [gasLimit, setGasLimit] = useState<string>("20000000");
  const [targetBlockRate, setTargetBlockRate] = useState<string>("2");
  const [minBaseFee, setMinBaseFee] = useState<string>("25000000000");
  const [targetGas, setTargetGas] = useState<string>("15000000");
  const [baseFeeChangeDenominator, setBaseFeeChangeDenominator] = useState<string>("48");
  const [minBlockGasCost, setMinBlockGasCost] = useState<string>("0");
  const [maxBlockGasCost, setMaxBlockGasCost] = useState<string>("10000000");
  const [blockGasCostStep, setBlockGasCostStep] = useState<string>("500000");

  // Transaction state
  const [isSettingConfig, setIsSettingConfig] = useState(false);
  const [isReadingConfig, setIsReadingConfig] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Record<string, string> | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"set" | "get" | null>(null);

  const handleSetFeeConfig = async () => {
    setIsSettingConfig(true);
    setActiveAction("set");

    try {
      const hash = await coreWalletClient.writeContract({
        address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
        abi: feeManagerAbi.abi,
        functionName: "setFeeConfig",
        args: [
          BigInt(gasLimit),
          BigInt(targetBlockRate),
          BigInt(minBaseFee),
          BigInt(targetGas),
          BigInt(baseFeeChangeDenominator),
          BigInt(minBlockGasCost),
          BigInt(maxBlockGasCost),
          BigInt(blockGasCostStep),
        ],
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
        gas: BigInt(1_000_000),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setTxHash(hash);
        onSuccess?.();
      } else {
        throw new Error("Transaction failed");
      }
    } finally {
      setIsSettingConfig(false);
    }
  };

  const handleGetFeeConfig = async () => {
    setIsReadingConfig(true);
    setActiveAction("get");

    const result = (await publicClient.readContract({
      address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
      abi: feeManagerAbi.abi,
      functionName: "getFeeConfig",
    })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

    const [
      gasLimit,
      targetBlockRate,
      minBaseFee,
      targetGas,
      baseFeeChangeDenominator,
      minBlockGasCost,
      maxBlockGasCost,
      blockGasCostStep,
    ] = result;

    setCurrentConfig({
      gasLimit: gasLimit.toString(),
      targetBlockRate: targetBlockRate.toString(),
      minBaseFee: minBaseFee.toString(),
      targetGas: targetGas.toString(),
      baseFeeChangeDenominator: baseFeeChangeDenominator.toString(),
      minBlockGasCost: minBlockGasCost.toString(),
      maxBlockGasCost: maxBlockGasCost.toString(),
      blockGasCostStep: blockGasCostStep.toString(),
    });

    // Also fetch last changed at
    const lastChanged = await publicClient.readContract({
      address: DEFAULT_FEE_MANAGER_ADDRESS as `0x${string}`,
      abi: feeManagerAbi.abi,
      functionName: "getFeeConfigLastChangedAt",
    });
    setLastChangedAt(Number(lastChanged));

    setIsReadingConfig(false);
  };

  const canSetFeeConfig = Boolean(
    walletEVMAddress &&
    coreWalletClient &&
    !isSettingConfig
  );

  return (
    <CheckPrecompile
      configKey="feeManagerConfig"
      precompileName="Fee Manager"
    >
      <PrecompileCodeViewer
        precompileName="FeeManager"
        highlightFunction="setFeeConfig"
        collapsibleSections={[
          {
            title: "Manage Allowlist",
            defaultOpen: false,
            children: (
              <AllowlistComponent
                precompileAddress={DEFAULT_FEE_MANAGER_ADDRESS}
                precompileType="Fee Manager"
                onSuccess={onSuccess}
              />
            ),
          },
        ]}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Set Fee Configuration</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure dynamic fee parameters for your L1
              </p>
            </div>
          </div>

          {/* Gas Limits Group */}
          <ConfigGroup
            title="Gas Limits"
            description="Maximum and target gas for blocks"
          >
            <Input
              label="Gas Limit"
              value={gasLimit}
              onChange={setGasLimit}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(gasLimit) < 15_000_000 || Number(gasLimit) > 30_000_000 ?
                "Expected value between 15,000,000 and 30,000,000" : undefined}
            />
            <Input
              label="Target Gas"
              value={targetGas}
              onChange={setTargetGas}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(targetGas) < 1_000_000 || Number(targetGas) > 50_000_000 ?
                "Expected value between 1,000,000 and 50,000,000" : undefined}
            />
          </ConfigGroup>

          {/* Block Rate Group */}
          <ConfigGroup
            title="Block Rate"
            description="Target block production rate and fee adjustment"
          >
            <Input
              label="Target Block Rate"
              value={targetBlockRate}
              onChange={setTargetBlockRate}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(targetBlockRate) < 1 || Number(targetBlockRate) > 10 ?
                "Expected value between 1 and 10 seconds" : undefined}
            />
            <Input
              label="Base Fee Change Denominator"
              value={baseFeeChangeDenominator}
              onChange={setBaseFeeChangeDenominator}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(baseFeeChangeDenominator) < 8 || Number(baseFeeChangeDenominator) > 1000 ?
                "Expected value between 8 and 1,000" : undefined}
            />
          </ConfigGroup>

          {/* Block Gas Cost Group */}
          <ConfigGroup
            title="Block Gas Cost"
            description="Minimum base fee and block gas cost parameters"
          >
            <Input
              label="Minimum Base Fee (wei)"
              value={minBaseFee}
              onChange={setMinBaseFee}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(minBaseFee) < 1_000_000_000 || Number(minBaseFee) > 500_000_000_000 ?
                "Expected value between 1 Gwei and 500 Gwei" : undefined}
            />
            <Input
              label="Minimum Block Gas Cost"
              value={minBlockGasCost}
              onChange={setMinBlockGasCost}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(minBlockGasCost) > 1_000_000_000 ?
                "Expected value between 0 and 1,000,000,000" : undefined}
            />
            <Input
              label="Maximum Block Gas Cost"
              value={maxBlockGasCost}
              onChange={setMaxBlockGasCost}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(maxBlockGasCost) > 10_000_000_000 ?
                "Expected value between 0 and 10,000,000,000" : undefined}
            />
            <Input
              label="Block Gas Cost Step"
              value={blockGasCostStep}
              onChange={setBlockGasCostStep}
              type="number"
              min="0"
              disabled={isSettingConfig}
              helperText={Number(blockGasCostStep) > 5_000_000 ?
                "Expected value between 0 and 5,000,000" : undefined}
            />
          </ConfigGroup>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleSetFeeConfig}
              loading={isSettingConfig}
              variant="primary"
              disabled={!canSetFeeConfig}
              className="flex-1"
            >
              Set Fee Configuration
            </Button>
            <Button
              onClick={handleGetFeeConfig}
              loading={isReadingConfig}
              variant="secondary"
              disabled={isReadingConfig || isSettingConfig}
              className="flex items-center justify-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isReadingConfig && "animate-spin")} />
              Get Current Config
            </Button>
          </div>

          {/* Success Message */}
          {activeAction === "set" && txHash && (
            <ResultField
              label="Transaction Successful"
              value={txHash}
              showCheck={true}
            />
          )}

          {/* Current Config Display */}
          <ConfigDisplay config={currentConfig} lastChangedAt={lastChangedAt} />
        </div>
      </PrecompileCodeViewer>
    </CheckPrecompile>
  );
}

export default withConsoleToolMetadata(FeeManager, metadata);
