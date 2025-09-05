"use client";

import { useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Container } from '../../components/Container'
import { CheckWalletRequirements } from '../../components/CheckWalletRequirements'
import { WalletRequirementsConfigKey } from '../../hooks/useWalletRequirements'
import { useWalletStore } from '../../stores/walletStore'
import { Success } from '../../components/Success'
import { createAvalancheWalletClient } from '@avalanche-sdk/client'
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains'
import { prepareAddPermissionlessValidatorTxn } from '@avalanche-sdk/client/methods/wallet/pChain'
import { signXPTransaction, sendXPTransaction } from '@avalanche-sdk/client/methods/wallet'
import { AlertCircle, Shield, Clock, Award, Info } from 'lucide-react'
import { networkIDs } from '@avalabs/avalanchejs'
import { NodeCredentialInput, type NodeCredentials } from '../../components/NodeCredentialInput'
import { Steps, Step } from 'fumadocs-ui/components/steps'

// Network-specific constants
const NETWORK_CONFIG = {
  fuji: {
    minStakeAvax: 1,
    minEndSeconds: 24 * 60 * 60, // 24 hours
    defaultDays: 1,
    presets: [
      { label: '1 day', days: 1 },
      { label: '1 week', days: 7 },
      { label: '2 weeks', days: 14 }
    ]
  },
  mainnet: {
    minStakeAvax: 2000,
    minEndSeconds: 14 * 24 * 60 * 60, // 14 days
    defaultDays: 14,
    presets: [
      { label: '2 weeks', days: 14 },
      { label: '1 month', days: 30 },
      { label: '3 months', days: 90 }
    ]
  }
}

const MAX_END_SECONDS = 365 * 24 * 60 * 60 // 1 year
const DEFAULT_DELEGATOR_REWARD_PERCENTAGE = "2"
const BUFFER_MINUTES = 5

