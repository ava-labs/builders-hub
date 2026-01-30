"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useEffect, useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { AbiEvent } from "viem";
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { utils } from "@avalabs/avalanchejs";
import { ContractFunctionViewer } from "@/components/console/contract-function-viewer";
import { Check, RefreshCw, AlertCircle } from "lucide-react";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
  title: "Initialize Validator Manager",
  description: "Initialize the ValidatorManager contract with admin and churn settings",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function Initialize({ onSuccess }: BaseConsoleToolProps) {
  const { walletEVMAddress, publicClient } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const [isChecking, setIsChecking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [churnPeriodSeconds, setChurnPeriodSeconds] = useState("0");
  const [maximumChurnPercentage, setMaximumChurnPercentage] = useState("20");
  const [adminAddress, setAdminAddress] = useState("");
  const viemChain = useViemChainStore();
  const selectedL1 = useSelectedL1()();
  const [subnetId, setSubnetId] = useState("");
  const createChainStoreSubnetId = useCreateChainStore()((state) => state.subnetId);
  const managerAddress = useCreateChainStore()((state) => state.managerAddress);
  const setManagerAddress = useCreateChainStore()((state) => state.setManagerAddress);

  const { notify } = useConsoleNotifications();

  useEffect(() => {
    if (walletEVMAddress && !adminAddress) {
      setAdminAddress(walletEVMAddress);
    }
  }, [walletEVMAddress, adminAddress]);

  useEffect(() => {
    if (createChainStoreSubnetId && !subnetId) {
      setSubnetId(createChainStoreSubnetId);
    } else if (selectedL1?.subnetId && !subnetId) {
      setSubnetId(selectedL1.subnetId);
    }
  }, [createChainStoreSubnetId, selectedL1, subnetId]);

  let subnetIDHex = "";
  try {
    subnetIDHex = cb58ToHex(subnetId || "");
  } catch (error) {
    console.error("Error decoding subnetId:", error);
  }

  async function checkIfInitialized() {
    if (!managerAddress || !window.avalanche) return;

    setIsChecking(true);
    try {
      const initializedEvent = ValidatorManagerABI.abi.find(
        (item) => item.type === "event" && item.name === "Initialized"
      );

      if (!initializedEvent) {
        throw new Error("Initialized event not found in ABI");
      }

      try {
        await publicClient.readContract({
          address: managerAddress as `0x${string}`,
          abi: ValidatorManagerABI.abi,
          functionName: "admin",
        });
        setIsInitialized(true);
        return;
      } catch (readError) {
        if ((readError as any)?.message?.includes("not initialized")) {
          setIsInitialized(false);
          return;
        }
      }

      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 2000n ? latestBlock - 2000n : 0n;

      const logs = await publicClient.getLogs({
        address: managerAddress as `0x${string}`,
        event: initializedEvent as AbiEvent,
        fromBlock: fromBlock,
        toBlock: "latest",
      });

      setIsInitialized(logs.length > 0);
    } catch (error) {
      console.error("Error checking initialization:", error);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleInitialize() {
    setIsInitializing(true);

    const formattedSubnetId = subnetIDHex.startsWith("0x") ? subnetIDHex : `0x${subnetIDHex}`;
    const formattedAdmin = adminAddress as `0x${string}`;

    const settings = {
      admin: formattedAdmin,
      subnetID: formattedSubnetId,
      churnPeriodSeconds: BigInt(churnPeriodSeconds),
      maximumChurnPercentage: Number(maximumChurnPercentage),
    };

    const initPromise = coreWalletClient.writeContract({
      address: managerAddress as `0x${string}`,
      abi: ValidatorManagerABI.abi,
      functionName: "initialize",
      args: [settings],
      chain: viemChain ?? undefined,
      account: walletEVMAddress as `0x${string}`,
    });

    notify({ type: "call", name: "Initialize Validator Manager" }, initPromise, viemChain ?? undefined);

    try {
      const hash = await initPromise;
      await publicClient.waitForTransactionReceipt({ hash });
      await checkIfInitialized();
      onSuccess?.();
    } finally {
      setIsInitializing(false);
    }
  }

  const canInitialize = managerAddress && subnetId && adminAddress && isInitialized === false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Initialize Controls */}
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Step 1: Select Manager */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              managerAddress && isInitialized !== null
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  managerAddress && isInitialized !== null
                    ? "bg-green-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {managerAddress && isInitialized !== null ? <Check className="w-3 h-3" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">ValidatorManager Address</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  The ValidatorManager contract address (or proxy)
                </p>
                <div className="mt-2 flex gap-2 items-end">
                  <input
                    type="text"
                    value={managerAddress}
                    onChange={(e) => setManagerAddress(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                    placeholder="0x..."
                  />
                  <button
                    onClick={checkIfInitialized}
                    disabled={isChecking || !managerAddress}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    title="Check status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isChecking ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {isInitialized !== null && (
                  <div className={`mt-2 text-xs flex items-center gap-1 ${isInitialized ? "text-amber-600" : "text-green-600"}`}>
                    {isInitialized ? (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        Already initialized
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Ready to initialize
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Select Subnet */}
          <div className="p-3 rounded-xl border transition-colors bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Select L1/Subnet</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  The Subnet ID this manager will control
                </p>
                <div className="mt-2">
                  <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
                </div>
                {subnetIDHex && (
                  <p className="mt-1 text-[10px] text-zinc-400 font-mono truncate">
                    Hex: {subnetIDHex.slice(0, 20)}... ({utils.hexToBuffer(subnetIDHex).length} bytes)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Configuration */}
          <div className="p-3 rounded-xl border bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                3
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Configuration</h3>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Admin Address
                  </label>
                  <input
                    type="text"
                    value={adminAddress}
                    onChange={(e) => setAdminAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                    placeholder="0x..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Churn Period (sec)
                    </label>
                    <input
                      type="number"
                      value={churnPeriodSeconds}
                      onChange={(e) => setChurnPeriodSeconds(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Max Churn %
                    </label>
                    <input
                      type="number"
                      value={maximumChurnPercentage}
                      onChange={(e) => setMaximumChurnPercentage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {isInitialized === true ? (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Contract already initialized
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleInitialize}
                    loading={isInitializing}
                    disabled={!canInitialize || isInitializing}
                    className="w-full"
                  >
                    Initialize Contract
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initialize(settings)</span>
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
        highlightFunction="initialize"
        description="Sets admin, subnetID, and churn parameters"
        showFunctionOnly={true}
      />
    </div>
  );
}

export default withConsoleToolMetadata(Initialize, metadata);
