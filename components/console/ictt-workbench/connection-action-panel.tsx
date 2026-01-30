"use client";

import React, { useMemo, useState, useEffect } from "react";
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
  X,
  CheckCircle2,
  Circle,
  Lock,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DeployHomeStep } from "./steps/deploy-home-step";
import { DeployRemoteStep } from "./steps/deploy-remote-step";
import { RegisterStep } from "./steps/register-step";
import { CollateralStep } from "./steps/collateral-step";

interface ConnectionActionPanelProps {
  connection: BridgeConnection;
  onUpdate: (updates: Partial<BridgeConnection>) => void;
  onClose: () => void;
  getChainById: (chainId: string) => L1ListItem | undefined;
}

// Status order for progress calculation
const statusOrder: ConnectionStatusType[] = [
  "not-started",
  "home-deployed",
  "remote-deployed",
  "registered",
  "collateralized",
  "live",
];

// Map status to step index (0-3 for our 4 deployment steps)
function getStepIndexForStatus(status: ConnectionStatusType): number {
  switch (status) {
    case "not-started":
      return 0;
    case "home-deployed":
      return 1;
    case "remote-deployed":
      return 2;
    case "registered":
    case "collateralized":
    case "live":
      return 3;
    default:
      return 0;
  }
}

// Check if a step is complete
function isStepComplete(stepIndex: number, status: ConnectionStatusType): boolean {
  const currentIndex = getStepIndexForStatus(status);
  return stepIndex < currentIndex || status === "live";
}

// Check if a step is the current active step
function isStepActive(stepIndex: number, status: ConnectionStatusType): boolean {
  return getStepIndexForStatus(status) === stepIndex && status !== "live";
}

// Check if a step is locked (not yet reachable)
function isStepLocked(stepIndex: number, status: ConnectionStatusType): boolean {
  return getStepIndexForStatus(status) < stepIndex;
}

// Copy to clipboard helper
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

