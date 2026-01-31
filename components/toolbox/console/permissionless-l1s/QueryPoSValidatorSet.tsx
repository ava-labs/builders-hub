"use client"

import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { useState, useEffect, useMemo } from "react"
import { Calendar, Clock, Users, Coins, Info, Copy, Check, Search, Timer, Percent, AlertCircle, Shield } from "lucide-react"
import { Container } from "@/components/toolbox/components/Container"
import { Button } from "@/components/toolbox/components/Button"
import { networkIDs } from "@avalabs/avalanchejs"
import { formatEther } from "viem"

import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components"
import { AvaCloudSDK } from "@avalabs/avacloud-sdk"
import SelectSubnetId from "@/components/toolbox/components/SelectSubnetId"
import { Tooltip } from "@/components/toolbox/components/Tooltip"
import { formatAvaxBalance } from "@/components/toolbox/coreViem/utils/format"
import { useL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore"
import { cb58ToHex } from "@/components/toolbox/console/utilities/format-converter/FormatConverter"
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json'
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json'
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json'
import { ValidatorManagerDetails } from '@/components/toolbox/components/ValidatorManagerDetails'
import { useL1SubnetState } from './shared'
import { createPublicClient, http } from 'viem'

// Validator response from the API
interface ValidatorResponse {
  validationId: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  remainingBalance: string;
  creationTimestamp: number;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
}

// PoS-specific validator info from contract
interface PoSValidatorInfo {
  owner: string;
  delegationFeeBips: number;
  minStakeDuration: bigint;
  uptimeSeconds: bigint;
}

// Validator info from ValidatorManager (matches IACP99Manager.Validator struct)
interface ValidatorInfo {
  status: number;
  nodeID: string;
  startingWeight: bigint;
  sentNonce: bigint;
  receivedNonce: bigint;
  weight: bigint;
  startTime: bigint;
  endTime: bigint;
}

// Combined validator data
interface EnrichedValidator extends ValidatorResponse {
  posInfo?: PoSValidatorInfo;
  validatorInfo?: ValidatorInfo;
  timeRemaining?: string;
  canBeRemoved?: boolean;
  stakeValue?: string;
  isGenesisValidator?: boolean;
}

// Delegation info
interface DelegationInfo {
  delegationID: string;
  validationID: string;
  status: number;
  owner: string;
  weight: bigint;
  startTime: bigint;
  startingNonce: bigint;
  endingNonce: bigint;
  nodeId?: string;
  timeRemaining?: string;
  canBeRemoved?: boolean;
  stakeValue?: string;
}

type TabType = 'validators' | 'delegations';

// Status enum mappings
const ValidatorStatusNames = ['Unknown', 'PendingAdded', 'Active', 'PendingRemoved', 'Completed', 'Invalidated'];
const DelegatorStatusNames = ['Unknown', 'PendingAdded', 'Active', 'PendingRemoved', 'Completed'];

export default function QueryPoSValidatorSet() {
  const { avalancheNetworkID, isTestnet, publicClient, walletEVMAddress } = useWalletStore()
  const l1ListStore = useL1ListStore()
  
  // Use shared L1 subnet state
  const l1State = useL1SubnetState()
  const { subnetIdL1: subnetId, setSubnetIdL1: setSubnetId, validatorManagerDetails } = l1State
  
  const [validators, setValidators] = useState<ValidatorResponse[]>([])
  const [enrichedValidators, setEnrichedValidators] = useState<EnrichedValidator[]>([])
  const [filteredValidators, setFilteredValidators] = useState<EnrichedValidator[]>([])
  const [delegations, setDelegations] = useState<DelegationInfo[]>([])
  const [filteredDelegations, setFilteredDelegations] = useState<DelegationInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPoSInfo, setIsLoadingPoSInfo] = useState(false)
  const [isLoadingDelegations, setIsLoadingDelegations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedValidator, setSelectedValidator] = useState<EnrichedValidator | null>(null)
  const [selectedDelegation, setSelectedDelegation] = useState<DelegationInfo | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [activeTab, setActiveTab] = useState<TabType>('validators')
  const [l1RpcUrl, setL1RpcUrl] = useState<string | null>(null)
  const [rpcUrlError, setRpcUrlError] = useState<string | null>(null)
  
  // Determine if this is a PoS L1 (StakingManager)
  const isPoSL1 = validatorManagerDetails.ownerType === 'StakingManager'
  const stakingManagerAddress = validatorManagerDetails.contractOwner

  // Determine token type based on stored addresses
  const tokenType = useMemo(() => {
    // This is a simplified check - in practice you'd want to check the contract type
    return 'native' as const
  }, [])

  const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi

  // Network names for display
  const networkNames: Record<number, GlobalParamNetwork> = {
    [networkIDs.MainnetID]: "mainnet",
    [networkIDs.FujiID]: "fuji",
  }

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Eligible for removal'
    
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  // Calculate time remaining for a validator
  const calculateValidatorTimeRemaining = (startTime: bigint, minStakeDuration: bigint): { remaining: string; canBeRemoved: boolean } => {
    const now = BigInt(Math.floor(Date.now() / 1000))
    const endTime = startTime + minStakeDuration
    const remaining = endTime - now
    
    if (remaining <= 0n) {
      return { remaining: 'Eligible for removal', canBeRemoved: true }
    }
    
    return { remaining: formatTimeRemaining(Number(remaining)), canBeRemoved: false }
  }

  // Fetch validators from API
  const fetchValidators = async () => {
    if (!subnetId) return

    setIsLoading(true)
    setError(null)
    setSelectedValidator(null)
    setEnrichedValidators([])
    setFilteredValidators([])
    
    try {
      if (!subnetId.trim()) {
        throw new Error("Subnet ID is required to query L1 validators")
      }

      const network = networkNames[Number(avalancheNetworkID)]
      if (!network) {
        throw new Error("Invalid network selected")
      }

      const sdk = new AvaCloudSDK({
        serverURL: isTestnet ? "https://api.avax-test.network" : "https://api.avax.network",
        network: networkNames[Number(avalancheNetworkID)],
      })

      const result = await sdk.data.primaryNetwork.listL1Validators({
        network: networkNames[Number(avalancheNetworkID)],
        subnetId,
      })

      // Get all pages of results
      const allValidators: ValidatorResponse[] = []
      for await (const page of result) {
        if ('result' in page && page.result && 'validators' in page.result) {
          allValidators.push(...(page.result.validators as unknown as ValidatorResponse[]))
        } else if ('validators' in page) {
          allValidators.push(...(page.validators as unknown as ValidatorResponse[]))
        }
      }

      setValidators(allValidators)
      
      // If this is a PoS L1, fetch additional info
      if (isPoSL1 && stakingManagerAddress && publicClient) {
        await enrichValidatorsWithPoSInfo(allValidators)
      } else {
        // Just use the base validators
        const enriched = allValidators.filter(v => v.weight > 0).map(v => ({ ...v }))
        setEnrichedValidators(enriched)
        setFilteredValidators(enriched)
      }
    } catch (err) {
      console.error("Error fetching validators:", err)
      setError("Failed to fetch validators")
    } finally {
      setIsLoading(false)
    }
  }

  // Enrich validators with PoS-specific info from the contract
  const enrichValidatorsWithPoSInfo = async (baseValidators: ValidatorResponse[]) => {
    if (!stakingManagerAddress) {
      return
    }

    setIsLoadingPoSInfo(true)
    
    try {
      // Get L1's RPC URL from the L1 list store using the blockchain ID
      let rpcUrl = l1RpcUrl
      if (!rpcUrl && validatorManagerDetails.blockchainId) {
        // Try to find the L1 in the store by blockchain ID
        const l1List = l1ListStore.getState().l1List
        const l1 = l1List.find((l: L1ListItem) => l.id === validatorManagerDetails.blockchainId)
        
        if (l1) {
          rpcUrl = l1.rpcUrl
          setL1RpcUrl(rpcUrl)
          setRpcUrlError(null)
        } else {
          setRpcUrlError(`L1 not found in your network list. Please add this L1 to your networks first (Blockchain ID: ${validatorManagerDetails.blockchainId})`)
          // Fall back to base validators without PoS info
          const enriched = baseValidators.filter(v => v.weight > 0).map(v => ({ ...v }))
          setEnrichedValidators(enriched)
          setFilteredValidators(enriched)
          setIsLoadingPoSInfo(false)
          return
        }
      }

      if (!rpcUrl) {
        setRpcUrlError('Could not determine RPC URL for this L1')
        const enriched = baseValidators.filter(v => v.weight > 0).map(v => ({ ...v }))
        setEnrichedValidators(enriched)
        setFilteredValidators(enriched)
        setIsLoadingPoSInfo(false)
        return
      }
      
      setRpcUrlError(null)

      // Create a public client for the L1 chain
      const l1PublicClient = createPublicClient({
        transport: http(rpcUrl),
      })

      // Get ValidatorManager address from StakingManager
      const settings = await l1PublicClient.readContract({
        address: stakingManagerAddress as `0x${string}`,
        abi: contractAbi,
        functionName: 'getStakingManagerSettings',
      }) as { manager: string }
      
      const validatorManagerAddress = settings.manager

      const enrichedList: EnrichedValidator[] = []
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

      for (const validator of baseValidators.filter(v => v.weight > 0)) {
        const enriched: EnrichedValidator = { ...validator }
        
        try {
          // Get validation ID in hex format
          const validationIdHex = '0x' + cb58ToHex(validator.validationId)
          
          // Get PoS-specific info
          const posInfo = await l1PublicClient.readContract({
            address: stakingManagerAddress as `0x${string}`,
            abi: contractAbi,
            functionName: 'getStakingValidator',
            args: [validationIdHex as `0x${string}`],
          }) as PoSValidatorInfo
          
          enriched.posInfo = posInfo
          
          // Check if this is a genesis/PoA validator (owner is zero address and no minStakeDuration)
          const isGenesisValidator = posInfo.owner === ZERO_ADDRESS && posInfo.minStakeDuration === 0n
          enriched.isGenesisValidator = isGenesisValidator
          
          // Get validator info from ValidatorManager
          const validatorInfo = await l1PublicClient.readContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: ValidatorManagerAbi.abi,
            functionName: 'getValidator',
            args: [validationIdHex as `0x${string}`],
          }) as ValidatorInfo
          
          enriched.validatorInfo = validatorInfo
          
          // Calculate time remaining if this is a PoS validator with required info
          if (!isGenesisValidator && validatorInfo.startTime > 0n && posInfo.minStakeDuration > 0n) {
            const { remaining, canBeRemoved } = calculateValidatorTimeRemaining(
              validatorInfo.startTime,
              posInfo.minStakeDuration
            )
            enriched.timeRemaining = remaining
            enriched.canBeRemoved = canBeRemoved
          } else if (isGenesisValidator) {
            // Genesis validators don't have a staking period
            enriched.timeRemaining = 'No staking period (Genesis)'
            enriched.canBeRemoved = true // Genesis validators can be removed via PoA/governance
          }
          
          // Convert weight to stake value
          try {
            const stakeValue = await l1PublicClient.readContract({
              address: stakingManagerAddress as `0x${string}`,
              abi: contractAbi,
              functionName: 'weightToValue',
              args: [BigInt(validator.weight)],
            }) as bigint
            enriched.stakeValue = formatEther(stakeValue)
          } catch {
            // Silently ignore if weightToValue fails
          }
        } catch (err) {
          console.error(`Error fetching PoS info for validator ${validator.nodeId}:`, err)
        }
        
        enrichedList.push(enriched)
      }
      
      setEnrichedValidators(enrichedList)
      setFilteredValidators(enrichedList)
    } catch (err) {
      console.error('Error enriching validators with PoS info:', err)
      // Fall back to base validators
      const enriched = baseValidators.filter(v => v.weight > 0).map(v => ({ ...v }))
      setEnrichedValidators(enriched)
      setFilteredValidators(enriched)
    } finally {
      setIsLoadingPoSInfo(false)
    }
  }

  // Fetch delegations for the connected wallet
  const fetchDelegations = async () => {
    if (!stakingManagerAddress || !walletEVMAddress || !l1RpcUrl) {
      setDelegations([])
      return
    }

    setIsLoadingDelegations(true)
    
    try {
      // Create a public client for the L1 chain
      const l1PublicClient = createPublicClient({
        transport: http(l1RpcUrl),
      })

      // Query InitiatedDelegatorRegistration events for this user
      const logs = await l1PublicClient.getLogs({
        address: stakingManagerAddress as `0x${string}`,
        event: {
          type: 'event',
          name: 'InitiatedDelegatorRegistration',
          inputs: [
            { name: 'delegationID', type: 'bytes32', indexed: true },
            { name: 'validationID', type: 'bytes32', indexed: true },
            { name: 'delegatorAddress', type: 'address', indexed: true },
            { name: 'nonce', type: 'uint64', indexed: false },
            { name: 'validatorWeight', type: 'uint64', indexed: false },
            { name: 'delegatorWeight', type: 'uint64', indexed: false },
            { name: 'setWeightMessageID', type: 'bytes32', indexed: false },
          ],
        },
        args: {
          delegatorAddress: walletEVMAddress as `0x${string}`,
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
      })

      const delegationList: DelegationInfo[] = []

      for (const log of logs) {
        const delegationID = log.topics[1] as string
        const validationID = log.topics[2] as string

        try {
          // Get delegation info from contract
          const info = await l1PublicClient.readContract({
            address: stakingManagerAddress as `0x${string}`,
            abi: contractAbi,
            functionName: 'getDelegatorInfo',
            args: [delegationID as `0x${string}`],
          }) as {
            status: number;
            owner: string;
            validationID: string;
            weight: bigint;
            startTime: bigint;
            startingNonce: bigint;
            endingNonce: bigint;
          }

          // Skip completed/removed delegations
          if (info.status === 4 || info.weight === 0n) continue

          const delegation: DelegationInfo = {
            delegationID,
            validationID,
            status: info.status,
            owner: info.owner,
            weight: info.weight,
            startTime: info.startTime,
            startingNonce: info.startingNonce,
            endingNonce: info.endingNonce,
          }

          // Find the validator to get nodeId and minStakeDuration
          const validator = enrichedValidators.find(v => {
            const validationIdHex = '0x' + cb58ToHex(v.validationId)
            return validationIdHex.toLowerCase() === validationID.toLowerCase()
          })

          if (validator) {
            delegation.nodeId = validator.nodeId
            
            // Calculate time remaining for delegation
            if (info.startTime > 0n && validator.posInfo?.minStakeDuration) {
              const { remaining, canBeRemoved } = calculateValidatorTimeRemaining(
                info.startTime,
                validator.posInfo.minStakeDuration
              )
              delegation.timeRemaining = remaining
              delegation.canBeRemoved = canBeRemoved
            }
          }

          // Convert weight to stake value
          try {
            const stakeValue = await l1PublicClient.readContract({
              address: stakingManagerAddress as `0x${string}`,
              abi: contractAbi,
              functionName: 'weightToValue',
              args: [info.weight],
            }) as bigint
            delegation.stakeValue = formatEther(stakeValue)
          } catch {
            // weightToValue might not be available
          }

          delegationList.push(delegation)
        } catch (err) {
          console.warn(`Could not fetch info for delegation ${delegationID}:`, err)
        }
      }

      setDelegations(delegationList)
      setFilteredDelegations(delegationList)
    } catch (err) {
      console.error('Error fetching delegations:', err)
      setDelegations([])
    } finally {
      setIsLoadingDelegations(false)
    }
  }

  // Fetch delegations when tab changes to delegations and we have validators
  useEffect(() => {
    if (activeTab === 'delegations' && enrichedValidators.length > 0 && isPoSL1) {
      fetchDelegations()
    }
  }, [activeTab, enrichedValidators, isPoSL1])

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString()
  }

  function formatWeight(weight: number | bigint): string {
    return Number(weight).toLocaleString()
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedId(text)
        setTimeout(() => setCopiedId(null), 2000)
      })
      .catch(err => {
        console.error('Failed to copy text: ', err)
      })
  }

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)

    if (activeTab === 'validators') {
      if (!term.trim()) {
        setFilteredValidators(enrichedValidators)
        return
      }
      const filtered = enrichedValidators.filter(validator =>
        validator.nodeId.toLowerCase().includes(term) ||
        validator.validationId.toLowerCase().includes(term) ||
        validator.posInfo?.owner?.toLowerCase().includes(term)
      )
      setFilteredValidators(filtered)
    } else {
      if (!term.trim()) {
        setFilteredDelegations(delegations)
        return
      }
      const filtered = delegations.filter(delegation =>
        delegation.delegationID.toLowerCase().includes(term) ||
        delegation.validationID.toLowerCase().includes(term) ||
        delegation.nodeId?.toLowerCase().includes(term)
      )
      setFilteredDelegations(filtered)
    }
  }

  // Update filtered lists when source data changes
  useEffect(() => {
    setFilteredValidators(enrichedValidators)
  }, [enrichedValidators])

  useEffect(() => {
    setFilteredDelegations(delegations)
  }, [delegations])

  return (
    <Container 
      title="PoS Staking Info" 
      description="Query validators and delegations for Proof-of-Stake L1s. View staking periods, time remaining, and delegation details." 
      githubUrl="https://github.com/ava-labs/builders-hub/edit/master/components/toolbox/console/permissionless-l1s/QueryPoSValidatorSet.tsx"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-4 border border-zinc-200 dark:border-zinc-800 relative overflow-visible">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent dark:from-blue-900/10 dark:to-transparent pointer-events-none rounded-lg"></div>

        <div className="relative">
          <div className="mb-3">
            <SelectSubnetId value={subnetId} onChange={setSubnetId} hidePrimaryNetwork={true} />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Enter the Subnet ID of a PoS (Proof-of-Stake) L1 to query staking info
            </p>
          </div>

          {/* Show validator manager details using shared component */}
          <ValidatorManagerDetails
            validatorManagerAddress={validatorManagerDetails.validatorManagerAddress}
            blockchainId={validatorManagerDetails.blockchainId}
            subnetId={subnetId}
            isLoading={validatorManagerDetails.isLoading}
            signingSubnetId={validatorManagerDetails.signingSubnetId}
            contractTotalWeight={validatorManagerDetails.contractTotalWeight}
            l1WeightError={validatorManagerDetails.l1WeightError}
            isLoadingL1Weight={validatorManagerDetails.isLoadingL1Weight}
            contractOwner={validatorManagerDetails.contractOwner}
            ownershipError={validatorManagerDetails.ownershipError}
            isLoadingOwnership={validatorManagerDetails.isLoadingOwnership}
            isOwnerContract={validatorManagerDetails.isOwnerContract}
            ownerType={validatorManagerDetails.ownerType}
            isDetectingOwnerType={validatorManagerDetails.isDetectingOwnerType}
            isExpanded={l1State.isValidatorManagerDetailsExpanded}
            onToggleExpanded={l1State.toggleValidatorManagerDetails}
          />

          {/* Show if this is a PoS L1 */}
          {subnetId && validatorManagerDetails.ownerType && (
            <div className={`mt-3 p-3 rounded-lg border ${
              isPoSL1 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              {isPoSL1 ? (
                <div className="flex items-center text-sm text-green-700 dark:text-green-300">
                  <Check className="h-4 w-4 mr-2" />
                  This is a PoS L1 - staking details will be fetched from the StakingManager contract.
                </div>
              ) : (
                <div className="flex items-center text-sm text-yellow-700 dark:text-yellow-300">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  This L1 uses {validatorManagerDetails.ownerType} (not PoS). Some features may be limited.
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => fetchValidators()}
            disabled={isLoading || !subnetId.trim() || !!validatorManagerDetails.error || validatorManagerDetails.isLoading}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center mt-4 ${
              isLoading || !subnetId.trim() || !!validatorManagerDetails.error || validatorManagerDetails.isLoading
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm hover:shadow transition-all duration-200"
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Fetching...
              </>
            ) : validatorManagerDetails.isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading Details...
              </>
            ) : (
              "Fetch Staking Info"
            )}
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 mt-4 animate-fadeIn">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-400 mr-2" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* RPC URL error with manual input option */}
      {rpcUrlError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mt-4">
          <div className="flex items-start mb-3">
            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{rpcUrlError}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                Enter the L1&apos;s RPC URL below to fetch staking details:
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={l1RpcUrl || ''}
              onChange={(e) => setL1RpcUrl(e.target.value)}
              placeholder="https://your-l1-rpc-url.com/ext/bc/.../rpc"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-yellow-300 dark:border-yellow-700 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <Button
              onClick={() => {
                if (l1RpcUrl) {
                  setRpcUrlError(null)
                  fetchValidators()
                }
              }}
              disabled={!l1RpcUrl}
              className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-md disabled:opacity-50"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Tabs and Results */}
      {enrichedValidators.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 mt-4 shadow-sm">
          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-4">
            <button
              onClick={() => setActiveTab('validators')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'validators'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Validators
                <span className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {enrichedValidators.length}
                </span>
              </div>
            </button>
            {isPoSL1 && walletEVMAddress && (
              <button
                onClick={() => setActiveTab('delegations')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'delegations'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <div className="flex items-center">
                  <Coins className="h-4 w-4 mr-2" />
                  My Delegations
                  {delegations.length > 0 && (
                    <span className="ml-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-0.5 rounded-full">
                      {delegations.length}
                    </span>
                  )}
                </div>
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <h3 className="text-base font-semibold text-zinc-800 dark:text-white">
              {activeTab === 'validators' ? 'Validator List' : 'Your Delegations'}
            </h3>

            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                placeholder={activeTab === 'validators' ? "Search validators..." : "Search delegations..."}
                className="pl-9 w-full py-1.5 px-3 rounded-md text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-zinc-800 dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Loading PoS info indicator */}
          {isLoadingPoSInfo && (
            <div className="flex items-center justify-center py-4 mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Loading PoS staking details...</p>
            </div>
          )}

          {/* Validators Tab Content */}
          {activeTab === 'validators' && (
            <>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading validators...</p>
                </div>
              ) : filteredValidators.length > 0 ? (
                <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Node ID
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            {isPoSL1 ? 'Stake' : 'Weight'}
                          </th>
                          {isPoSL1 && (
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                              Delegation Fee
                            </th>
                          )}
                          {isPoSL1 && (
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                              <div className="flex items-center">
                                <Timer className="h-3 w-3 mr-1" />
                                Time Remaining
                              </div>
                            </th>
                          )}
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                        {filteredValidators.map((validator, index) => (
                          <tr
                            key={index}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors duration-150"
                          >
                            <td className="px-3 py-3 text-sm font-mono truncate max-w-[180px] text-zinc-800 dark:text-zinc-200">
                              <div className="flex items-center">
                                <span title={validator.nodeId} className="truncate">{validator.nodeId.substring(0, 14)}...</span>
                                <button
                                  onClick={() => copyToClipboard(validator.nodeId)}
                                  className="ml-1.5 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  <Tooltip content={copiedId === validator.nodeId ? "Copied!" : "Copy Node ID"}>
                                    {copiedId === validator.nodeId ? (
                                      <Check size={12} className="text-green-500" />
                                    ) : (
                                      <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                                    )}
                                  </Tooltip>
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {validator.stakeValue ? `${parseFloat(validator.stakeValue).toFixed(2)} tokens` : formatWeight(validator.weight)}
                              </span>
                            </td>
                            {isPoSL1 && (
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                                <div className="flex items-center">
                                  <Percent className="h-3 w-3 mr-1 text-zinc-400" />
                                  <span>{validator.posInfo ? (validator.posInfo.delegationFeeBips / 100).toFixed(2) : '-'}%</span>
                                </div>
                              </td>
                            )}
                            {isPoSL1 && (
                              <td className="px-3 py-3 whitespace-nowrap text-sm">
                                {validator.isGenesisValidator ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Genesis Validator
                                  </span>
                                ) : validator.timeRemaining ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    validator.canBeRemoved
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                  }`}>
                                    <Timer className="h-3 w-3 mr-1" />
                                    {validator.timeRemaining}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-3 py-3 whitespace-nowrap text-sm">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                validator.validatorInfo?.status === 2
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {validator.validatorInfo ? ValidatorStatusNames[validator.validatorInfo.status] : 'Active'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Button
                                variant="secondary"
                                onClick={() => setSelectedValidator(validator)}
                                className="text-xs py-1 px-2 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : searchTerm ? (
                <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <Search className="h-6 w-6 text-zinc-400 mb-2" />
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No matching validators</p>
                  <p className="text-zinc-500 dark:text-zinc-500 text-xs">Try a different search term</p>
                </div>
              ) : (
                <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <Users className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No validators found</p>
                  <p className="text-zinc-500 dark:text-zinc-500 text-xs">This L1 may not have any active validators</p>
                </div>
              )}
            </>
          )}

          {/* Delegations Tab Content */}
          {activeTab === 'delegations' && (
            <>
              {isLoadingDelegations ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading your delegations...</p>
                </div>
              ) : !walletEVMAddress ? (
                <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">Wallet not connected</p>
                  <p className="text-zinc-500 dark:text-zinc-500 text-xs">Connect your wallet to view your delegations</p>
                </div>
              ) : filteredDelegations.length > 0 ? (
                <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Delegation ID
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Validator
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            <div className="flex items-center">
                              <Timer className="h-3 w-3 mr-1" />
                              Time Remaining
                            </div>
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-700">
                        {filteredDelegations.map((delegation, index) => (
                          <tr
                            key={index}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors duration-150"
                          >
                            <td className="px-3 py-3 text-sm font-mono truncate max-w-[120px] text-zinc-800 dark:text-zinc-200">
                              <div className="flex items-center">
                                <span title={delegation.delegationID} className="truncate">{delegation.delegationID.substring(0, 10)}...</span>
                                <button
                                  onClick={() => copyToClipboard(delegation.delegationID)}
                                  className="ml-1.5 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  {copiedId === delegation.delegationID ? (
                                    <Check size={12} className="text-green-500" />
                                  ) : (
                                    <Copy size={12} className="text-zinc-500 dark:text-zinc-400" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm font-mono truncate max-w-[140px] text-zinc-800 dark:text-zinc-200">
                              <span title={delegation.nodeId || delegation.validationID}>
                                {delegation.nodeId ? delegation.nodeId.substring(0, 12) + '...' : delegation.validationID.substring(0, 10) + '...'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-zinc-800 dark:text-zinc-200">
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {delegation.stakeValue ? `${parseFloat(delegation.stakeValue).toFixed(4)} tokens` : formatWeight(delegation.weight)}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm">
                              {delegation.timeRemaining ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  delegation.canBeRemoved
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                }`}>
                                  <Timer className="h-3 w-3 mr-1" />
                                  {delegation.timeRemaining}
                                </span>
                              ) : (
                                <span className="text-zinc-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                delegation.status === 2
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                              }`}>
                                {DelegatorStatusNames[delegation.status] || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Button
                                variant="secondary"
                                onClick={() => setSelectedDelegation(delegation)}
                                className="text-xs py-1 px-2 bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <Coins className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium mb-1">No delegations found</p>
                  <p className="text-zinc-500 dark:text-zinc-500 text-xs">You don&apos;t have any active delegations on this L1</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Validator Details Modal */}
      {selectedValidator && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 mt-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white">Validator Details</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Detailed staking information</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelectedValidator(null)}
              className="text-xs py-1 px-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 transition-colors"
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                <Users className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                Node Information
              </h4>
              <div className="space-y-3">
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Node ID</p>
                  <div className="flex items-center">
                    <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200">{selectedValidator.nodeId}</p>
                    <button onClick={() => copyToClipboard(selectedValidator.nodeId)} className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      {copiedId === selectedValidator.nodeId ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-zinc-500" />}
                    </button>
                  </div>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validation ID</p>
                  <div className="flex items-center">
                    <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200">{selectedValidator.validationId}</p>
                    <button onClick={() => copyToClipboard(selectedValidator.validationId)} className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      {copiedId === selectedValidator.validationId ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-zinc-500" />}
                    </button>
                  </div>
                </div>
                {selectedValidator.posInfo?.owner && (
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Owner Address</p>
                    <div className="flex items-center">
                      <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200">{selectedValidator.posInfo.owner}</p>
                      <button onClick={() => copyToClipboard(selectedValidator.posInfo!.owner)} className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        {copiedId === selectedValidator.posInfo.owner ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-zinc-500" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Staking Information */}
            <div className="space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Coins className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Staking Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Stake</p>
                    <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {selectedValidator.stakeValue ? `${parseFloat(selectedValidator.stakeValue).toFixed(4)}` : formatWeight(selectedValidator.weight)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">P-Chain Balance</p>
                    <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatAvaxBalance(parseFloat(selectedValidator.remainingBalance))}
                    </p>
                  </div>
                  {selectedValidator.posInfo && (
                    <>
                      <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Delegation Fee</p>
                        <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {(selectedValidator.posInfo.delegationFeeBips / 100).toFixed(2)}%
                        </p>
                      </div>
                      <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Min Stake Duration</p>
                        <p className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {Math.floor(Number(selectedValidator.posInfo.minStakeDuration) / 86400)}d
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Time Information */}
              <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300 flex items-center">
                  <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400 mr-2" />
                  Time Information
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Started At</p>
                    <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                      {selectedValidator.validatorInfo?.startTime 
                        ? formatTimestamp(Number(selectedValidator.validatorInfo.startTime))
                        : formatTimestamp(selectedValidator.creationTimestamp)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Time Remaining</p>
                    {selectedValidator.isGenesisValidator ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        <Shield className="h-3 w-3 mr-1" />
                        Genesis Validator
                      </span>
                    ) : (
                      <p className={`font-medium text-sm ${selectedValidator.canBeRemoved ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                        {selectedValidator.timeRemaining || 'Unknown'}
                      </p>
                    )}
                  </div>
                </div>
                {selectedValidator.posInfo?.uptimeSeconds !== undefined && (
                  <div className="mt-3 p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Uptime</p>
                    <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                      {Math.floor(Number(selectedValidator.posInfo.uptimeSeconds) / 3600)}h {Math.floor((Number(selectedValidator.posInfo.uptimeSeconds) % 3600) / 60)}m
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delegation Details Modal */}
      {selectedDelegation && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800 mt-4 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h3 className="text-base font-semibold text-zinc-800 dark:text-white">Delegation Details</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Your delegation information</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setSelectedDelegation(null)}
              className="text-xs py-1 px-2 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 transition-colors"
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300">Delegation Info</h4>
              <div className="space-y-3">
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Delegation ID</p>
                  <div className="flex items-center">
                    <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200">{selectedDelegation.delegationID}</p>
                    <button onClick={() => copyToClipboard(selectedDelegation.delegationID)} className="ml-1 p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      {copiedId === selectedDelegation.delegationID ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-zinc-500" />}
                    </button>
                  </div>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Validator</p>
                  <p className="font-mono text-xs break-all text-zinc-800 dark:text-zinc-200">
                    {selectedDelegation.nodeId || selectedDelegation.validationID}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/70 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-sm font-semibold mb-3 text-zinc-700 dark:text-zinc-300">Staking Info</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Amount</p>
                  <p className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {selectedDelegation.stakeValue ? parseFloat(selectedDelegation.stakeValue).toFixed(4) : formatWeight(selectedDelegation.weight)}
                  </p>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Status</p>
                  <p className={`font-medium text-sm ${selectedDelegation.status === 2 ? 'text-green-600' : 'text-zinc-600'}`}>
                    {DelegatorStatusNames[selectedDelegation.status]}
                  </p>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Started At</p>
                  <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">
                    {formatTimestamp(Number(selectedDelegation.startTime))}
                  </p>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900/80 rounded-md border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Time Remaining</p>
                  <p className={`font-medium text-sm ${selectedDelegation.canBeRemoved ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedDelegation.timeRemaining || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 italic p-2 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-md shadow-sm mt-4">
        <Info className="h-3 w-3 mr-1" />
        <span>Validator data from AvaCloud API. Staking details from on-chain contracts.</span>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}} />
    </Container>
  )
}
