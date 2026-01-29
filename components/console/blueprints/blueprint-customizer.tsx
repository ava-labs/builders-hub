"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sliders,
  RotateCcw,
  ArrowRight,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BlueprintType = "gaming" | "defi" | "rwa";

interface BlueprintDefaults {
  blockTime: number;
  gasLimit: number;
  minBaseFee: number;
  feeChangeDenominator: number;
  enableTxAllowlist: boolean;
  enableDeployerAllowlist: boolean;
  disablePruning: boolean;
}

const BLUEPRINT_DEFAULTS: Record<BlueprintType, BlueprintDefaults> = {
  gaming: {
    blockTime: 1,
    gasLimit: 20000000,
    minBaseFee: 1000000000, // 1 gwei
    feeChangeDenominator: 48,
    enableTxAllowlist: false,
    enableDeployerAllowlist: false,
    disablePruning: false,
  },
  defi: {
    blockTime: 1,
    gasLimit: 30000000,
    minBaseFee: 10000000000, // 10 gwei
    feeChangeDenominator: 36,
    enableTxAllowlist: false,
    enableDeployerAllowlist: false,
    disablePruning: false,
  },
  rwa: {
    blockTime: 2,
    gasLimit: 15000000,
    minBaseFee: 25000000000, // 25 gwei
    feeChangeDenominator: 36,
    enableTxAllowlist: true,
    enableDeployerAllowlist: true,
    disablePruning: true,
  },
};

interface CustomConfig extends BlueprintDefaults {
  baseBlueprint: BlueprintType;
}

function formatGwei(wei: number): string {
  return `${wei / 1e9} gwei`;
}

function formatGasLimit(limit: number): string {
  return `${limit / 1e6}M`;
}

function estimateTPS(gasLimit: number, blockTime: number): number {
  // Simple estimation: avg tx uses ~21000 gas
  const txPerBlock = Math.floor(gasLimit / 21000);
  return Math.round((txPerBlock / blockTime) * 0.5); // 50% utilization assumption
}

interface SliderInputProps {
  label: string;
  tooltip: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
  impact?: string;
  warning?: string;
}

