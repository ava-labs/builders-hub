"use client";

import React from "react";
import {
  BridgeConnection,
  ConnectionStatus as ConnectionStatusType,
  statusLabels,
  statusColors,
  tokenTypeLabels,
} from "@/hooks/useICTTWorkbench";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { cn } from "@/lib/utils";
import {
  Globe,
  ArrowRight,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface ConnectionStatusProps {
  connections: BridgeConnection[];
  getChainById: (chainId: string) => L1ListItem | undefined;
  onConnectionClick: (connection: BridgeConnection) => void;
  selectedConnection: BridgeConnection | null;
  onRemoveConnection: (connectionId: string) => void;
}

// Map status to next action
const statusNextSteps: Record<
  ConnectionStatusType,
  { label: string; href: string; description: string }
> = {
  "not-started": {
    label: "Deploy Token Home",
    href: "/console/ictt/setup/deploy-token-home",
    description: "Deploy the TokenHome contract on the source chain",
  },
  "home-deployed": {
    label: "Deploy Token Remote",
    href: "/console/ictt/setup/erc20-remote",
    description: "Deploy the TokenRemote contract on the destination chain",
  },
  "remote-deployed": {
    label: "Register with Home",
    href: "/console/ictt/setup/register-with-home",
    description: "Register the remote contract with the home contract",
  },
  registered: {
    label: "Add Collateral",
    href: "/console/ictt/setup/add-collateral",
    description: "Add collateral to enable token transfers",
  },
  collateralized: {
    label: "Test Transfer",
    href: "/console/ictt/token-transfer",
    description: "Test the bridge with a token transfer",
  },
  live: {
    label: "Transfer Tokens",
    href: "/console/ictt/token-transfer",
    description: "Bridge is live! Transfer tokens between chains",
  },
};

// Status icon component
function StatusIcon({ status }: { status: ConnectionStatusType }) {
  const colors = statusColors[status];

  if (status === "live") {
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  }

  if (status === "not-started") {
    return <AlertCircle className="w-5 h-5 text-zinc-400" />;
  }

  return <Clock className={cn("w-5 h-5", colors.text)} />;
}

// Progress bar component
function StatusProgress({ status }: { status: ConnectionStatusType }) {
  const statusOrder: ConnectionStatusType[] = [
    "not-started",
    "home-deployed",
    "remote-deployed",
    "registered",
    "collateralized",
    "live",
  ];
  const currentIndex = statusOrder.indexOf(status);
  const progress = ((currentIndex + 1) / statusOrder.length) * 100;

  return (
    <div className="w-full bg-zinc-700 rounded-full h-1.5">
      <div
        className={cn(
          "h-1.5 rounded-full transition-all duration-500",
          status === "live" ? "bg-green-500" : "bg-blue-500"
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function ConnectionStatus({
  connections,
  getChainById,
  onConnectionClick,
  selectedConnection,
  onRemoveConnection,
}: ConnectionStatusProps) {
  if (connections.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          <p className="text-sm">No bridge connections yet.</p>
          <p className="text-xs mt-1">
            Click on a chain above to create your first bridge connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Bridge Status
        </h3>
      </div>

      {/* Connection list */}
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {connections.map((connection) => {
          const sourceChain = getChainById(connection.sourceChainId);
          const targetChain = getChainById(connection.targetChainId);
          const isSelected = selectedConnection?.id === connection.id;
          const nextStep = statusNextSteps[connection.status];
          const colors = statusColors[connection.status];

          return (
            <div
              key={connection.id}
              className={cn(
                "p-4 transition-colors",
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              )}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => onConnectionClick(connection)}
              >
                {/* Chains */}
                <div className="flex items-center gap-2 min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    {sourceChain?.logoUrl ? (
                      <img
                        src={sourceChain.logoUrl}
                        alt={sourceChain.name}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-zinc-500" />
                    )}
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {sourceChain?.name || "Unknown"}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                  <div className="flex items-center gap-1.5">
                    {targetChain?.logoUrl ? (
                      <img
                        src={targetChain.logoUrl}
                        alt={targetChain.name}
                        className="w-5 h-5 rounded-full"
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-zinc-500" />
                    )}
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {targetChain?.name || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Token */}
                <div className="flex items-center gap-2 min-w-[100px]">
                  {connection.token.logoUrl && (
                    <img
                      src={connection.token.logoUrl}
                      alt={connection.token.symbol}
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {connection.token.symbol}
                  </span>
                </div>

                {/* Type */}
                <div className="hidden md:block min-w-[120px]">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    {tokenTypeLabels[connection.tokenType]}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 flex-1">
                  <StatusIcon status={connection.status} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", colors.text)}>
                        {statusLabels[connection.status]}
                      </span>
                    </div>
                    <StatusProgress status={connection.status} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveConnection(connection.id);
                    }}
                    className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                    title="Remove connection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded details when selected */}
              {isSelected && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  {/* Contract addresses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Token Home Contract</p>
                      {connection.contracts.homeAddress ? (
                        <code className="text-xs text-zinc-700 dark:text-zinc-300 break-all">
                          {connection.contracts.homeAddress}
                        </code>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Not deployed yet</span>
                      )}
                    </div>
                    <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Token Remote Contract</p>
                      {connection.contracts.remoteAddress ? (
                        <code className="text-xs text-zinc-700 dark:text-zinc-300 break-all">
                          {connection.contracts.remoteAddress}
                        </code>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Not deployed yet</span>
                      )}
                    </div>
                  </div>

                  {/* Next step action */}
                  <div className="flex items-center justify-between bg-white dark:bg-zinc-800 rounded-lg p-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Next Step: {nextStep.label}
                      </p>
                      <p className="text-xs text-zinc-500">{nextStep.description}</p>
                    </div>
                    <Link
                      href={nextStep.href}
                      className={cn(
                        "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        connection.status === "live"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      )}
                    >
                      {connection.status === "live" ? "Transfer" : "Continue"}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConnectionStatus;
