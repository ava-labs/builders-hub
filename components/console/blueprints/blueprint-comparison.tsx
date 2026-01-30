"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { gamingConfig, defiConfig, rwaConfig } from "./blueprint-configs";
import {
  Check,
  X,
  Info,
  ArrowRight,
  Gamepad2,
  TrendingUp,
  Building2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BlueprintData {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  href: string;
  deployHref: string;
  blockTime: string;
  blockTimeValue: number;
  gasLimit: string;
  gasLimitValue: number;
  minBaseFee: string;
  minBaseFeeValue: number;
  throughput: string;
  compliance: { enabled: boolean; features: string[] };
  statePruning: boolean;
  bestFor: string[];
  feeStability: string;
}

const blueprints: BlueprintData[] = [
  {
    id: "gaming",
    name: "Gaming",
    icon: <Gamepad2 className="w-4 h-4" />,
    color: "text-pink-500",
    href: "/console/blueprints/gaming",
    deployHref: "/console/layer-1/create?blueprint=gaming",
    blockTime: "1s",
    blockTimeValue: gamingConfig.genesis.data.config.feeConfig.targetBlockRate,
    gasLimit: "20M",
    gasLimitValue: gamingConfig.genesis.data.config.feeConfig.gasLimit,
    minBaseFee: "1 gwei",
    minBaseFeeValue: gamingConfig.genesis.data.config.feeConfig.minBaseFee,
    throughput: "~10K TPS",
    compliance: { enabled: false, features: [] },
    statePruning: true,
    bestFor: ["Games", "NFTs", "Metaverse"],
    feeStability: "High (48)",
  },
  {
    id: "defi",
    name: "DeFi",
    icon: <TrendingUp className="w-4 h-4" />,
    color: "text-violet-500",
    href: "/console/blueprints/defi",
    deployHref: "/console/layer-1/create?blueprint=defi",
    blockTime: "1s",
    blockTimeValue: defiConfig.genesis.data.config.feeConfig.targetBlockRate,
    gasLimit: "30M",
    gasLimitValue: defiConfig.genesis.data.config.feeConfig.gasLimit,
    minBaseFee: "10 gwei",
    minBaseFeeValue: defiConfig.genesis.data.config.feeConfig.minBaseFee,
    throughput: "~15K TPS",
    compliance: { enabled: false, features: [] },
    statePruning: true,
    bestFor: ["DEX", "Lending", "Derivatives"],
    feeStability: "Standard (36)",
  },
  {
    id: "rwa",
    name: "Tokenization",
    icon: <Building2 className="w-4 h-4" />,
    color: "text-emerald-500",
    href: "/console/blueprints/rwa",
    deployHref: "/console/layer-1/create?blueprint=rwa",
    blockTime: "2s",
    blockTimeValue: rwaConfig.genesis.data.config.feeConfig.targetBlockRate,
    gasLimit: "15M",
    gasLimitValue: rwaConfig.genesis.data.config.feeConfig.gasLimit,
    minBaseFee: "25 gwei",
    minBaseFeeValue: rwaConfig.genesis.data.config.feeConfig.minBaseFee,
    throughput: "~5K TPS",
    compliance: { enabled: true, features: ["KYC", "Allowlist"] },
    statePruning: false,
    bestFor: ["Securities", "RWA", "Regulated"],
    feeStability: "Standard (36)",
  },
];

interface FeatureRowProps {
  label: string;
  tooltip: string;
  values: React.ReactNode[];
  highlight?: "highest" | "lowest" | null;
  highlightIndices?: number[];
}

function FeatureRow({
  label,
  tooltip,
  values,
  highlight,
  highlightIndices = [],
}: FeatureRowProps) {
  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 cursor-help">
                {label}
                <Info className="w-3.5 h-3.5 text-zinc-400" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
      {values.map((value, idx) => (
        <td
          key={idx}
          className={cn(
            "px-4 py-3 text-sm text-center",
            highlightIndices.includes(idx)
              ? highlight === "highest"
                ? "text-green-600 dark:text-green-400 font-medium"
                : highlight === "lowest"
                ? "text-blue-600 dark:text-blue-400 font-medium"
                : "text-zinc-600 dark:text-zinc-400"
              : "text-zinc-600 dark:text-zinc-400"
          )}
        >
          {value}
        </td>
      ))}
    </tr>
  );
}

function ComplianceCell({
  compliance,
}: {
  compliance: { enabled: boolean; features: string[] };
}) {
  if (!compliance.enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-400">
        <X className="w-4 h-4" />
        None
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
      <Check className="w-4 h-4" />
      {compliance.features.join(" + ")}
    </span>
  );
}

function BooleanCell({ value, trueText, falseText }: { value: boolean; trueText: string; falseText: string }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
      <Check className="w-4 h-4" />
      {trueText}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-zinc-400">
      <X className="w-4 h-4" />
      {falseText}
    </span>
  );
}

