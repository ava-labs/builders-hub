"use client";

import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import type { AbiEvent } from "viem";
import { useEffect, useState } from "react";
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import { Button } from "@/components/toolbox/components/Button";
import { ChevronDown, ChevronRight, RefreshCw, Check, Database, Activity } from "lucide-react";
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractFunctionViewer } from "@/components/console/contract-function-viewer";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

type ViewData = {
  [key: string]: any;
};

const serializeValue = (value: any): any => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]));
  }
  return value;
};

const metadata: ConsoleToolMetadata = {
  title: "Read Contract",
  description: "Read and view contract state from the ValidatorManager",
  toolRequirements: [WalletRequirementsConfigKey.CoreWalletConnected],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ReadContract({ onSuccess }: BaseConsoleToolProps) {
  const [criticalError, setCriticalError] = useState<Error | null>(null);
  const [proxyAddress, setProxyAddress] = useState<string>("");
  const [viewData, setViewData] = useState<ViewData>({});
  const [isReading, setIsReading] = useState(false);
  const [eventLogs, setEventLogs] = useState<Record<string, any[]>>({});
  const { publicClient } = useWalletStore();
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const selectedL1 = useSelectedL1()();
  const [selectedFunction, setSelectedFunction] = useState<string>("admin");

  if (criticalError) {
    throw criticalError;
  }

  useEffect(() => {
    (async function () {
      try {
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) return;
        const info = await getSubnetInfo(subnetId);
        const newProxyAddress = info.l1ValidatorManagerDetails?.contractAddress || "";
        setProxyAddress(newProxyAddress);
      } catch (error) {
        setCriticalError(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  }, [selectedL1]);

  async function readContractData() {
    if (!proxyAddress) return;
    setIsReading(true);
    setEventLogs({});

    if (!proxyAddress || !window.avalanche) return;

    try {
      const viewFunctions = ValidatorManagerABI.abi.filter(
        (item: any) => item.type === "function" && (item.stateMutability === "view" || item.stateMutability === "pure")
      );

      const data: ViewData = {};

      for (const func of viewFunctions) {
        if (!func.name) continue;
        if (func.inputs.length > 0) continue;

        try {
          const result = await publicClient.readContract({
            address: proxyAddress as `0x${string}`,
            abi: [func],
            functionName: func.name,
          });
          data[func.name] = serializeValue(result);
        } catch (error) {
          console.error(`Error reading ${func.name}:`, error);
          data[func.name] = "Error: " + ((error as Error)?.message?.slice(0, 50) || "Unknown");
        }
      }

      setViewData(data);

      const events = ValidatorManagerABI.abi.filter((item: any) => item.type === "event");
      const logs: Record<string, any[]> = {};

      for (const event of events) {
        if (!event.name) continue;
        try {
          const eventLogs = await publicClient.getLogs({
            address: proxyAddress as `0x${string}`,
            event: event as AbiEvent,
            fromBlock: 0n,
            toBlock: "latest",
          });
          logs[event.name] = eventLogs.map((log) => serializeValue(log));
        } catch (error) {
          console.error(`Error getting logs for ${event.name}:`, error);
        }
      }
      setEventLogs(logs);
    } catch (error) {
      console.error("Main error:", error);
      setCriticalError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsReading(false);
    }
  }

  useEffect(() => {
    readContractData();
  }, [proxyAddress]);

  const toggleEventExpansion = (eventName: string) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventName]: !prev[eventName],
    }));
  };

  const totalEvents = Object.values(eventLogs).reduce((acc, logs) => acc + logs.length, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left: Contract Data */}
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                Proxy Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={proxyAddress}
                  onChange={(e) => setProxyAddress(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                  placeholder="0x..."
                />
                <button
                  onClick={readContractData}
                  disabled={isReading || !proxyAddress}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isReading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* View Functions */}
          {Object.keys(viewData).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3.5 h-3.5 text-zinc-400" />
                <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  State ({Object.keys(viewData).length})
                </h3>
              </div>
              <div className="space-y-1">
                {Object.entries(viewData).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedFunction(key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedFunction === key
                        ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                        : "bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    <span className={`text-xs font-mono ${selectedFunction === key ? "text-amber-700 dark:text-amber-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                      {key}()
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate ml-2 max-w-[120px]">
                      {typeof value === "string" ? value.slice(0, 16) : JSON.stringify(value).slice(0, 16)}
                      {(typeof value === "string" ? value.length : JSON.stringify(value).length) > 16 ? "..." : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Value Display */}
          {selectedFunction && viewData[selectedFunction] !== undefined && (
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300">
                  {selectedFunction}()
                </span>
              </div>
              <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all">
                {typeof viewData[selectedFunction] === "string"
                  ? viewData[selectedFunction]
                  : JSON.stringify(viewData[selectedFunction], null, 2)}
              </pre>
            </div>
          )}

          {/* Events */}
          {Object.keys(eventLogs).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <h3 className="text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Events ({totalEvents})
                </h3>
              </div>
              <div className="space-y-1">
                {Object.entries(eventLogs).map(([eventName, logs]) => (
                  <div key={eventName} className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      onClick={() => toggleEventExpansion(eventName)}
                    >
                      <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                        {expandedEvents[eventName] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        {eventName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {logs.length}
                      </span>
                    </button>
                    {expandedEvents[eventName] && (
                      <div className="p-2 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 max-h-32 overflow-auto">
                        {logs.length > 0 ? (
                          <pre className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            {JSON.stringify(logs, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-[10px] text-zinc-400 italic">No events</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isReading && Object.keys(viewData).length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-zinc-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Reading contract...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Click a function to view in code</span>
          <a
            href={`https://github.com/ava-labs/icm-contracts/tree/${ICM_COMMIT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            @{ICM_COMMIT.slice(0, 7)}
          </a>
        </div>
      </div>

      {/* Right: Contract Source */}
      <ContractFunctionViewer
        contractName="ValidatorManager"
        filename="ValidatorManager.sol"
        sourceUrl={`https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`}
        githubUrl={`https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`}
        highlightFunction={selectedFunction}
        description={`Viewing ${selectedFunction}() function`}
        showFunctionOnly={true}
      />
    </div>
  );
}

export default withConsoleToolMetadata(ReadContract, metadata);