function SliderInput({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  impact,
  warning,
}: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-help">
                {label}
                <Info className="w-3.5 h-3.5 text-zinc-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
          {formatValue(value)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md"
          style={{
            background: `linear-gradient(to right, rgb(139 92 246) ${percentage}%, rgb(228 228 231) ${percentage}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-zinc-400 mt-1">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>
      {impact && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{impact}</p>
      )}
      {warning && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          {warning}
        </p>
      )}
    </div>
  );
}

interface ToggleInputProps {
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  warning?: string;
}

function ToggleInput({
  label,
  tooltip,
  checked,
  onChange,
  warning,
}: ToggleInputProps) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between cursor-pointer group">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-help">
                {label}
                <Info className="w-3.5 h-3.5 text-zinc-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            checked ? "bg-violet-500" : "bg-zinc-300 dark:bg-zinc-600"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
              checked ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </label>
      {warning && checked && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 ml-0">
          <AlertTriangle className="w-3 h-3" />
          {warning}
        </p>
      )}
    </div>
  );
}

interface BlueprintCustomizerProps {
  blueprint: BlueprintType;
  onClose?: () => void;
}

export function BlueprintCustomizer({
  blueprint,
  onClose,
}: BlueprintCustomizerProps) {
  const router = useRouter();
  const defaults = BLUEPRINT_DEFAULTS[blueprint];

  const [config, setConfig] = useState<CustomConfig>({
    baseBlueprint: blueprint,
    ...defaults,
  });

  const updateConfig = <K extends keyof CustomConfig>(
    key: K,
    value: CustomConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setConfig({
      baseBlueprint: blueprint,
      ...defaults,
    });
  };

  // Calculate changes from defaults
  const changes = useMemo(() => {
    const diff: Array<{ label: string; from: string; to: string; direction: "up" | "down" | "changed" }> = [];

    if (config.blockTime !== defaults.blockTime) {
      diff.push({
        label: "Block time",
        from: `${defaults.blockTime}s`,
        to: `${config.blockTime}s`,
        direction: config.blockTime > defaults.blockTime ? "up" : "down",
      });
    }
    if (config.gasLimit !== defaults.gasLimit) {
      const change = ((config.gasLimit - defaults.gasLimit) / defaults.gasLimit) * 100;
      diff.push({
        label: "Gas limit",
        from: formatGasLimit(defaults.gasLimit),
        to: `${formatGasLimit(config.gasLimit)} (${change > 0 ? "+" : ""}${change.toFixed(0)}%)`,
        direction: config.gasLimit > defaults.gasLimit ? "up" : "down",
      });
    }
    if (config.minBaseFee !== defaults.minBaseFee) {
      diff.push({
        label: "Min base fee",
        from: formatGwei(defaults.minBaseFee),
        to: formatGwei(config.minBaseFee),
        direction: config.minBaseFee > defaults.minBaseFee ? "up" : "down",
      });
    }
    if (config.feeChangeDenominator !== defaults.feeChangeDenominator) {
      diff.push({
        label: "Fee stability",
        from: String(defaults.feeChangeDenominator),
        to: String(config.feeChangeDenominator),
        direction: config.feeChangeDenominator > defaults.feeChangeDenominator ? "up" : "down",
      });
    }
    if (config.enableTxAllowlist !== defaults.enableTxAllowlist) {
      diff.push({
        label: "Tx allowlist",
        from: defaults.enableTxAllowlist ? "Enabled" : "Disabled",
        to: config.enableTxAllowlist ? "Enabled" : "Disabled",
        direction: "changed",
      });
    }
    if (config.enableDeployerAllowlist !== defaults.enableDeployerAllowlist) {
      diff.push({
        label: "Deployer allowlist",
        from: defaults.enableDeployerAllowlist ? "Enabled" : "Disabled",
        to: config.enableDeployerAllowlist ? "Enabled" : "Disabled",
        direction: "changed",
      });
    }
    if (config.disablePruning !== defaults.disablePruning) {
      diff.push({
        label: "State pruning",
        from: defaults.disablePruning ? "Disabled" : "Enabled",
        to: config.disablePruning ? "Disabled" : "Enabled",
        direction: "changed",
      });
    }

    return diff;
  }, [config, defaults]);

  const estimatedTPS = estimateTPS(config.gasLimit, config.blockTime);
  const defaultTPS = estimateTPS(defaults.gasLimit, defaults.blockTime);
  const tpsChange = ((estimatedTPS - defaultTPS) / defaultTPS) * 100;

  const handleDeploy = () => {
    // Encode config as URL params for L1 creation
    const params = new URLSearchParams({
      blueprint: config.baseBlueprint,
      blockTime: String(config.blockTime),
      gasLimit: String(config.gasLimit),
      minBaseFee: String(config.minBaseFee),
      feeChangeDenominator: String(config.feeChangeDenominator),
      txAllowlist: String(config.enableTxAllowlist),
      deployerAllowlist: String(config.enableDeployerAllowlist),
      pruning: String(!config.disablePruning),
    });
    router.push(`/console/layer-1/create?${params.toString()}`);
  };

  const blueprintName = blueprint.charAt(0).toUpperCase() + blueprint.slice(1);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Customize {blueprintName} Blueprint
            </h3>
            <p className="text-sm text-zinc-500">
              Adjust parameters before deployment
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Configuration Section */}
          <div className="space-y-6">
            {/* Performance */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-4">
                Performance
              </h4>
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-help">
                            Block Time
                            <Info className="w-3.5 h-3.5 text-zinc-400" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p>How often new blocks are produced. Faster blocks = quicker finality but higher resource usage.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {config.blockTime}s
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2].map((time) => (
                      <button
                        key={time}
                        onClick={() => updateConfig("blockTime", time)}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                          config.blockTime === time
                            ? "bg-violet-500 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        {time}s {time === 1 ? "(faster)" : "(standard)"}
                      </button>
                    ))}
                  </div>
                </div>

                <SliderInput
                  label="Gas Limit"
                  tooltip="Maximum gas per block. Higher limits allow more transactions per block."
                  value={config.gasLimit}
                  min={10000000}
                  max={50000000}
                  step={1000000}
                  onChange={(v) => updateConfig("gasLimit", v)}
                  formatValue={formatGasLimit}
                  impact={`Estimated max: ~${estimateTPS(config.gasLimit, config.blockTime).toLocaleString()} TPS`}
                />
              </div>
            </div>

            {/* Fees */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-4">
                Fees
              </h4>
              <div className="space-y-5">
                <SliderInput
                  label="Min Base Fee"
                  tooltip="Minimum transaction fee. Lower fees are better for high-frequency actions but may invite spam."
                  value={config.minBaseFee}
                  min={0}
                  max={25000000000}
                  step={1000000000}
                  onChange={(v) => updateConfig("minBaseFee", v)}
                  formatValue={formatGwei}
                  warning={
                    config.minBaseFee === 0
                      ? "Zero fees may invite spam attacks"
                      : undefined
                  }
                />

                <SliderInput
                  label="Fee Stability"
                  tooltip="Higher values = more stable fees during demand spikes. Lower = more volatile but responsive."
                  value={config.feeChangeDenominator}
                  min={24}
                  max={72}
                  step={6}
                  onChange={(v) => updateConfig("feeChangeDenominator", v)}
                  formatValue={(v) => String(v)}
                  impact={
                    config.feeChangeDenominator >= 48
                      ? "Stable fees (recommended for gaming)"
                      : config.feeChangeDenominator >= 36
                      ? "Standard volatility"
                      : "High volatility"
                  }
                  warning={
                    config.feeChangeDenominator < 36
                      ? "Fees may spike significantly during high demand"
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Compliance */}
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide mb-4">
                Compliance (Advanced)
              </h4>
              <div className="space-y-4">
                <ToggleInput
                  label="Transaction Allowlist"
                  tooltip="Only addresses on the allowlist can send transactions. Required for regulated assets."
                  checked={config.enableTxAllowlist}
                  onChange={(v) => updateConfig("enableTxAllowlist", v)}
                  warning="Requires managing an allowlist of authorized addresses"
                />

                <ToggleInput
                  label="Contract Deployer Allowlist"
                  tooltip="Only approved addresses can deploy smart contracts. Prevents unauthorized tokens."
                  checked={config.enableDeployerAllowlist}
                  onChange={(v) => updateConfig("enableDeployerAllowlist", v)}
                  warning="Requires approval process for contract deployments"
                />

                <ToggleInput
                  label="Disable State Pruning"
                  tooltip="Keep full blockchain history. Required for audit compliance but increases storage."
                  checked={config.disablePruning}
                  onChange={(v) => updateConfig("disablePruning", v)}
                  warning="Significantly increases node storage requirements"
                />
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-4 sticky top-4">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Preview Changes
              </h4>

              {changes.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                  No changes from default {blueprintName} configuration
                </p>
              ) : (
                <div className="space-y-2">
                  {changes.map((change, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800"
                    >
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {change.label}
                      </span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-400 line-through">
                          {change.from}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span
                          className={cn(
                            "font-medium",
                            change.direction === "up"
                              ? "text-green-600 dark:text-green-400"
                              : change.direction === "down"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-violet-600 dark:text-violet-400"
                          )}
                        >
                          {change.to}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* TPS estimate */}
                  <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center justify-between p-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Estimated TPS
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          tpsChange > 0
                            ? "text-green-600 dark:text-green-400"
                            : tpsChange < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-600 dark:text-zinc-400"
                        )}
                      >
                        ~{estimatedTPS.toLocaleString()}
                        {tpsChange !== 0 && (
                          <span className="ml-1 text-xs">
                            ({tpsChange > 0 ? "+" : ""}
                            {tpsChange.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <button
                  onClick={resetToDefaults}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={handleDeploy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white transition-colors text-sm font-medium"
                >
                  Deploy
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BlueprintCustomizer;