export function BlueprintComparison() {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  // Find highest/lowest for highlighting
  const gasLimitValues = blueprints.map((b) => b.gasLimitValue);
  const highestGasLimit = Math.max(...gasLimitValues);
  const lowestBaseFee = Math.min(...blueprints.map((b) => b.minBaseFeeValue));
  const fastestBlock = Math.min(...blueprints.map((b) => b.blockTimeValue));

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-zinc-200 dark:border-zinc-700">
            <th className="px-4 py-4 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400 w-40">
              Feature
            </th>
            {blueprints.map((blueprint, idx) => (
              <th
                key={blueprint.id}
                className={cn(
                  "px-4 py-4 text-center min-w-[160px] transition-colors",
                  hoveredColumn === idx && "bg-zinc-50 dark:bg-zinc-800/50"
                )}
                onMouseEnter={() => setHoveredColumn(idx)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      blueprint.id === "gaming" && "bg-pink-100 dark:bg-pink-900/30",
                      blueprint.id === "defi" && "bg-violet-100 dark:bg-violet-900/30",
                      blueprint.id === "rwa" && "bg-emerald-100 dark:bg-emerald-900/30"
                    )}
                  >
                    <span className={blueprint.color}>{blueprint.icon}</span>
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {blueprint.name}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <FeatureRow
            label="Block Time"
            tooltip="How often new blocks are produced. Faster blocks mean quicker transaction confirmation."
            values={blueprints.map((b) => b.blockTime)}
            highlight="lowest"
            highlightIndices={blueprints
              .map((b, i) => (b.blockTimeValue === fastestBlock ? i : -1))
              .filter((i) => i >= 0)}
          />
          <FeatureRow
            label="Gas Limit"
            tooltip="Maximum gas per block. Higher limits allow more transactions per block."
            values={blueprints.map((b) => b.gasLimit)}
            highlight="highest"
            highlightIndices={blueprints
              .map((b, i) => (b.gasLimitValue === highestGasLimit ? i : -1))
              .filter((i) => i >= 0)}
          />
          <FeatureRow
            label="Min Base Fee"
            tooltip="Minimum transaction fee. Lower fees are better for high-frequency actions."
            values={blueprints.map((b) => b.minBaseFee)}
            highlight="lowest"
            highlightIndices={blueprints
              .map((b, i) => (b.minBaseFeeValue === lowestBaseFee ? i : -1))
              .filter((i) => i >= 0)}
          />
          <FeatureRow
            label="Fee Stability"
            tooltip="Higher denominator = more stable fees. Gaming uses 48 for stable fees during spikes."
            values={blueprints.map((b) => b.feeStability)}
          />
          <FeatureRow
            label="Throughput"
            tooltip="Estimated transactions per second based on gas limit and block time."
            values={blueprints.map((b) => (
              <span key={b.id} className="font-mono">{b.throughput}</span>
            ))}
          />
          <FeatureRow
            label="Compliance"
            tooltip="Built-in KYC and allowlist support for regulated assets."
            values={blueprints.map((b) => (
              <ComplianceCell key={b.id} compliance={b.compliance} />
            ))}
          />
          <FeatureRow
            label="State Pruning"
            tooltip="Pruning reduces storage by removing old state. Disabled for compliance chains that need full history."
            values={blueprints.map((b) => (
              <BooleanCell
                key={b.id}
                value={b.statePruning}
                trueText="Enabled"
                falseText="Full History"
              />
            ))}
          />
          <FeatureRow
            label="Best For"
            tooltip="Recommended use cases for this blueprint configuration."
            values={blueprints.map((b) => (
              <div key={b.id} className="flex flex-wrap justify-center gap-1">
                {b.bestFor.map((use) => (
                  <span
                    key={use}
                    className="inline-block px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    {use}
                  </span>
                ))}
              </div>
            ))}
          />
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-200 dark:border-zinc-700">
            <td className="px-4 py-4" />
            {blueprints.map((blueprint, idx) => (
              <td
                key={blueprint.id}
                className={cn(
                  "px-4 py-4 transition-colors",
                  hoveredColumn === idx && "bg-zinc-50 dark:bg-zinc-800/50"
                )}
                onMouseEnter={() => setHoveredColumn(idx)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div className="flex flex-col items-center gap-2">
                  <Link
                    href={blueprint.href}
                    className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    View Details
                  </Link>
                  <Link
                    href={blueprint.deployHref}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors",
                      blueprint.id === "gaming" && "bg-pink-500 hover:bg-pink-600",
                      blueprint.id === "defi" && "bg-violet-500 hover:bg-violet-600",
                      blueprint.id === "rwa" && "bg-emerald-500 hover:bg-emerald-600"
                    )}
                  >
                    Deploy
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default BlueprintComparison;
