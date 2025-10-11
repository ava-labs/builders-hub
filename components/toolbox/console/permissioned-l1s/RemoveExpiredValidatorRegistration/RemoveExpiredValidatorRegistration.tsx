"use client"
import React, { useEffect, useMemo, useState } from 'react'
import type { Abi, AbiEvent, Address, Log } from 'viem'
import { bytesToHex, hexToBytes } from 'viem'
import { AlertCircle } from "lucide-react"
import { Container } from "@/components/toolbox/components/Container"
import { Button } from "@/components/toolbox/components/Button"
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId"
import { ValidatorManagerDetails } from "@/components/toolbox/components/ValidatorManagerDetails"
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails"
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json"
import PoAManagerABI from "@/contracts/icm-contracts/compiled/PoAManager.json"
import { useAvaCloudSDK } from "@/components/toolbox/stores/useAvaCloudSDK"
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter"
import { GetRegistrationJustification } from "@/components/toolbox/console/permissioned-l1s/ValidatorManager/justification"
import { packL1ValidatorRegistration } from "@/components/toolbox/coreViem/utils/convertWarp"
import { packWarpIntoAccessList } from "@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp"
import { useViemChainStore } from "@/components/toolbox/stores/toolboxStore"
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type ParsedInitiatedRegistration = {
  validationId: string
  registrationExpiry: bigint
  nodeId?: string
  blockNumber: bigint
  txHash: Address
}

