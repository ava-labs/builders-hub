"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { hexToBytes, decodeErrorResult, Abi } from "viem";
import { packWarpIntoAccessList } from "../ValidatorManager/packWarp";
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import { Button } from "@/components/toolbox/components/Button";
import { getSubnetInfo } from "@/components/toolbox/coreViem/utils/glacier";
import { useAvalancheSDKChainkit } from "@/components/toolbox/stores/useAvalancheSDKChainkit";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter";
import { ContractFunctionViewer } from "@/components/console/contract-function-viewer";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import versions from "@/scripts/versions.json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const add0x = (hex: string): `0x${string}` => (hex.startsWith("0x") ? (hex as `0x${string}`) : `0x${hex}`);

const metadata: ConsoleToolMetadata = {
  title: "Initialize Validator Set",
  description: "Initialize the ValidatorManager with the initial validator set from P-Chain",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function InitValidatorSet({ onSuccess }: BaseConsoleToolProps) {
  const [conversionTxID, setConversionTxID] = useState<string>("");
  const [L1ConversionSignature, setL1ConversionSignature] = useState<string>("");
  const viemChain = useViemChainStore();
  const { publicClient, walletEVMAddress } = useWalletStore();
  const { coreWalletClient } = useConnectedWallet();
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectedData, setCollectedData] = useState<Record<string, any>>({});
  const [showDebugData, setShowDebugData] = useState(false);
  const selectedL1 = useSelectedL1()();
  const [conversionTxIDError, setConversionTxIDError] = useState<string>("");
  const [isAggregating, setIsAggregating] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  const { sendCoreWalletNotSetNotification, notify } = useConsoleNotifications();

  async function aggSigs() {
    setError(null);
    setIsAggregating(true);

    const aggPromise = (async () => {
      const { message, justification, signingSubnetId } = await coreWalletClient.extractWarpMessageFromPChainTx({
        txId: conversionTxID,
      });

      const { signedMessage } = await aggregateSignature({
        message: message,
        justification: justification,
        signingSubnetId: signingSubnetId,
        quorumPercentage: 67,
      });
      setL1ConversionSignature(signedMessage);
      return signedMessage;
    })();

    notify({ type: "local", name: "Aggregate Signatures" }, aggPromise);

    try {
      await aggPromise;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsAggregating(false);
    }
  }

  useEffect(() => {
    setConversionTxIDError("");
    const subnetId = selectedL1?.subnetId;
    if (!subnetId) return;
    getSubnetInfo(subnetId)
      .then((subnetInfo) => {
        setConversionTxID(subnetInfo.l1ConversionTransactionHash);
      })
      .catch((error) => {
        console.error("Error getting subnet info:", error);
        setConversionTxIDError((error as Error)?.message || "Unknown error");
      });
  }, [selectedL1?.subnetId]);

  const onInitialize = async () => {
    if (!conversionTxID) {
      setError("Conversion Tx ID is required");
      return;
    }
    const evmChainRpcUrl = selectedL1?.rpcUrl;
    if (!coreWalletClient) {
      sendCoreWalletNotSetNotification();
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const { validators, subnetId, chainId, managerAddress } = await coreWalletClient.extractWarpMessageFromPChainTx({
        txId: conversionTxID,
      });
      const txArgs = [
        {
          subnetID: add0x(cb58ToHex(subnetId)),
          validatorManagerBlockchainID: add0x(cb58ToHex(chainId)),
          validatorManagerAddress: managerAddress as `0x${string}`,
          initialValidators: validators.map(
            ({ nodeID, weight, signer }: { nodeID: string; weight: number; signer: { publicKey: string } }) => {
              const nodeIDBytes = nodeID.startsWith("0x") ? nodeID : add0x(nodeID);
              const blsPublicKeyBytes = signer.publicKey.startsWith("0x") ? signer.publicKey : add0x(signer.publicKey);
              return {
                nodeID: nodeIDBytes,
                blsPublicKey: blsPublicKeyBytes,
                weight: weight,
              };
            }
          ),
        },
        0,
      ];

      setCollectedData({ ...(txArgs[0] as any), L1ConversionSignature });

      const signatureBytes = hexToBytes(add0x(L1ConversionSignature));
      const accessList = packWarpIntoAccessList(signatureBytes);

      const initPromise = coreWalletClient.writeContract({
        address: managerAddress as `0x${string}`,
        abi: ValidatorManagerABI.abi,
        functionName: "initializeValidatorSet",
        args: txArgs,
        accessList,
        gas: BigInt(2_000_000),
        chain: viemChain || undefined,
        account: walletEVMAddress as `0x${string}`,
      });

      notify({ type: "call", name: "Initialize Validator Set" }, initPromise, viemChain ?? undefined);

      const hash = await initPromise;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        const decodedError = await debugTraceAndDecode(hash, evmChainRpcUrl!);
        throw new Error(`Transaction failed: ${decodedError}`);
      }

      setTxSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsInitializing(false);
    }
  };

  const step1Complete = !!L1ConversionSignature;
  const step2Complete = txSuccess;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Initialize Controls */}
      <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Step 1: Aggregate Signatures */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              step1Complete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step1Complete
                    ? "bg-green-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {step1Complete ? <Check className="w-3 h-3" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Aggregate Conversion Signature</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Collect BLS signatures from validators for the{" "}
                  <Link
                    href="/docs/rpcs/p-chain/txn-format#unsigned-convert-subnet-to-l1-tx"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ConvertSubnetToL1Tx
                  </Link>
                  . Ensure port <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px]">9651</code> is open on all validators.
                </p>

                <div className="mt-2 space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Conversion Tx ID (P-Chain)
                    </label>
                    <input
                      type="text"
                      value={conversionTxID}
                      onChange={(e) => setConversionTxID(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
                      placeholder="txID..."
                    />
                    {conversionTxIDError && <p className="mt-0.5 text-[10px] text-red-500">{conversionTxIDError}</p>}
                  </div>

                  {step1Complete ? (
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <code className="text-[10px] font-mono text-zinc-500 truncate">
                        {L1ConversionSignature.slice(0, 24)}...
                      </code>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={aggSigs}
                      loading={isAggregating}
                      disabled={!conversionTxID || isAggregating}
                      className="w-full"
                    >
                      {isAggregating ? "Aggregating..." : "Aggregate Signatures"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Initialize Validator Set */}
          <div
            className={`p-3 rounded-xl border transition-colors ${
              step2Complete
                ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                : step1Complete
                ? "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
                : "bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200/50 dark:border-zinc-800 opacity-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step2Complete
                    ? "bg-green-500 text-white"
                    : step1Complete
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    : "bg-zinc-200/50 dark:bg-zinc-800 text-zinc-400"
                }`}
              >
                {step2Complete ? <Check className="w-3 h-3" /> : "2"}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-sm font-medium ${
                    step1Complete ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  Initialize Validator Set
                </h3>
                <p
                  className={`mt-1 text-xs ${
                    step1Complete ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  Submit the aggregated signature to register initial validators on-chain via{" "}
                  <a
                    href="https://eips.ethereum.org/EIPS/eip-2930"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    EIP-2930
                  </a>{" "}
                  access list
                </p>

                {step1Complete && (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        Aggregated Signature
                      </label>
                      <textarea
                        value={L1ConversionSignature}
                        onChange={(e) => setL1ConversionSignature(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono h-16 resize-none"
                        placeholder="0x..."
                      />
                    </div>

                    {step2Complete ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Validator set initialized</span>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={onInitialize}
                        loading={isInitializing}
                        disabled={!L1ConversionSignature || isInitializing}
                        className="w-full"
                      >
                        Initialize Validator Set
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Debug Data (collapsible) */}
          {Object.keys(collectedData).length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDebugData(!showDebugData)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {showDebugData ? (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Debug Data</span>
              </button>
              {showDebugData && (
                <div className="px-3 pb-3 border-t border-zinc-200 dark:border-zinc-700">
                  <pre className="mt-2 p-2 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-auto max-h-32">
                    {JSON.stringify(collectedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between mt-auto">
          <span className="text-xs text-zinc-500">Calls initializeValidatorSet()</span>
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

      {/* Right: Contract Source with file tabs */}
      <ContractFunctionViewer
        sources={[
          {
            filename: "ValidatorManager.sol",
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
            githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`,
            highlightFunction: "initializeValidatorSet",
          },
          {
            filename: "IACP99Manager.sol",
            sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/interfaces/IACP99Manager.sol`,
            githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/interfaces/IACP99Manager.sol`,
            highlightFunction: "ConversionData",
          },
        ]}
        showFunctionOnly={true}
      />
    </div>
  );
}

export default withConsoleToolMetadata(InitValidatorSet, metadata);

const debugTraceAndDecode = async (txHash: string, rpcEndpoint: string) => {
  const traceResponse = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "debug_traceTransaction",
      params: [txHash, { tracer: "callTracer" }],
      id: 1,
    }),
  });

  const trace = await traceResponse.json();
  const errorSelector = trace.result.output;
  if (errorSelector && errorSelector.startsWith("0x")) {
    try {
      const errorResult = decodeErrorResult({
        abi: ValidatorManagerABI.abi as Abi,
        data: errorSelector,
      });
      return `${errorResult.errorName}${errorResult.args ? ": " + errorResult.args.join(", ") : ""}`;
    } catch (e: unknown) {
      console.error("Error decoding error result:", e);
      return "Unknown error selector found in trace";
    }
  }
  return "No error selector found in trace";
};