export function ConnectionActionPanel({
  connection,
  onUpdate,
  onClose,
  getChainById,
}: ConnectionActionPanelProps) {
  const sourceChain = getChainById(connection.sourceChainId);
  const targetChain = getChainById(connection.targetChainId);
  const colors = statusColors[connection.status];

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    const currentIndex = statusOrder.indexOf(connection.status);
    return Math.round(((currentIndex + 1) / statusOrder.length) * 100);
  }, [connection.status]);

  // Controlled accordion state - updates when connection status changes
  const [openStep, setOpenStep] = useState<string>(() => {
    const stepIndex = getStepIndexForStatus(connection.status);
    return `step-${stepIndex}`;
  });

  // Update open step when connection status changes
  useEffect(() => {
    const stepIndex = getStepIndexForStatus(connection.status);
    setOpenStep(`step-${stepIndex}`);
  }, [connection.status]);

  // Steps configuration
  const steps = [
    {
      id: "step-0",
      title: "Deploy Token Home",
      description: "Deploy the TokenHome contract on the source chain",
    },
    {
      id: "step-1",
      title: "Deploy Token Remote",
      description: "Deploy the TokenRemote contract on the destination chain",
    },
    {
      id: "step-2",
      title: "Register with Home",
      description: "Link the remote contract to the home contract",
    },
    {
      id: "step-3",
      title: "Add Collateral",
      description: "Add collateral to enable token transfers",
    },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Source Chain */}
            <div className="flex items-center gap-1.5">
              {sourceChain?.logoUrl ? (
                <img
                  src={sourceChain.logoUrl}
                  alt={sourceChain.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <Globe className="w-6 h-6 text-zinc-500" />
              )}
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {sourceChain?.name || "Unknown"}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-400" />
            {/* Target Chain */}
            <div className="flex items-center gap-1.5">
              {targetChain?.logoUrl ? (
                <img
                  src={targetChain.logoUrl}
                  alt={targetChain.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <Globe className="w-6 h-6 text-zinc-500" />
              )}
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {targetChain?.name || "Unknown"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Token & Type Info */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            {connection.token.logoUrl && (
              <img
                src={connection.token.logoUrl}
                alt={connection.token.symbol}
                className="w-4 h-4 rounded-full"
              />
            )}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {connection.token.symbol}
            </span>
          </div>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {tokenTypeLabels[connection.tokenType]}
          </span>
        </div>
      </div>

      {/* Status Progress */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-sm font-medium", colors.text)}>
            {statusLabels[connection.status]}
          </span>
          <span className="text-xs text-zinc-500">{progressPercent}%</span>
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              connection.status === "live" ? "bg-green-500" : "bg-blue-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Deployment Steps Accordion */}
      <div className="flex-1 overflow-y-auto">
        <Accordion
          type="single"
          collapsible
          value={openStep}
          onValueChange={setOpenStep}
          className="w-full"
        >
          {steps.map((step, index) => {
            const complete = isStepComplete(index, connection.status);
            const active = isStepActive(index, connection.status);
            const locked = isStepLocked(index, connection.status);

            return (
              <AccordionItem key={step.id} value={step.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <AccordionTrigger
                  className={cn(
                    "px-4 py-3 hover:no-underline",
                    locked && "opacity-60"
                  )}
                  disabled={locked}
                >
                  <div className="flex items-center gap-3">
                    {/* Step indicator */}
                    {complete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : active ? (
                      <Circle className="w-5 h-5 text-blue-500 flex-shrink-0 fill-blue-500/20" />
                    ) : locked ? (
                      <Lock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                    )}
                    <div className="text-left">
                      <div className={cn(
                        "text-sm font-medium",
                        complete ? "text-green-600 dark:text-green-400" :
                        active ? "text-blue-600 dark:text-blue-400" :
                        "text-zinc-700 dark:text-zinc-300"
                      )}>
                        {step.title}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {step.description}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {locked ? (
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm text-zinc-500 dark:text-zinc-400">
                      Complete the previous step to unlock this action.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {index === 0 && (
                        <DeployHomeStep
                          connection={connection}
                          onSuccess={(homeAddress) => {
                            onUpdate({
                              status: "home-deployed",
                              contracts: {
                                ...connection.contracts,
                                homeAddress,
                              },
                            });
                          }}
                          disabled={complete}
                          sourceChain={sourceChain}
                        />
                      )}
                      {index === 1 && (
                        <DeployRemoteStep
                          connection={connection}
                          onSuccess={(remoteAddress) => {
                            onUpdate({
                              status: "remote-deployed",
                              contracts: {
                                ...connection.contracts,
                                remoteAddress,
                              },
                            });
                          }}
                          disabled={complete}
                          sourceChain={sourceChain}
                          targetChain={targetChain}
                        />
                      )}
                      {index === 2 && (
                        <RegisterStep
                          connection={connection}
                          onSuccess={() => {
                            onUpdate({ status: "registered" });
                          }}
                          disabled={complete}
                          sourceChain={sourceChain}
                          targetChain={targetChain}
                        />
                      )}
                      {index === 3 && (
                        <CollateralStep
                          connection={connection}
                          onSuccess={() => {
                            onUpdate({ status: "live" });
                          }}
                          disabled={complete && connection.status === "live"}
                          sourceChain={sourceChain}
                          targetChain={targetChain}
                        />
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Contract Addresses Footer */}
      {(connection.contracts.homeAddress || connection.contracts.remoteAddress) && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0 space-y-2">
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Contract Addresses
          </h4>
          {connection.contracts.homeAddress && (
            <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Token Home</div>
                <code className="text-xs text-zinc-700 dark:text-zinc-300 truncate block">
                  {connection.contracts.homeAddress}
                </code>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => copyToClipboard(connection.contracts.homeAddress!)}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                {sourceChain?.explorerUrl && (
                  <a
                    href={`${sourceChain.explorerUrl}/address/${connection.contracts.homeAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </a>
                )}
              </div>
            </div>
          )}
          {connection.contracts.remoteAddress && (
            <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Token Remote</div>
                <code className="text-xs text-zinc-700 dark:text-zinc-300 truncate block">
                  {connection.contracts.remoteAddress}
                </code>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => copyToClipboard(connection.contracts.remoteAddress!)}
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                {targetChain?.explorerUrl && (
                  <a
                    href={`${targetChain.explorerUrl}/address/${connection.contracts.remoteAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConnectionActionPanel;