const RemoveExpiredValidatorRegistration: React.FC = () => {
  const [subnetId, setSubnetId] = useState<string>(useCreateChainStore()((s) => s.subnetId) || "")
  const { publicClient, coreWalletClient, avalancheNetworkID } = useWalletStore()
  const viemChain = useViemChainStore()
  const { notify } = useConsoleNotifications();
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fromBlock, setFromBlock] = useState<string>("")
  const [events, setEvents] = useState<ParsedInitiatedRegistration[]>([])
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false)
  const [isLoadingValidators, setIsLoadingValidators] = useState<boolean>(false)
  const [validatorIdHexSet, setValidatorIdHexSet] = useState<Set<string>>(new Set())
  const [validatorStatusById, setValidatorStatusById] = useState<Record<string, number>>({})
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null)
  const [actionState, setActionState] = useState<Record<string, {
    isProcessing: boolean
    error?: string | null
    signedMessage?: string | null
    evmTxHash?: string | null
  }>>({})

  const { listL1Validators } = useAvaCloudSDK()
  const { aggregateSignature } = useAvaCloudSDK()

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
  } = useValidatorManagerDetails({ subnetId })

  const initiatedEventAbi = useMemo(() => {
    const abi = (ValidatorManagerABI.abi as unknown) as Abi
    return abi.find((i) => i.type === 'event' && i.name === 'InitiatedValidatorRegistration') as AbiEvent | undefined
  }, [])

  useEffect(() => {
    let cancelled = false
    const bootstrapFromBlock = async () => {
      try {
        const latest = await publicClient.getBlockNumber()
        // Default to last ~100,000 blocks to search a much wider range
        // The fetching will handle chunking in 2000 block increments to stay under RPC limits
        const suggested = latest > 100000n ? (latest - 100000n).toString() : '0'
        if (!cancelled) setFromBlock((prev) => (prev ? prev : suggested))
      } catch (e) {
        // ignore
      }
    }
    bootstrapFromBlock()
    return () => { cancelled = true }
  }, [publicClient])

  // Fetch current validators for the subnet and build a set of validationIDs in hex (0x...)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!subnetId) {
        setValidatorIdHexSet(new Set())
        return
      }
      setIsLoadingValidators(true)
      try {
        const result = await listL1Validators({ subnetId, pageSize: 200, includeInactiveL1Validators: false })
        const ids = new Set<string>()
        for await (const page of result) {
          let validatorsArr: any[] = []
          if ('result' in page && page.result && 'validators' in page.result) {
            validatorsArr = (page.result as any).validators as any[]
          }
          for (const v of validatorsArr) {
            if (!v?.validationId) continue
            try {
              const hex = ("0x" + cb58ToHex(v.validationId)).toLowerCase()
              ids.add(hex)
            } catch {
              // ignore
            }
          }
        }
        if (!cancelled) setValidatorIdHexSet(ids)
      } catch (e) {
        if (!cancelled) setValidatorIdHexSet(new Set())
      } finally {
        if (!cancelled) setIsLoadingValidators(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [subnetId, listL1Validators])

  const fetchEvents = async () => {
    if (!validatorManagerAddress) {
      setError("Validator Manager address not found for selected subnet")
      return
    }
    if (!initiatedEventAbi) {
      setError("InitiatedValidatorRegistration ABI not found")
      return
    }
    setIsLoading(true)
    setError(null)
    setEvents([])
    setFetchProgress(null)
    try {
      const startBlock = (fromBlock && fromBlock.trim().length > 0) ? BigInt(fromBlock) : 0n
      const latest = await publicClient.getBlockNumber()
      if (startBlock > latest) {
        setEvents([])
        return
      }
      const CHUNK_SIZE = 2000n
      const totalBlocks = latest - startBlock
      const totalChunks = Math.ceil(Number(totalBlocks) / Number(CHUNK_SIZE))
      let currentChunk = 0
      let cursor = startBlock
      const allLogs: any[] = []
      
      console.log(`Searching ${totalBlocks} blocks (${totalChunks} chunks) from block ${startBlock} to ${latest}`)
      
      while (cursor <= latest) {
        const to = cursor + CHUNK_SIZE > latest ? latest : cursor + CHUNK_SIZE
        currentChunk++
        setFetchProgress({ current: currentChunk, total: totalChunks })
        
        const chunkLogs = await publicClient.getLogs({
          address: validatorManagerAddress as Address,
          event: initiatedEventAbi,
          fromBlock: cursor,
          toBlock: to,
        })
        allLogs.push(...chunkLogs)
        cursor = to + 1n
      }

      console.log(`Found ${allLogs.length} InitiatedValidatorRegistration events`)

      const parsed: ParsedInitiatedRegistration[] = allLogs.map((log: any) => {
        const args = (log as Log & { args?: any }).args || {}
        return {
          validationId: args.validationID as string,
          registrationExpiry: args.registrationExpiry as bigint,
          nodeId: args.nodeID as string | undefined,
          blockNumber: log.blockNumber as bigint,
          txHash: log.transactionHash as Address,
        }
      })
      setEvents(parsed)
    } catch (e) {
      console.error('Error fetching logs', e)
      setError((e as Error).message || 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
      setFetchProgress(null)
    }
  }

  // Fetch on-chain validator status for each validationID so we only show PendingAdded or Invalidated
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        if (!validatorManagerAddress || events.length === 0) {
          if (!cancelled) setValidatorStatusById({})
          return
        }
        const uniqueIds = Array.from(new Set(events.map((e) => (e.validationId || '').toLowerCase()).filter(Boolean)))
        const entries = await Promise.all(uniqueIds.map(async (id) => {
          try {
            const res: any = await publicClient.readContract({
              address: validatorManagerAddress as `0x${string}`,
              abi: ValidatorManagerABI.abi as Abi,
              functionName: 'getValidator',
              args: [id as `0x${string}`],
            })
            // res could be tuple array or object with .status
            const statusNum = Array.isArray(res) ? Number(res[0]) : Number(res?.status ?? 0)
            return [id, Number.isFinite(statusNum) ? statusNum : 0] as const
          } catch {
            return [id, 0] as const
          }
        }))
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const [id, status] of entries) map[id] = status
        setValidatorStatusById(map)
      } catch {
        if (!cancelled) setValidatorStatusById({})
      }
    }
    run()
    return () => { cancelled = true }
  }, [validatorManagerAddress, events, publicClient])

  const formatExpiry = (expiry: bigint) => {
    try {
      const seconds = Number(expiry)
      if (!Number.isFinite(seconds)) return expiry.toString()
      return new Date(seconds * 1000).toLocaleString()
    } catch {
      return expiry.toString()
    }
  }

  const statusLabel = (status?: number) => {
    switch (status) {
      case 1:
        return "PendingAdded"
      case 2:
        return "Active"
      case 3:
        return "PendingRemoved"
      case 4:
        return "Completed"
      case 5:
        return "Invalidated"
      default:
        return "Unknown"
    }
  }

  const statusBadgeClass = (status?: number) => {
    switch (status) {
      case 1:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
      case 2:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
      case 3:
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
      case 4:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
      case 5:
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800"
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
    }
  }

  const getExplorerTxUrl = (hash?: string) => {
    try {
      const base = (viemChain as any)?.blockExplorers?.default?.url as string | undefined
      if (!base || !hash) return undefined
      return `${base.replace(/\/$/, '')}/tx/${hash}`
    } catch {
      return undefined
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const isLoadingStatuses = useMemo(() => {
    if (events.length === 0) return false
    const ids = new Set(events.map((e) => (e.validationId || '').toLowerCase()).filter(Boolean))
    for (const id of ids) {
      if (validatorStatusById[id] === undefined) return true
    }
    return false
  }, [events, validatorStatusById])
  const filteredEvents = useMemo(() => {
    // Show only expired PendingAdded (1) and not present in current validator set
    return events.filter((e) => {
      const status = validatorStatusById[(e.validationId || '').toLowerCase()]
      if (status !== 1) return false
      const isExpired = Number(e.registrationExpiry) < nowSeconds
      if (!isExpired) return false
      const present = validatorIdHexSet.has((e.validationId || '').toLowerCase())
      return !present
    })
  }, [events, validatorIdHexSet, nowSeconds, validatorStatusById])

  const handleForceRemove = async (validationId: string) => {
    setActionState((s) => ({
      ...s,
      [validationId]: {
        ...(s[validationId] || {}),
        isProcessing: true,
        error: null,
      }
    }))
    try {
      if (!validatorManagerAddress) throw new Error('Validator Manager address not found')
      if (!coreWalletClient || !viemChain || !coreWalletClient.account) throw new Error('Wallet/chain not initialized')
      if (!subnetId) throw new Error('Subnet ID required')

      const useMultisig = ownerType === 'PoAManager'
      const targetContractAddress = useMultisig ? contractOwner : validatorManagerAddress
      const targetAbi = useMultisig ? (PoAManagerABI.abi as Abi) : (ValidatorManagerABI.abi as Abi)

      // Build justification and sign removal message (validationID, false)
      const justification = await GetRegistrationJustification(validationId, subnetId, publicClient)
      if (!justification) throw new Error('Could not build justification for this validation ID')

      console.log("justification", justification)
      const validationIDBytes = hexToBytes(validationId as `0x${string}`)
      const removeValidatorMessage = packL1ValidatorRegistration(
        validationIDBytes,
        false,
        avalancheNetworkID,
        "11111111111111111111111111111111LpoYY"
      )
      const signaturePromise = aggregateSignature({
        message: bytesToHex(removeValidatorMessage),
        justification: bytesToHex(justification),
        signingSubnetId: signingSubnetId || subnetId,
        quorumPercentage: 67,
      })
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, signaturePromise);
      const signature = await signaturePromise;
      const signedMessage = signature.signedMessage
      console.log("signedMessage", signedMessage)
      const signedPChainWarpMsgBytes = hexToBytes(`0x${signedMessage}`)
      const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes)

      const writePromise = coreWalletClient.writeContract({
        address: targetContractAddress as `0x${string}`,
        abi: targetAbi,
        functionName: 'completeValidatorRemoval',
        args: [0],
        accessList,
        account: coreWalletClient.account,
        chain: viemChain,
      })
      notify({
        type: 'call',
        name: 'Complete Validator Removal'
      }, writePromise, viemChain ?? undefined);
      const hash = await writePromise;
      setActionState((s) => ({
        ...s,
        [validationId]: {
          ...(s[validationId] || {}),
          isProcessing: false,
          signedMessage,
          evmTxHash: hash,
          error: null,
        }
      }))
    } catch (e: any) {
      setActionState((s) => ({
        ...s,
        [validationId]: {
          ...(s[validationId] || {}),
          isProcessing: false,
          error: e?.message || 'Failed to force remove',
        }
      }))
    }
  }

  return (
    <Container
      title="Remove Expired Validator Registration"
      description="Fetch InitiatedValidatorRegistration logs and show only expired PendingAdded registrations."
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/permissioned-l1s/RemoveExpiredValidatorRegistration/RemoveExpiredValidatorRegistration.tsx"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
              <span>Error: {error}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <SelectSubnetId
            value={subnetId}
            onChange={setSubnetId}
            error={validatorManagerError}
            hidePrimaryNetwork={true}
          />
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
            isExpanded={isDetailsExpanded}
            onToggleExpanded={() => setIsDetailsExpanded(!isDetailsExpanded)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                From Block (optional - defaults to last 100,000 blocks)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fromBlock}
                  onChange={(e) => setFromBlock(e.target.value)}
                  placeholder="Enter block number or leave blank"
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <button
                  onClick={() => setFromBlock("0")}
                  className="px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Search All
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              {fromBlock && (
                <span>
                  Will search from block <span className="font-mono font-medium">{fromBlock}</span> to latest
                </span>
              )}
            </div>
            <Button onClick={fetchEvents} disabled={isLoading || !validatorManagerAddress || !initiatedEventAbi} className="h-10 px-4">
              {isLoading 
                ? fetchProgress 
                  ? `Fetching… (${fetchProgress.current}/${fetchProgress.total} chunks)`
                  : 'Fetching…' 
                : 'Fetch InitiatedValidatorRegistration'}
            </Button>
          </div>
        </div>

        {(events.length > 0) && (
          <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
            <div>
              Showing <span className="font-medium text-zinc-800 dark:text-zinc-100">{filteredEvents.length}</span> of <span className="font-medium text-zinc-800 dark:text-zinc-100">{events.length}</span> events (expired).
              {isLoadingStatuses && <span className="ml-2">Resolving on-chain statuses…</span>}
            </div>
          </div>
        )}

        {filteredEvents.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white">InitiatedValidatorRegistration Events</h3>
              <span className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">{filteredEvents.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Validation ID</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Registration Expiry</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Block</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tx Hash</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {filteredEvents.map((ev, idx) => (
                    <tr key={`${ev.txHash}-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors duration-150">
                      <td className="px-3 py-3 text-xs font-mono break-all text-zinc-800 dark:text-zinc-200">{ev.validationId}</td>
                      <td className="px-3 py-3 text-xs text-zinc-800 dark:text-zinc-200">
                        <div className="flex flex-col">
                          <span className="font-mono">{ev.registrationExpiry.toString()}</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatExpiry(ev.registrationExpiry)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-800 dark:text-zinc-200">{ev.blockNumber.toString()}</td>
                      <td className="px-3 py-3 text-xs text-zinc-800 dark:text-zinc-200">
                        {(() => {
                          const url = getExplorerTxUrl(ev.txHash as unknown as string)
                          return url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="font-mono break-all text-blue-700 dark:text-blue-400 hover:underline">{ev.txHash}</a>
                          ) : (
                            <span className="font-mono break-all">{ev.txHash}</span>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-zinc-800 dark:text-zinc-200">
                        {(() => {
                          const s = validatorStatusById[(ev.validationId || '').toLowerCase()]
                          if (s === undefined) {
                            return <span className="text-zinc-500 dark:text-zinc-400">Loading…</span>
                          }
                          return (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 border ${statusBadgeClass(s)}`}>
                              {statusLabel(s)}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-800 dark:text-zinc-200">
                        <div className="flex items-center justify-end">
                          <Button
                            onClick={() => handleForceRemove(ev.validationId)}
                            disabled={!!actionState[ev.validationId]?.isProcessing || !subnetId}
                            className="h-7 px-3 text-xs"
                          >
                            {actionState[ev.validationId]?.isProcessing ? 'Processing…' : 'Force Remove'}
                          </Button>
                        </div>
                        {actionState[ev.validationId]?.error && (
                          <div className="mt-1 text-[10px] text-red-600 dark:text-red-400">{actionState[ev.validationId]?.error}</div>
                        )}
                        {actionState[ev.validationId]?.evmTxHash && (
                          <div className="mt-1 text-[10px] break-all text-zinc-600 dark:text-zinc-300">
                            {(() => {
                              const txh = actionState[ev.validationId]?.evmTxHash as unknown as string | undefined
                              const url = getExplorerTxUrl(txh)
                              return url ? (
                                <>
                                  EVM Tx: <a href={url} target="_blank" rel="noreferrer" className="font-mono text-blue-700 dark:text-blue-400 hover:underline">{txh}</a>
                                </>
                              ) : (
                                <>EVM Tx: <span className="font-mono">{txh}</span></>
                              )
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && !error && events.length === 0 && validatorManagerAddress && (
          <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
            <p className="font-medium">No InitiatedValidatorRegistration events found</p>
            <p className="text-xs mt-1">
              Try searching a larger block range by entering an earlier "From Block" number above, or leave it empty to search the last 100,000 blocks. 
              You can also enter "0" to search from the beginning of the chain.
            </p>
          </div>
        )}
      </div>
    </Container>
  )
}

export default RemoveExpiredValidatorRegistration
