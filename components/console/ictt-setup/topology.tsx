"use client";

import { cn } from "@/lib/utils";
import {
  Check,
  Circle,
  ArrowDown,
  Box,
  Link2,
  Loader2,
} from "lucide-react";
import type { ICTTStep } from "@/components/toolbox/stores/icttSetupStore";

interface ChainInfo {
  name: string;
  evmChainId?: number;
  logoUrl?: string;
}

interface Progress {
  selectToken: boolean;
  deployHome: boolean;
  deployRemote: boolean;
  register: boolean;
  collateral: boolean;
}

interface ICTTTopologyProps {
  homeChain: ChainInfo | null;
  remoteChain: { chainId: string; name: string } | null;
  progress: Progress;
  currentStep: ICTTStep;
  onStepClick: (step: ICTTStep) => void;
}

export function ICTTTopology({
  homeChain,
  remoteChain,
  progress,
  currentStep,
  onStepClick,
}: ICTTTopologyProps) {
  const homeStatus = progress.deployHome ? "deployed" : currentStep === "deploy-home" ? "active" : "pending";
  const remoteStatus = progress.deployRemote ? "deployed" : currentStep === "deploy-remote" ? "active" : "pending";
  const connectionStatus = progress.register ? "connected" : progress.deployRemote ? "ready" : "pending";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Bridge Topology
        </h3>
      </div>

      <div className="p-6">
        {/* Home Chain Node */}
        <button
          onClick={() => onStepClick("deploy-home")}
          className={cn(
            "w-full p-4 rounded-xl border-2 transition-all text-left",
            homeStatus === "deployed"
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : homeStatus === "active"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500/20"
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {homeChain?.logoUrl ? (
                <img
                  src={homeChain.logoUrl}
                  alt={homeChain.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              )}
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {homeChain?.name || "Source Chain"}
              </span>
            </div>
            <StatusBadge status={homeStatus} />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Box className="w-3.5 h-3.5" />
            <span>Token Home</span>
            {homeStatus === "deployed" && (
              <span className="text-green-600 dark:text-green-400">• Deployed</span>
            )}
          </div>
        </button>

        {/* Connection Line */}
        <div className="flex flex-col items-center py-3">
          <div
            className={cn(
              "w-0.5 h-8 rounded-full transition-colors",
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "ready"
                ? "bg-blue-500"
                : "bg-zinc-200 dark:bg-zinc-700"
            )}
          />
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2 -my-1 bg-white dark:bg-zinc-900 transition-colors",
              connectionStatus === "connected"
                ? "border-green-500 text-green-500"
                : connectionStatus === "ready"
                ? "border-blue-500 text-blue-500"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-400"
            )}
          >
            {connectionStatus === "connected" ? (
              <Check className="w-4 h-4" />
            ) : connectionStatus === "ready" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </div>
          <div
            className={cn(
              "w-0.5 h-8 rounded-full transition-colors",
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "ready"
                ? "bg-blue-500"
                : "bg-zinc-200 dark:bg-zinc-700"
            )}
          />
          {connectionStatus !== "pending" && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
              {connectionStatus === "connected" ? "ICM Linked" : "Registering..."}
            </span>
          )}
        </div>

        {/* Remote Chain Node */}
        <button
          onClick={() => onStepClick("deploy-remote")}
          disabled={!progress.deployHome}
          className={cn(
            "w-full p-4 rounded-xl border-2 transition-all text-left",
            remoteStatus === "deployed"
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : remoteStatus === "active"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500/20"
              : "border-zinc-200 dark:border-zinc-700",
            !progress.deployHome && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {remoteChain?.name || "Destination Chain"}
              </span>
            </div>
            <StatusBadge status={remoteStatus} />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Link2 className="w-3.5 h-3.5" />
            <span>Token Remote</span>
            {remoteStatus === "deployed" && (
              <span className="text-green-600 dark:text-green-400">• Deployed</span>
            )}
          </div>
        </button>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Deployed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span>Pending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "deployed" | "active" | "pending" }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
        status === "deployed"
          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
          : status === "active"
          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
      )}
    >
      {status === "deployed" ? "Live" : status === "active" ? "Active" : "Pending"}
    </span>
  );
}

export default ICTTTopology;
