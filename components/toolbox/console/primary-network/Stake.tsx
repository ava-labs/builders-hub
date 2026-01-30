"use client";

import { useState, useCallback } from 'react'
import { Button } from '@/components/toolbox/components/Button'
import { Input } from '@/components/toolbox/components/Input'
import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements'
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../components/WithConsoleToolMetadata'
import { useWalletStore } from '@/components/toolbox/stores/walletStore'
import { useWallet } from '@/components/toolbox/hooks/useWallet'
import { prepareAddPermissionlessValidatorTxn } from '@avalanche-sdk/client/methods/wallet/pChain'
import { sendXPTransaction } from '@avalanche-sdk/client/methods/wallet'
import { networkIDs } from '@avalabs/avalanchejs'
import { AddValidatorControls } from '@/components/toolbox/components/ValidatorListInput/AddValidatorControls'
import type { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput'
import { Steps, Step } from 'fumadocs-ui/components/steps'
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Alert } from '@/components/toolbox/components/Alert';
import { SDKCodeViewer, type SDKCodeSource } from "@/components/console/sdk-code-viewer";
import { Check, Copy, ArrowUpRight } from "lucide-react";

// SDK source code for display
const STAKE_VALIDATOR_SOURCE = `import type { AvalanchePChainWalletClient } from "@avalanche-sdk/client";
import { prepareAddPermissionlessValidatorTxn } from "@avalanche-sdk/client/methods/wallet/pChain";
import { sendXPTransaction } from "@avalanche-sdk/client/methods/wallet";

export type StakeValidatorParams = {
  nodeId: string;
  stakeInAvax: number;
  endTime: number; // Unix timestamp
  rewardAddress: string;
  delegatorRewardPercentage: number;
  publicKey: string; // BLS public key
  signature: string; // Proof of possession
};

export async function stakeOnPrimaryNetwork(
  pChainClient: AvalanchePChainWalletClient,
  params: StakeValidatorParams
): Promise<string> {
  // Prepare the add permissionless validator transaction
  const { tx } = await prepareAddPermissionlessValidatorTxn(pChainClient, {
    nodeId: params.nodeId,
    stakeInAvax: params.stakeInAvax,
    end: params.endTime,
    rewardAddresses: [params.rewardAddress],
    delegatorRewardAddresses: [params.rewardAddress],
    delegatorRewardPercentage: params.delegatorRewardPercentage,
    threshold: 1,
    locktime: 0,
    publicKey: params.publicKey,
    signature: params.signature,
  });

  // Send the transaction to the P-Chain
  const result = await sendXPTransaction(pChainClient, {
    tx: tx,
    chainAlias: "P",
  });

  return result.txHash;
}`;

const SDK_SOURCES: SDKCodeSource[] = [
  {
    name: "TypeScript",
    filename: "stakeOnPrimaryNetwork.ts",
    code: STAKE_VALIDATOR_SOURCE,
    description: "Add a permissionless validator to Avalanche Primary Network using the Avalanche SDK.",
    githubUrl: "https://github.com/ava-labs/builders-hub/blob/master/components/toolbox/console/primary-network/Stake.tsx"
  }
];

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

