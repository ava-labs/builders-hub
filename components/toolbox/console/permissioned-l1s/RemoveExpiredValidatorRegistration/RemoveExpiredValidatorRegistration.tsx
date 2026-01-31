"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Abi, AbiEvent, Address, Log } from "viem";
import { bytesToHex, hexToBytes } from "viem";
import { Alert } from "@/components/toolbox/components/Alert";
import { Button } from "@/components/toolbox/components/Button";
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId";
import { ValidatorManagerDetails } from "@/components/toolbox/components/ValidatorManagerDetails";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails";
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import PoAManagerABI from "@/contracts/icm-contracts/compiled/PoAManager.json";
import { useAvalancheSDKChainkit } from "@/components/toolbox/stores/useAvalancheSDKChainkit";
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter";
import { GetRegistrationJustification } from "@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification";
import { packL1ValidatorRegistration } from "@/components/toolbox/coreViem/utils/convertWarp";
import { packWarpIntoAccessList } from "@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp";
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ContractFunctionViewer } from "@/components/console/contract-function-viewer";
import versions from "@/scripts/versions.json";
import {
  Search,
  Clock,
  Trash2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

type ParsedInitiatedRegistration = {
  validationId: string;
  registrationExpiry: bigint;
  nodeId?: string;
  blockNumber: bigint;
  txHash: Address;
};

const metadata: ConsoleToolMetadata = {
  title: "Remove Expired Validator Registration",
  description: "Find and remove expired validator registrations that are stuck in PendingAdded state",
  toolRequirements: [WalletRequirementsConfigKey.EVMChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url),
};

function RemoveExpiredValidatorRegistration() {
  const [subnetId, setSubnetId] = useState<string>(useCreateChainStore()((s) => s.subnetId) || "");
  const { publicClient, coreWalletClient, avalancheNetworkID } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBlock, setFromBlock] = useState<string>("");
  const [events, setEvents] = useState<ParsedInitiatedRegistration[]>([]);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [isLoadingValidators, setIsLoadingValidators] = useState<boolean>(false);
  const [validatorIdHexSet, setValidatorIdHexSet] = useState<Set<string>>(new Set());
  const [validatorStatusById, setValidatorStatusById] = useState<Record<string, number>>({});
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<string>("completeValidatorRemoval");
  const [actionState, setActionState] = useState<
    Record<
      string,
      {
        isProcessing: boolean;
        error?: string | null;
        signedMessage?: string | null;
        evmTxHash?: string | null;
      }
    >
  >({});

  const { listL1Validators } = useAvalancheSDKChainkit();
  const { aggregateSignature } = useAvalancheSDKChainkit();

  const {
    validatorManagerAddress,
    blockchainId,
    signingSubnetId,
    contractOwner,
    isOwnerContract,
    contractTotalWeight,
    l1WeightError,
    isLoadingL1Weight,
    isLoading: isLoadingVMCDetails,
    error: validatorManagerError,
    ownershipError,
    isLoadingOwnership,
    ownerType,
    isDetectingOwnerType,
  } = useValidatorManagerDetails({ subnetId });

  const initiatedEventAbi = useMemo(() => {
    const abi = ValidatorManagerABI.abi as unknown as Abi;
    return abi.find((i) => i.type === "event" && i.name === "InitiatedValidatorRegistration") as AbiEvent | undefined;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapFromBlock = async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const suggested = latest > 100000n ? (latest - 100000n).toString() : "0";
        if (!cancelled) setFromBlock((prev) => (prev ? prev : suggested));
      } catch {
        // ignore
      }
    };
    bootstrapFromBlock();
    return () => {
      cancelled = true;
    };
  }, [publicClient]);

  // Fetch current validators for the subnet
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!subnetId) {
        setValidatorIdHexSet(new Set());
        return;
      }
      setIsLoadingValidators(true);
      try {
        const result = await listL1Validators({ subnetId, pageSize: 200, includeInactiveL1Validators: false });
        const ids = new Set<string>();
        for await (const page of result) {
          let validatorsArr: any[] = [];
          if ("result" in page && page.result && "validators" in page.result) {
            validatorsArr = (page.result as any).validators as any[];
          }
          for (const v of validatorsArr) {
            if (!v?.validationId) continue;
            try {
              const hex = ("0x" + cb58ToHex(v.validationId)).toLowerCase();
              ids.add(hex);
            } catch {
              // ignore
            }
          }
        }
        if (!cancelled) setValidatorIdHexSet(ids);
      } catch {
        if (!cancelled) setValidatorIdHexSet(new Set());
      } finally {
        if (!cancelled) setIsLoadingValidators(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [subnetId, listL1Validators]);

  const fetchEvents = async () => {
    if (!validatorManagerAddress) {
      setError("Validator Manager address not found for selected subnet");
      return;
    }
    if (!initiatedEventAbi) {
      setError("InitiatedValidatorRegistration ABI not found");
      return;
    }
    setIsLoading(true);
    setError(null);
    setEvents([]);
    setFetchProgress(null);
    try {
      const startBlock = fromBlock && fromBlock.trim().length > 0 ? BigInt(fromBlock) : 0n;
      const latest = await publicClient.getBlockNumber();
      if (startBlock > latest) {
        setEvents([]);
        return;
      }
      const CHUNK_SIZE = 2000n;
      const totalBlocks = latest - startBlock;
      const totalChunks = Math.ceil(Number(totalBlocks) / Number(CHUNK_SIZE));
      let currentChunk = 0;
      let cursor = startBlock;
      const allLogs: any[] = [];

      while (cursor <= latest) {
        const to = cursor + CHUNK_SIZE > latest ? latest : cursor + CHUNK_SIZE;
        currentChunk++;
        setFetchProgress({ current: currentChunk, total: totalChunks });

        const chunkLogs = await publicClient.getLogs({
          address: validatorManagerAddress as Address,
          event: initiatedEventAbi,
          fromBlock: cursor,
          toBlock: to,
        });
        allLogs.push(...chunkLogs);
        cursor = to + 1n;
      }

      const parsed: ParsedInitiatedRegistration[] = allLogs.map((log: any) => {
        const args = (log as Log & { args?: any }).args || {};
        return {
          validationId: args.validationID as string,
          registrationExpiry: args.registrationExpiry as bigint,
          nodeId: args.nodeID as string | undefined,
          blockNumber: log.blockNumber as bigint,
          txHash: log.transactionHash as Address,
        };
      });
      setEvents(parsed);
    } catch (e) {
      console.error("Error fetching logs", e);
      setError((e as Error).message || "Failed to fetch logs");
    } finally {
      setIsLoading(false);
      setFetchProgress(null);
    }
  };

  // Fetch on-chain validator status for each validationID
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!validatorManagerAddress || events.length === 0) {
          if (!cancelled) setValidatorStatusById({});
          return;
        }
        const uniqueIds = Array.from(new Set(events.map((e) => (e.validationId || "").toLowerCase()).filter(Boolean)));
        const entries = await Promise.all(
          uniqueIds.map(async (id) => {
            try {
              const res: any = await publicClient.readContract({
                address: validatorManagerAddress as `0x${string}`,
                abi: ValidatorManagerABI.abi as Abi,
                functionName: "getValidator",
                args: [id as `0x${string}`],
              });
              const statusNum = Array.isArray(res) ? Number(res[0]) : Number(res?.status ?? 0);
              return [id, Number.isFinite(statusNum) ? statusNum : 0] as const;
            } catch {
              return [id, 0] as const;
            }
          })
        );
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const [id, status] of entries) map[id] = status;
        setValidatorStatusById(map);
      } catch {
        if (!cancelled) setValidatorStatusById({});
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [validatorManagerAddress, events, publicClient]);

  const formatExpiry = (expiry: bigint) => {
    try {
      const seconds = Number(expiry);
      if (!Number.isFinite(seconds)) return expiry.toString();
      return new Date(seconds * 1000).toLocaleString();
    } catch {
      return expiry.toString();
    }
  };

  const statusLabel = (status?: number) => {
    switch (status) {
      case 1:
        return "PendingAdded";
      case 2:
        return "Active";
      case 3:
        return "PendingRemoved";
      case 4:
        return "Completed";
      case 5:
        return "Invalidated";
      default:
        return "Unknown";
    }
  };

  const statusBadgeClass = (status?: number) => {
    switch (status) {
      case 1:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case 2:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      case 3:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
      case 4:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300";
      case 5:
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300";
    }
  };

  const getExplorerTxUrl = (hash?: string) => {
    try {
      const base = (viemChain as any)?.blockExplorers?.default?.url as string | undefined;
      if (!base || !hash) return undefined;
      return `${base.replace(/\/$/, "")}/tx/${hash}`;
    } catch {
      return undefined;
    }
  };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isLoadingStatuses = useMemo(() => {
    if (events.length === 0) return false;
    const ids = new Set(events.map((e) => (e.validationId || "").toLowerCase()).filter(Boolean));
    for (const id of ids) {
      if (validatorStatusById[id] === undefined) return true;
    }
    return false;
  }, [events, validatorStatusById]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const status = validatorStatusById[(e.validationId || "").toLowerCase()];
      if (status !== 1) return false;
      const isExpired = Number(e.registrationExpiry) < nowSeconds;
      if (!isExpired) return false;
      const present = validatorIdHexSet.has((e.validationId || "").toLowerCase());
      return !present;
    });
  }, [events, validatorIdHexSet, nowSeconds, validatorStatusById]);

  const handleForceRemove = async (validationId: string) => {
    setActionState((s) => ({
      ...s,
      [validationId]: {
        ...(s[validationId] || {}),
        isProcessing: true,
        error: null,
      },
    }));
    try {
      if (!validatorManagerAddress) throw new Error("Validator Manager address not found");
      if (!coreWalletClient || !viemChain || !coreWalletClient.account) throw new Error("Wallet/chain not initialized");
      if (!subnetId) throw new Error("Subnet ID required");

      const useMultisig = ownerType === "PoAManager";
      const targetContractAddress = useMultisig ? contractOwner : validatorManagerAddress;
      const targetAbi = useMultisig ? (PoAManagerABI.abi as Abi) : (ValidatorManagerABI.abi as Abi);

      const justification = await GetRegistrationJustification(validationId, subnetId, publicClient);
      if (!justification) throw new Error("Could not build justification for this validation ID");

      const validationIDBytes = hexToBytes(validationId as `0x${string}`);
      const removeValidatorMessage = packL1ValidatorRegistration(
        validationIDBytes,
        false,
        avalancheNetworkID,
        "11111111111111111111111111111111LpoYY"
      );
      const signaturePromise = aggregateSignature({
        message: bytesToHex(removeValidatorMessage),
        justification: bytesToHex(justification),
        signingSubnetId: signingSubnetId || subnetId,
        quorumPercentage: 67,
      });
      notify(
        {
          type: "local",
          name: "Aggregate Signatures",
        },
        signaturePromise
      );
      const signature = await signaturePromise;
      const signedMessage = signature.signedMessage;
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signedMessage}`);
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

      const writePromise = coreWalletClient.writeContract({
        address: targetContractAddress as `0x${string}`,
        abi: targetAbi,
        functionName: "completeValidatorRemoval",
        args: [0],
        accessList,
        account: coreWalletClient.account,
        chain: viemChain,
      });
      notify(
        {
          type: "call",
          name: "Complete Validator Removal",
        },
        writePromise,
        viemChain ?? undefined
      );
      const hash = await writePromise;
      setActionState((s) => ({
        ...s,
        [validationId]: {
          ...(s[validationId] || {}),
          isProcessing: false,
          signedMessage,
          evmTxHash: hash,
          error: null,
        },
      }));
    } catch (e: any) {
      setActionState((s) => ({
        ...s,
        [validationId]: {
          ...(s[validationId] || {}),
          isProcessing: false,
          error: e?.message || "Failed to force remove",
        },
      }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Left: Controls and Results */}
      <div className="space-y-4">
        {/* Info Card */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">About Expired Registrations</h3>
              <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                When a validator registration is initiated but not completed before the expiry time, it gets stuck in{" "}
                <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">PendingAdded</code> state. This
                tool finds those expired registrations and allows you to remove them.
              </p>
            </div>
          </div>
        </div>

        {error && <Alert variant="error">Error: {error}</Alert>}

        {/* Subnet Selection */}
        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">1. Select Subnet</h3>
          <SelectSubnetId
            value={subnetId}
            onChange={setSubnetId}
            error={validatorManagerError}
            hidePrimaryNetwork={true}
          />
          <div className="mt-3">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              {isDetailsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {isDetailsExpanded ? "Hide" : "Show"} Validator Manager Details
            </button>
            {isDetailsExpanded && (
              <div className="mt-3">
                <ValidatorManagerDetails
                  validatorManagerAddress={validatorManagerAddress}
                  blockchainId={blockchainId}
                  subnetId={subnetId}
                  isLoading={isLoadingVMCDetails}
                  signingSubnetId={signingSubnetId}
                  contractTotalWeight={contractTotalWeight}
                  l1WeightError={l1WeightError}
                  isLoadingL1Weight={isLoadingL1Weight}
                  contractOwner={contractOwner}
                  ownershipError={ownershipError}
                  isLoadingOwnership={isLoadingOwnership}
                  isOwnerContract={isOwnerContract}
                  ownerType={ownerType}
                  isDetectingOwnerType={isDetectingOwnerType}
                  isExpanded={true}
                  onToggleExpanded={() => {}}
                />
              </div>
            )}
          </div>
        </div>

        {/* Search Controls */}
        <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">2. Search for Events</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                From Block <span className="text-zinc-400">(defaults to last 100k blocks)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fromBlock}
                  onChange={(e) => setFromBlock(e.target.value)}
                  placeholder="Enter block number or leave blank"
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <button
                  onClick={() => setFromBlock("0")}
                  className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors"
                >
                  Search All
                </button>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={fetchEvents}
              disabled={isLoading || !validatorManagerAddress || !initiatedEventAbi}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {fetchProgress ? `Fetching… (${fetchProgress.current}/${fetchProgress.total})` : "Fetching…"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Search for Expired Registrations
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        {events.length > 0 && (
          <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">3. Expired Registrations</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {filteredEvents.length} of {events.length} events
                </span>
                {isLoadingStatuses && <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">No Expired Registrations</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      All validator registrations are either active or have been properly processed.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((ev, idx) => {
                  const state = actionState[ev.validationId];
                  const status = validatorStatusById[(ev.validationId || "").toLowerCase()];
                  const explorerUrl = getExplorerTxUrl(ev.txHash as unknown as string);

                  return (
                    <div
                      key={`${ev.txHash}-${idx}`}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadgeClass(status)}`}>
                              {statusLabel(status)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              Expired
                            </span>
                          </div>
                          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all">
                            {ev.validationId}
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          onClick={() => handleForceRemove(ev.validationId)}
                          disabled={!!state?.isProcessing || !subnetId}
                          className="shrink-0"
                        >
                          {state?.isProcessing ? (
                            <span className="flex items-center gap-1.5">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Processing
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </span>
                          )}
                        </Button>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Expiry</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span className="text-zinc-700 dark:text-zinc-300">{formatExpiry(ev.registrationExpiry)}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-zinc-500 dark:text-zinc-400">Block</span>
                          <p className="font-mono text-zinc-700 dark:text-zinc-300 mt-0.5">
                            {ev.blockNumber.toString()}
                          </p>
                        </div>
                      </div>

                      {/* Tx Link */}
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Action Result */}
                      {state?.error && (
                        <div className="mt-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-2">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-300">{state.error}</p>
                          </div>
                        </div>
                      )}
                      {state?.evmTxHash && (
                        <div className="mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <p className="text-green-700 dark:text-green-300 font-medium">Removal Successful</p>
                              <a
                                href={getExplorerTxUrl(state.evmTxHash as unknown as string)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-600 dark:text-green-400 hover:underline break-all"
                              >
                                {state.evmTxHash}
                              </a>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && events.length === 0 && validatorManagerAddress && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <Search className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No Events Found</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Click "Search for Expired Registrations" to scan for InitiatedValidatorRegistration events. You can
                  adjust the block range or click "Search All" to search from genesis.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Code Viewer - Sticky */}
      <ContractFunctionViewer
        contractName="ValidatorManager"
        filename="ValidatorManager.sol"
        sourceUrl={`https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`}
        githubUrl={`https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`}
        highlightFunction={selectedFunction}
        description={`Viewing ${selectedFunction}() function`}
        showFunctionOnly={true}
        className="h-[700px]"
      />
    </div>
  );
}

export default withConsoleToolMetadata(RemoveExpiredValidatorRegistration, metadata);
