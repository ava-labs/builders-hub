"use client";

import React, { useMemo, useState } from "react";
import { BridgeConnection } from "@/hooks/useICTTWorkbench";
import { L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { cn } from "@/lib/utils";
import { Copy, Download, Check, RefreshCw, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";

interface RelayerConfigProps {
  connections: BridgeConnection[];
  centerChain: L1ListItem;
  getChainById: (chainId: string) => L1ListItem | undefined;
}

interface RelayerConfigSource {
  blockchainID: string;
  rpcEndpoint: {
    baseURL: string;
  };
  messageContracts: {
    [key: string]: {
      messageFormat: string;
      settings: {
        "reward-address": string;
      };
    };
  };
}

interface RelayerConfigDestination {
  blockchainID: string;
  rpcEndpoint: {
    baseURL: string;
  };
  accountPrivateKey: string;
}

interface RelayerConfigJSON {
  "log-level": string;
  "p-chain-api": {
    baseURL: string;
    queryParameters: Record<string, never>;
    httpHeaders: Record<string, never>;
  };
  "info-api": {
    baseURL: string;
    queryParameters: Record<string, never>;
    httpHeaders: Record<string, never>;
  };
  "source-blockchains": RelayerConfigSource[];
  "destination-blockchains": RelayerConfigDestination[];
}

export function RelayerConfig({
  connections,
  centerChain,
  getChainById,
}: RelayerConfigProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate relayer config based on connections
  const relayerConfig = useMemo(() => {
    // Collect all unique chains involved
    const chainIds = new Set<string>();
    chainIds.add(centerChain.id);

    connections.forEach((conn) => {
      chainIds.add(conn.sourceChainId);
      chainIds.add(conn.targetChainId);
    });

    // Build source-blockchains config
    const sourceBlockchains: RelayerConfigSource[] = [];
    const destinationBlockchains: RelayerConfigDestination[] = [];

    chainIds.forEach((chainId) => {
      const chain = getChainById(chainId);
      if (!chain) return;

      // Find connections where this chain is the source
      const sourceConnections = connections.filter(
        (conn) => conn.sourceChainId === chainId
      );

      // Build message contracts for source
      const messageContracts: RelayerConfigSource["messageContracts"] = {};

      if (chain.wellKnownTeleporterRegistryAddress) {
        // Use teleporter registry if available
        messageContracts[chain.wellKnownTeleporterRegistryAddress] = {
          messageFormat: "teleporter",
          settings: {
            "reward-address": "0x0000000000000000000000000000000000000000",
          },
        };
      }

      // Add home contracts from connections
      sourceConnections.forEach((conn) => {
        if (conn.contracts.homeAddress) {
          messageContracts[conn.contracts.homeAddress] = {
            messageFormat: "teleporter",
            settings: {
              "reward-address": "0x0000000000000000000000000000000000000000",
            },
          };
        }
      });

      if (Object.keys(messageContracts).length > 0) {
        sourceBlockchains.push({
          blockchainID: chain.id,
          rpcEndpoint: {
            baseURL: chain.rpcUrl.replace("/rpc", ""),
          },
          messageContracts,
        });
      }

      // Add as destination
      destinationBlockchains.push({
        blockchainID: chain.id,
        rpcEndpoint: {
          baseURL: chain.rpcUrl.replace("/rpc", ""),
        },
        accountPrivateKey: "<RELAYER_PRIVATE_KEY>",
      });
    });

    const config: RelayerConfigJSON = {
      "log-level": "info",
      "p-chain-api": {
        baseURL: "https://api.avax-test.network",
        queryParameters: {},
        httpHeaders: {},
      },
      "info-api": {
        baseURL: "https://api.avax-test.network",
        queryParameters: {},
        httpHeaders: {},
      },
      "source-blockchains": sourceBlockchains,
      "destination-blockchains": destinationBlockchains,
    };

    return config;
  }, [connections, centerChain, getChainById]);

  const configString = useMemo(() => {
    return JSON.stringify(relayerConfig, null, 2);
  }, [relayerConfig]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([configString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relayer-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Relayer Configuration
          </h3>
          <span className="text-xs text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">
            Auto-generated
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Config content */}
      {isExpanded && (
        <div className="p-4">
          {/* Info banner */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              This configuration is auto-generated based on your bridge connections.
              Replace <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">&lt;RELAYER_PRIVATE_KEY&gt;</code> with
              your relayer&apos;s private key before deploying.
            </p>
          </div>

          {/* Config preview */}
          <div className="relative">
            <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-4 rounded-lg text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
              <code>{configString}</code>
            </pre>

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={handleCopy}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                )}
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-2 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-md transition-colors"
                title="Download config"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chain summary */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Source Chains</p>
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {relayerConfig["source-blockchains"].length}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Destination Chains</p>
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {relayerConfig["destination-blockchains"].length}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Active Bridges</p>
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {connections.filter((c) => c.status === "live").length}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-3">
              <p className="text-xs text-zinc-500">Pending Setup</p>
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                {connections.filter((c) => c.status !== "live").length}
              </p>
            </div>
          </div>

          {/* Setup instructions */}
          <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Next Steps
            </h4>
            <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Download the configuration file</li>
              <li>Replace the placeholder private key with your relayer wallet&apos;s private key</li>
              <li>Fund the relayer wallet on all destination chains</li>
              <li>Run the AWM Relayer with this configuration</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default RelayerConfig;
