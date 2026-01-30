"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useViemChainStore, useToolboxStore } from "@/components/toolbox/stores/toolboxStore";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import ProxyAdminABI from "@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json";
import TransparentUpgradeableProxyABI from "@/contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json";
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractDeployViewer, type ContractSource } from "@/components/console/contract-deploy-viewer";
import { Check, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

// Storage slot with the admin of the proxy (following EIP1967)
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// Pre-deployed proxy address on L1s created via Builder Console
const GENESIS_PROXY_ADDRESS = "0xfacade0000000000000000000000000000000000";

// OpenZeppelin v4.9.0 source URLs
const OZ_VERSION = "v4.9.0";
const CONTRACT_SOURCES: ContractSource[] = [
  {
    name: "TransparentUpgradeableProxy",
    filename: "TransparentUpgradeableProxy.sol",
    url: `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${OZ_VERSION}/contracts/proxy/transparent/TransparentUpgradeableProxy.sol`,
    description: "EIP-1967 compliant proxy that delegates calls to an implementation contract while preserving state.",
  },
  {
    name: "ProxyAdmin",
    filename: "ProxyAdmin.sol",
    url: `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/${OZ_VERSION}/contracts/proxy/transparent/ProxyAdmin.sol`,
    description: "Manages proxy upgrades. For production, this should be a multisig since it controls the validator manager implementation.",
  },
];

const metadata: ConsoleToolMetadata = {
  title: "Proxy Setup",
  description: "Upgrade or deploy the TransparentUpgradeableProxy for the ValidatorManager",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function ProxySetup({ onSuccess }: BaseConsoleToolProps) {
  const { validatorManagerAddress } = useToolboxStore();
  const selectedL1 = useSelectedL1()();
  const { publicClient, walletChainId, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  // Upgrade state
  const [proxyAddress, setProxyAddress] = useState<string>(GENESIS_PROXY_ADDRESS);
  const [proxyAdminAddress, setProxyAdminAddress] = useState<string>("");
  const [currentImplementation, setCurrentImplementation] = useState<string>("");
  const [desiredImplementation, setDesiredImplementation] = useState<string>("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isLoadingProxyInfo, setIsLoadingProxyInfo] = useState(false);
  const [proxyError, setProxyError] = useState<string>("");

  // Deploy state (optional advanced flow)
  const [showDeploySection, setShowDeploySection] = useState(false);
  const [isDeployingProxyAdmin, setIsDeployingProxyAdmin] = useState(false);
  const [isDeployingProxy, setIsDeployingProxy] = useState(false);
  const [newProxyAdminAddress, setNewProxyAdminAddress] = useState<string>("");
  const [newProxyAddress, setNewProxyAddress] = useState<string>("");
  const [deployImplementationAddress, setDeployImplementationAddress] = useState<string>("");

  // Load proxy address from selected L1
  useEffect(() => {
    (async function () {
      try {
        const subnetId = selectedL1?.subnetId;
        if (!subnetId) return;

        const info = await getSubnetInfo(subnetId);
        const contractAddress = info.l1ValidatorManagerDetails?.contractAddress;
        if (contractAddress) {
          setProxyAddress(contractAddress);
        }
      } catch (error) {
        console.error("Failed to load L1 info:", error);
      }
    })();
  }, [selectedL1?.subnetId]);

  // Pre-fill desired implementation from store
  useEffect(() => {
    if (validatorManagerAddress && !desiredImplementation) {
      setDesiredImplementation(validatorManagerAddress);
    }
  }, [validatorManagerAddress, desiredImplementation]);

  // Read proxy info when address changes
  useEffect(() => {
    if (proxyAddress) {
      readProxyInfo(proxyAddress);
    }
  }, [proxyAddress, walletChainId]);

  async function readProxyInfo(address: string) {
    setIsLoadingProxyInfo(true);
    setProxyError("");
    setProxyAdminAddress("");
    setCurrentImplementation("");

    try {
      // Read admin from EIP-1967 storage slot
      const adminData = await publicClient.getStorageAt({
        address: address as `0x${string}`,
        slot: ADMIN_SLOT as `0x${string}`,
      });

      if (!adminData || adminData === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        setProxyError("No proxy admin found at this address. The contract may not be an EIP-1967 proxy.");
        return;
      }

      const adminAddress = `0x${adminData.slice(-40)}`;
      setProxyAdminAddress(adminAddress);

      // Read current implementation
      try {
        const implementation = await publicClient.readContract({
          address: adminAddress as `0x${string}`,
          abi: ProxyAdminABI.abi,
          functionName: "getProxyImplementation",
          args: [address],
        });
        setCurrentImplementation(implementation as string);
      } catch (implError) {
        setProxyError("Failed to read current implementation. ProxyAdmin may not be compatible.");
      }
    } catch (error) {
      setProxyError("Failed to read proxy storage. Make sure you're connected to the correct network.");
    } finally {
      setIsLoadingProxyInfo(false);
    }
  }

  async function handleUpgrade() {
    if (!desiredImplementation || !proxyAddress || !proxyAdminAddress) return;

    setIsUpgrading(true);
    try {
      const upgradePromise = coreWalletClient.writeContract({
        address: proxyAdminAddress as `0x${string}`,
        abi: ProxyAdminABI.abi,
        functionName: "upgrade",
        args: [proxyAddress, desiredImplementation as `0x${string}`],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: "call", name: "Upgrade Proxy" }, upgradePromise, viemChain ?? undefined);

      const hash = await upgradePromise;
      await publicClient.waitForTransactionReceipt({ hash });
      await readProxyInfo(proxyAddress);
      onSuccess?.();
    } finally {
      setIsUpgrading(false);
    }
  }

  async function deployProxyAdmin() {
    setIsDeployingProxyAdmin(true);
    setNewProxyAdminAddress("");

    try {
      const deployPromise = coreWalletClient.deployContract({
        abi: ProxyAdminABI.abi as any,
        bytecode: ProxyAdminABI.bytecode.object as `0x${string}`,
        args: [],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: "deploy", name: "ProxyAdmin" }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.contractAddress) {
        setNewProxyAdminAddress(receipt.contractAddress);
      }
    } finally {
      setIsDeployingProxyAdmin(false);
    }
  }

  async function deployTransparentProxy() {
    if (!deployImplementationAddress || !newProxyAdminAddress) return;

    setIsDeployingProxy(true);
    setNewProxyAddress("");

    try {
      const deployPromise = coreWalletClient.deployContract({
        abi: TransparentUpgradeableProxyABI.abi as any,
        bytecode: TransparentUpgradeableProxyABI.bytecode.object as `0x${string}`,
        args: [deployImplementationAddress, newProxyAdminAddress, "0x"],
        chain: viemChain ?? undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: "deploy", name: "TransparentUpgradeableProxy" }, deployPromise, viemChain ?? undefined);

      const hash = await deployPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.contractAddress) {
        setNewProxyAddress(receipt.contractAddress);
        // Auto-fill the upgrade section with the new proxy
        setProxyAddress(receipt.contractAddress);
        setShowDeploySection(false);
      }
    } finally {
      setIsDeployingProxy(false);
    }
  }

  const isUpgradeNeeded =
    currentImplementation && desiredImplementation
      ? currentImplementation.toLowerCase() !== desiredImplementation.toLowerCase()
      : true;

  const canUpgrade = !!proxyAddress && !!proxyAdminAddress && !!desiredImplementation && isUpgradeNeeded && !proxyError;
  const upgradeComplete = !isUpgradeNeeded && !!currentImplementation;

  return (
    <ContractDeployViewer contracts={CONTRACT_SOURCES}>
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Content area */}
        <div className="p-4 space-y-3">
          {/* Upgrade Proxy Section (Primary) */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              upgradeComplete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  upgradeComplete
                    ? "bg-green-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {upgradeComplete ? <Check className="w-3 h-3" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Upgrade Proxy Implementation
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Point proxy to ValidatorManager. Genesis proxy:{" "}
                  <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                    {GENESIS_PROXY_ADDRESS.slice(0, 12)}...
                  </code>
                </p>

                <div className="mt-3 space-y-2">
                  {/* Proxy Address + Info Row */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Proxy Address
                      </label>
                      <input
                        type="text"
                        value={proxyAddress}
                        onChange={(e) => setProxyAddress(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                        placeholder="0x..."
                      />
                    </div>
                    <button
                      onClick={() => readProxyInfo(proxyAddress)}
                      disabled={isLoadingProxyInfo || !proxyAddress}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isLoadingProxyInfo ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {/* Proxy Info Display - Compact */}
                  {proxyError ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400 px-1">{proxyError}</p>
                  ) : proxyAdminAddress ? (
                    <div className="flex gap-4 text-[11px] px-1">
                      <span className="text-zinc-500">
                        Admin: <code className="text-zinc-700 dark:text-zinc-300">{proxyAdminAddress.slice(0, 8)}...{proxyAdminAddress.slice(-4)}</code>
                      </span>
                      <span className="text-zinc-500">
                        Impl: <code className="text-zinc-700 dark:text-zinc-300">{currentImplementation ? `${currentImplementation.slice(0, 8)}...${currentImplementation.slice(-4)}` : "None"}</code>
                      </span>
                    </div>
                  ) : null}

                  {/* Desired Implementation Input */}
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      New Implementation (ValidatorManager)
                    </label>
                    <input
                      type="text"
                      value={desiredImplementation}
                      onChange={(e) => setDesiredImplementation(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                      placeholder="0x..."
                    />
                  </div>

                  {upgradeComplete ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Proxy is up to date</span>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={handleUpgrade}
                      loading={isUpgrading}
                      disabled={!canUpgrade || isUpgrading}
                      className="w-full"
                    >
                      {!proxyAdminAddress
                        ? "Enter Proxy Address"
                        : !desiredImplementation
                        ? "Enter Implementation"
                        : "Upgrade Proxy"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deploy New Proxy Section (Optional/Advanced) */}
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDeploySection(!showDeploySection)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              {showDeploySection ? (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              )}
              <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Deploy New Proxy
                <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400">C-Chain / Custom</span>
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            </button>

            {showDeploySection && (
              <div className="px-3 pb-3 space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-3">
                {/* Warning */}
                <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 rounded-lg">
                  Only for L1s without genesis proxy. Builder Console L1s have proxy at <code>{GENESIS_PROXY_ADDRESS.slice(0,10)}...</code>
                </p>

                {/* Two-column layout for deploy steps */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Step 1: Deploy ProxyAdmin */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-zinc-400">01</span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">ProxyAdmin</span>
                    </div>
                    {newProxyAdminAddress ? (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        <code className="text-[10px] font-mono text-zinc-500 truncate">{newProxyAdminAddress.slice(0,10)}...</code>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={deployProxyAdmin}
                        loading={isDeployingProxyAdmin}
                        disabled={isDeployingProxyAdmin}
                        className="w-full text-xs py-1.5"
                      >
                        Deploy
                      </Button>
                    )}
                  </div>

                  {/* Step 2: Deploy Proxy */}
                  <div className={`space-y-1.5 ${!newProxyAdminAddress ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-zinc-400">02</span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Proxy</span>
                    </div>
                    {newProxyAddress ? (
                      <div className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        <code className="text-[10px] font-mono text-zinc-500 truncate">{newProxyAddress.slice(0,10)}...</code>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={deployTransparentProxy}
                        loading={isDeployingProxy}
                        disabled={!newProxyAdminAddress || !deployImplementationAddress || isDeployingProxy}
                        className="w-full text-xs py-1.5"
                      >
                        Deploy
                      </Button>
                    )}
                  </div>
                </div>

                {/* Implementation input - full width below */}
                {!newProxyAddress && newProxyAdminAddress && (
                  <input
                    type="text"
                    value={deployImplementationAddress}
                    onChange={(e) => setDeployImplementationAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                    placeholder="Implementation address for proxy..."
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <Link
            href="/docs/avalanche-l1s/validator-manager/contract"
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Docs →
          </Link>
          <a
            href={`https://github.com/OpenZeppelin/openzeppelin-contracts/tree/${OZ_VERSION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-mono transition-colors"
          >
            OpenZeppelin {OZ_VERSION}
          </a>
        </div>
      </div>
    </ContractDeployViewer>
  );
}

export default withConsoleToolMetadata(ProxySetup, metadata);