export default function Stake() {
  const { coreWalletClient, pChainAddress, isTestnet, avalancheNetworkID } = useWalletStore()
  
  const [nodeCredentials, setNodeCredentials] = useState<NodeCredentials | null>(null)
  const [stakeInAvax, setStakeInAvax] = useState<string>("")
  const [endTime, setEndTime] = useState<string>("")
  const [delegatorRewardPercentage, setDelegatorRewardPercentage] = useState<string>(DEFAULT_DELEGATOR_REWARD_PERCENTAGE)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string>("")
  
  // Determine network configuration
  const onFuji = isTestnet === true || avalancheNetworkID === networkIDs.FujiID
  const config = onFuji ? NETWORK_CONFIG.fuji : NETWORK_CONFIG.mainnet
  const networkName = onFuji ? 'Fuji' : 'Mainnet'
  
  // Initialize defaults
  if (!stakeInAvax) {
    setStakeInAvax(String(config.minStakeAvax))
  }
  
  if (!endTime) {
    const d = new Date()
    d.setDate(d.getDate() + config.defaultDays)
    d.setMinutes(d.getMinutes() + BUFFER_MINUTES)
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setEndTime(iso)
  }
  
  const setEndInDays = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setMinutes(d.getMinutes() + BUFFER_MINUTES)
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setEndTime(iso)
  }
  
  const validateForm = (): string | null => {
    if (!coreWalletClient || !pChainAddress) {
      return 'Connect Core Wallet to get your P-Chain address'
    }
    
    if (!nodeCredentials) {
      return 'Please provide node credentials'
    }
    
    if (!nodeCredentials.nodeID?.startsWith('NodeID-')) {
      return 'Invalid NodeID format'
    }
    
    if (!nodeCredentials.publicKey?.startsWith('0x')) {
      return 'Invalid BLS Public Key format'
    }
    
    if (!nodeCredentials.proofOfPossession?.startsWith('0x')) {
      return 'Invalid BLS Signature format'
    }
    
    const stakeNum = Number(stakeInAvax)
    if (!Number.isFinite(stakeNum) || stakeNum < config.minStakeAvax) {
      return `Minimum stake is ${config.minStakeAvax.toLocaleString()} AVAX on ${networkName}`
    }
    
    if (!endTime) {
      return 'End time is required'
    }
    
    const endUnix = Math.floor(new Date(endTime).getTime() / 1000)
    const nowUnix = Math.floor(Date.now() / 1000)
    const duration = endUnix - nowUnix
    
    if (duration < config.minEndSeconds) {
      const minDuration = onFuji ? '24 hours' : '2 weeks'
      return `End time must be at least ${minDuration} from now (${networkName})`
    }
    
    if (duration > MAX_END_SECONDS) {
      return 'End time must be within 1 year'
    }
    
    const drp = Number(delegatorRewardPercentage)
    if (!Number.isFinite(drp) || drp < 2 || drp > 100) {
      return 'Delegator reward percentage must be between 2 and 100'
    }
    
    return null
  }
  
  const walletClient = useMemo(() => {
    const hasCore = typeof window !== 'undefined' && (window as any).avalanche
    const chainConfig = onFuji ? avalancheFuji : avalanche
    
    return createAvalancheWalletClient({
      chain: chainConfig,
      transport: hasCore ? { type: 'custom', provider: (window as any).avalanche } : { type: 'http' },
      account: undefined,
    })
  }, [onFuji])
  
  const submitStake = async () => {
    setError(null)
    setTxId("")
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    
    try {
      setIsSubmitting(true)
      
      const endUnix = Math.floor(new Date(endTime).getTime() / 1000)
      
      const { tx } = await prepareAddPermissionlessValidatorTxn(walletClient.pChain, {
        nodeId: nodeCredentials!.nodeID,
        stakeInAvax: Number(stakeInAvax),
        end: endUnix,
        rewardAddresses: [pChainAddress!],
        delegatorRewardAddresses: [pChainAddress!],
        delegatorRewardPercentage: Number(delegatorRewardPercentage),
        threshold: 1,
        locktime: 0,
        publicKey: nodeCredentials!.publicKey,
        signature: nodeCredentials!.proofOfPossession,
      })
      
      const { signedTxHex } = await signXPTransaction(walletClient.pChain, {
        tx,
        chainAlias: 'P',
      })
      
      const { txHash } = await sendXPTransaction(walletClient.pChain, {
        tx: signedTxHex,
        chainAlias: 'P',
      })
      
      setTxId(txHash)
    } catch (e: any) {
      // Handle insufficient funds error
      if (e?.message?.includes('Insufficient funds')) {
        const match = e.message.match(/need (\d+) more units/)
        if (match) {
          const needed = BigInt(match[1])
          const neededAvax = Number(needed) / 1e18
          setError(`${e.message} (${neededAvax.toFixed(4)} AVAX)`)
        } else {
          setError(e.message)
        }
      } else {
        setError(e?.message || 'Transaction failed. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const isDateButtonActive = (days: number) => {
    if (!endTime) return false
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const selectedDate = new Date(endTime)
    return Math.abs(targetDate.getTime() - selectedDate.getTime()) < 24 * 60 * 60 * 1000
  }
  
  return (
    <CheckWalletRequirements configKey={[WalletRequirementsConfigKey.PChainBalance]}>
      <Container
        title="Become a Validator"
        description="Stake AVAX to become a validator on the Primary Network and earn staking rewards"
      >
        <div className="space-y-6">
          <Steps>
            <Step>
              <h3 className="text-lg font-semibold mb-4">Node Credentials</h3>
              
              <NodeCredentialInput onCredentialsChange={setNodeCredentials} />
              
              {nodeCredentials && (
                <div className="flex items-start gap-2 p-3 mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <Shield className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Credentials loaded successfully
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono truncate">
                      {nodeCredentials.nodeID}
                    </p>
                  </div>
                </div>
              )}
            </Step>
            
            <Step>
              <h3 className="text-lg font-semibold mb-4">Stake Configuration</h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Stake Amount"
                  value={stakeInAvax}
                  onChange={setStakeInAvax}
                  type="number"
                  step="0.001"
                  min={config.minStakeAvax}
                  unit="AVAX"
                  helperText={`Minimum: ${config.minStakeAvax.toLocaleString()} AVAX (${networkName})`}
                  error={error && Number(stakeInAvax) < config.minStakeAvax ? `Minimum stake is ${config.minStakeAvax} AVAX` : null}
                />
                
                <Input
                  label="Delegator Fee"
                  value={delegatorRewardPercentage}
                  onChange={setDelegatorRewardPercentage}
                  type="number"
                  step="0.1"
                  min="2"
                  max="100"
                  unit="%"
                  helperText="Your fee from delegators (2-100%)"
                  error={error && (Number(delegatorRewardPercentage) < 2 || Number(delegatorRewardPercentage) > 100) ? 'Must be between 2-100%' : null}
                />
              </div>
            </Step>
            
            <Step>
              <h3 className="text-lg font-semibold mb-4">Staking Duration</h3>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                {config.presets.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => setEndInDays(preset.days)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      isDateButtonActive(preset.days)
                        ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <Input
                label="Custom End Date"
                value={endTime}
                onChange={setEndTime}
                type="datetime-local"
                helperText={`Min: ${onFuji ? '24 hours' : '2 weeks'} • Max: 1 year`}
                error={(() => {
                  if (!endTime || !error) return null
                  const d = Math.floor(new Date(endTime).getTime() / 1000) - Math.floor(Date.now()/1000)
                  if (d < config.minEndSeconds) return `Must be at least ${onFuji ? '24 hours' : '2 weeks'} from now`
                  if (d > MAX_END_SECONDS) return 'Must be within 1 year'
                  return null
                })()}
              />
            </Step>
          </Steps>
          
          {/* Important Information */}
          <div className="rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800">
            <h4 className="flex items-center gap-2.5 font-semibold text-yellow-900 dark:text-yellow-100 p-4 pb-3">
              <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              Before you stake
            </h4>
            <div className="px-4 pb-4 pl-[3.75rem]">
              <div className="grid gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>Your stake will be locked for the entire duration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 flex-shrink-0" />
                    <span>Maintain &gt;80% uptime to receive rewards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Small transaction fees will apply</span>
                  </div>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex gap-2 items-start">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}
          
          {/* Success Message */}
          {txId && (
            <Success 
              label="Transaction Submitted" 
              value={txId}
            />
          )}
          
          {/* Submit Button */}
          <Button
            onClick={submitStake}
            disabled={!pChainAddress || isSubmitting}
            loading={isSubmitting}
            loadingText="Processing transaction..."
            variant="primary"
            className="w-full"
            size="lg"
          >
            Start Validating on {networkName}
          </Button>
        </div>
      </Container>
    </CheckWalletRequirements>
  )
}