const metadata: ConsoleToolMetadata = {
  title: "Stake on Primary Network",
  description: "Stake AVAX as a validator on Avalanche's Primary Network to secure the network and earn rewards",
  toolRequirements: [
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

function Stake({ onSuccess }: BaseConsoleToolProps) {
  const { pChainAddress, isTestnet, avalancheNetworkID } = useWalletStore()
  const { avalancheWalletClient } = useWallet();

  const [validator, setValidator] = useState<ConvertToL1Validator | null>(null)
  const [stakeInAvax, setStakeInAvax] = useState<string>("")
  const [endTime, setEndTime] = useState<string>("")
  const [delegatorRewardPercentage, setDelegatorRewardPercentage] = useState<string>(DEFAULT_DELEGATOR_REWARD_PERCENTAGE)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string>("")
  const [txCopied, setTxCopied] = useState(false)

  const { notify } = useConsoleNotifications();

  const handleCopyTx = useCallback(async () => {
    await navigator.clipboard.writeText(txId)
    setTxCopied(true)
    setTimeout(() => setTxCopied(false), 2000)
  }, [txId])

  const explorerUrl = `https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${txId}`

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
    if (!pChainAddress) {
      return 'Connect Core Wallet to get your P-Chain address'
    }

    if (!validator) {
      return 'Please provide validator credentials'
    }

    if (!validator.nodeID?.startsWith('NodeID-')) {
      return 'Invalid NodeID format'
    }

    if (!validator.nodePOP.publicKey?.startsWith('0x')) {
      return 'Invalid BLS Public Key format'
    }

    if (!validator.nodePOP.proofOfPossession?.startsWith('0x')) {
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

  const submitStake = async () => {
    setError(null)
    setTxId("")

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!avalancheWalletClient) {
      setError("Avalanche client not found")
      return
    }

    try {
      setIsSubmitting(true)

      const endUnix = Math.floor(new Date(endTime).getTime() / 1000)
      const { tx } = await prepareAddPermissionlessValidatorTxn(avalancheWalletClient.pChain, {
        nodeId: validator!.nodeID,
        stakeInAvax: Number(stakeInAvax),
        end: endUnix,
        rewardAddresses: [pChainAddress!],
        delegatorRewardAddresses: [pChainAddress!],
        delegatorRewardPercentage: Number(delegatorRewardPercentage),
        threshold: 1,
        locktime: 0,
        publicKey: validator!.nodePOP.publicKey,
        signature: validator!.nodePOP.proofOfPossession,
      })

      const stakePromise = sendXPTransaction(avalancheWalletClient.pChain, {
        tx: tx,
        chainAlias: 'P',
      }).then(result => result.txHash);

      notify('addPermissionlessValidator', stakePromise);

      const txHash = await stakePromise;
      setTxId(txHash)
      onSuccess?.()
    } catch (e: any) {
      setError(e.message)
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

  const clearForm = () => {
    setValidator(null)
    setStakeInAvax(String(config.minStakeAvax))
    const d = new Date()
    d.setDate(d.getDate() + config.defaultDays)
    d.setMinutes(d.getMinutes() + BUFFER_MINUTES)
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setEndTime(iso)
    setDelegatorRewardPercentage(DEFAULT_DELEGATOR_REWARD_PERCENTAGE)
    setError(null)
    setTxId("")
  }

  return (
    <SDKCodeViewer sources={SDK_SOURCES} height="auto">
      <div>
        {txId ? (
          /* Success State */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                    Validator Staked Successfully
                  </h3>
                  <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                    Staked {stakeInAvax} AVAX on {networkName}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Stake Amount</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{stakeInAvax} AVAX</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Network</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{networkName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Delegator Fee</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{delegatorRewardPercentage}%</span>
              </div>
              {validator && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Node ID</span>
                  <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    {validator.nodeID.slice(0, 12)}...{validator.nodeID.slice(-6)}
                  </code>
                </div>
              )}
            </div>

            {/* Transaction Hash */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <code className="flex-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
                {txId}
              </code>
              <button
                type="button"
                onClick={handleCopyTx}
                className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {txCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
              </a>
            </div>

            <Button variant="secondary" onClick={clearForm} className="w-full">
              Stake Another Validator
            </Button>
          </div>
        ) : (
          /* Form State */
          <Steps>
            <Step>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Node Credentials</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                Provide your node's ID and BLS credentials.
              </p>

              <AddValidatorControls
                defaultAddress={pChainAddress || ""}
                canAddMore={!validator}
                onAddValidator={setValidator}
                isTestnet={false}
              />

              {validator && (
                <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Node ID</div>
                      <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{validator.nodeID}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">BLS Public Key</div>
                      <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all truncate">{validator.nodePOP.publicKey}</div>
                    </div>
                  </div>
                </div>
              )}
            </Step>

            <Step>
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Stake Configuration</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                Set your stake amount and delegator fee.
              </p>

              <div className="space-y-4">
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
              <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Staking Duration</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                Choose how long to stake your validator.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {config.presets.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => setEndInDays(preset.days)}
                      className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${isDateButtonActive(preset.days)
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
                    const d = Math.floor(new Date(endTime).getTime() / 1000) - Math.floor(Date.now() / 1000)
                    if (d < config.minEndSeconds) return `Must be at least ${onFuji ? '24 hours' : '2 weeks'} from now`
                    if (d > MAX_END_SECONDS) return 'Must be within 1 year'
                    return null
                  })()}
                />

                {/* Error */}
                {error && (
                  <Alert variant="error">{error}</Alert>
                )}

                {/* Submit Button */}
                <Button
                  onClick={submitStake}
                  disabled={!pChainAddress || isSubmitting}
                  loading={isSubmitting}
                  loadingText="Processing..."
                  variant="primary"
                  className="w-full"
                >
                  Stake {networkName} Validator
                </Button>
              </div>
            </Step>
          </Steps>
        )}
      </div>
    </SDKCodeViewer>
  )
}

export default withConsoleToolMetadata(Stake, metadata)
