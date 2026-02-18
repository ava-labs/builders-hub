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
import { CliAlternative } from "@/components/console/cli-alternative";
import { Success } from "@/components/toolbox/components/Success";
import Link from "next/link";

const STAKE_VALIDATOR_SOURCE = `import type { AvalanchePChainWalletClient } from "@avalanche-sdk/client";
import { prepareAddPermissionlessValidatorTxn } from "@avalanche-sdk/client/methods/wallet/pChain";
import { sendXPTransaction } from "@avalanche-sdk/client/methods/wallet";

export async function stakeOnPrimaryNetwork(
  pChainClient: AvalanchePChainWalletClient,
  params: {
    nodeId: string;
    stakeInAvax: number;
    endTime: number;
    rewardAddress: string;
    delegationFee: number;
    publicKey: string;
    signature: string;
  }
): Promise<string> {
  const { tx } = await prepareAddPermissionlessValidatorTxn(pChainClient, {
    nodeId: params.nodeId,
    stakeInAvax: params.stakeInAvax,
    end: params.endTime,
    rewardAddresses: [params.rewardAddress],
    delegatorRewardAddresses: [params.rewardAddress],
    delegatorRewardPercentage: params.delegationFee,
    threshold: 1,
    locktime: 0,
    publicKey: params.publicKey,
    signature: params.signature,
  });

  const result = await sendXPTransaction(pChainClient, {
    tx,
    chainAlias: "P",
  });

  return result.txHash;
}`;

const SDK_SOURCES: SDKCodeSource[] = [
  {
    name: "TypeScript",
    filename: "stakeOnPrimaryNetwork.ts",
    code: STAKE_VALIDATOR_SOURCE,
    description: "Add a permissionless validator to the Primary Network using the Avalanche SDK.",
  }
];

const NETWORK_CONFIG = {
  fuji: {
    minStakeAvax: 1,
    minEndSeconds: 24 * 60 * 60,
    defaultDays: 1,
    presets: [
      { label: '1 day', days: 1 },
      { label: '1 week', days: 7 },
      { label: '2 weeks', days: 14 }
    ]
  },
  mainnet: {
    minStakeAvax: 2000,
    minEndSeconds: 14 * 24 * 60 * 60,
    defaultDays: 14,
    presets: [
      { label: '2 weeks', days: 14 },
      { label: '1 month', days: 30 },
      { label: '3 months', days: 90 }
    ]
  }
}

const MAX_END_SECONDS = 365 * 24 * 60 * 60
const DEFAULT_DELEGATOR_FEE = "2"
const BUFFER_MINUTES = 5

const metadata: ConsoleToolMetadata = {
  title: "Stake on Primary Network",
  description: <>Add a <Link href="/docs/nodes/run-a-node/manually" className="text-primary hover:underline">validator</Link> to Avalanche's <Link href="/docs/rpcs/p-chain/api" className="text-primary hover:underline">Primary Network</Link>. Issues an <Link href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx" className="text-primary hover:underline">AddPermissionlessValidatorTx</Link> on the P-Chain.</>,
  toolRequirements: [
    WalletRequirementsConfigKey.WalletConnected
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

function Stake({ onSuccess }: BaseConsoleToolProps) {
  const { pChainAddress, isTestnet, avalancheNetworkID } = useWalletStore()
  const { avalancheWalletClient } = useWallet();

  const [validator, setValidator] = useState<ConvertToL1Validator | null>(null)
  const [stakeInAvax, setStakeInAvax] = useState<string>("")
  const [endTime, setEndTime] = useState<string>("")
  const [delegationFee, setDelegationFee] = useState<string>(DEFAULT_DELEGATOR_FEE)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txId, setTxId] = useState<string>("")

  const { notify } = useConsoleNotifications();

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

  const isDateButtonActive = (days: number) => {
    if (!endTime) return false
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const selectedDate = new Date(endTime)
    return Math.abs(targetDate.getTime() - selectedDate.getTime()) < 24 * 60 * 60 * 1000
  }

  const getDurationHours = () => {
    if (!endTime) return 0
    const endUnix = Math.floor(new Date(endTime).getTime() / 1000)
    const nowUnix = Math.floor(Date.now() / 1000)
    return Math.max(0, Math.floor((endUnix - nowUnix) / 3600))
  }

  const validateForm = (): string | null => {
    if (!pChainAddress) return 'Connect Core Wallet to get your P-Chain address'
    if (!validator) return 'Please provide validator credentials'
    if (!validator.nodeID?.startsWith('NodeID-')) return 'Invalid NodeID format'
    if (!validator.nodePOP.publicKey?.startsWith('0x')) return 'Invalid BLS Public Key format'
    if (!validator.nodePOP.proofOfPossession?.startsWith('0x')) return 'Invalid BLS Signature format'

    const stakeNum = Number(stakeInAvax)
    if (!Number.isFinite(stakeNum) || stakeNum < config.minStakeAvax) {
      return `Minimum stake is ${config.minStakeAvax.toLocaleString()} AVAX on ${networkName}`
    }

    if (!endTime) return 'End time is required'
    const endUnix = Math.floor(new Date(endTime).getTime() / 1000)
    const duration = endUnix - Math.floor(Date.now() / 1000)
    if (duration < config.minEndSeconds) return `End time must be at least ${onFuji ? '24 hours' : '2 weeks'} from now`
    if (duration > MAX_END_SECONDS) return 'End time must be within 1 year'

    const fee = Number(delegationFee)
    if (!Number.isFinite(fee) || fee < 2 || fee > 100) return 'Delegation fee must be between 2 and 100'

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
        delegatorRewardPercentage: Number(delegationFee),
        threshold: 1,
        locktime: 0,
        publicKey: validator!.nodePOP.publicKey,
        signature: validator!.nodePOP.proofOfPossession,
      })

      const stakePromise = sendXPTransaction(avalancheWalletClient.pChain, {
        tx,
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

  const cliCommand = `platform validator add --node-id ${validator?.nodeID || "<node-id>"} --stake ${stakeInAvax || "<amount>"} --duration ${getDurationHours()}h --delegation-fee ${Number(delegationFee) / 100} --network ${onFuji ? "fuji" : "mainnet"}`

  return (
    <SDKCodeViewer sources={SDK_SOURCES} height="auto">
      <div>
        {txId ? (
          <div className="space-y-4">
            <Success
              label="Validator Staked"
              value={txId}
              isTestnet={isTestnet}
              xpChain="P"
            />
            <Button
              variant="secondary"
              onClick={() => {
                setValidator(null)
                setStakeInAvax(String(config.minStakeAvax))
                setDelegationFee(DEFAULT_DELEGATOR_FEE)
                setError(null)
                setTxId("")
              }}
              className="w-full"
            >
              Stake Another Validator
            </Button>
          </div>
        ) : (
          <Steps>
            <Step>
              <h3 className="text-[14px] font-semibold mb-1">Node Credentials</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                Provide your node's ID and BLS credentials.
              </p>

              <AddValidatorControls
                defaultAddress={pChainAddress || ""}
                canAddMore={!validator}
                onAddValidator={setValidator}
                isTestnet={false}
              />

              {validator && (
                <div className="mt-3 p-3 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 rounded-lg space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">Node ID</div>
                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{validator.nodeID}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">BLS Public Key</div>
                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all truncate">{validator.nodePOP.publicKey}</div>
                  </div>
                </div>
              )}
            </Step>

            <Step>
              <h3 className="text-[14px] font-semibold mb-1">Stake Configuration</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                Set your stake amount, delegation fee, and duration.
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
                  label="Delegation Fee"
                  value={delegationFee}
                  onChange={setDelegationFee}
                  type="number"
                  step="0.1"
                  min="2"
                  max="100"
                  unit="%"
                  helperText="Your fee from delegators (2-100%)"
                  error={error && (Number(delegationFee) < 2 || Number(delegationFee) > 100) ? 'Must be between 2-100%' : null}
                />

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Duration</label>
                  <div className="flex gap-2 mb-2">
                    {config.presets.map((preset) => (
                      <button
                        key={preset.days}
                        onClick={() => setEndInDays(preset.days)}
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${isDateButtonActive(preset.days)
                          ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100'
                          : 'border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    label=""
                    value={endTime}
                    onChange={setEndTime}
                    type="datetime-local"
                    helperText={`Min: ${onFuji ? '24 hours' : '2 weeks'} · Max: 1 year`}
                    error={(() => {
                      if (!endTime || !error) return null
                      const d = Math.floor(new Date(endTime).getTime() / 1000) - Math.floor(Date.now() / 1000)
                      if (d < config.minEndSeconds) return `Must be at least ${onFuji ? '24 hours' : '2 weeks'} from now`
                      if (d > MAX_END_SECONDS) return 'Must be within 1 year'
                      return null
                    })()}
                  />
                </div>
              </div>
            </Step>

            <Step>
              <h3 className="text-[14px] font-semibold mb-1">Submit</h3>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3">
                Issues an{" "}
                <Link href="/docs/rpcs/p-chain/txn-format#unsigned-add-permissionless-validator-tx" className="text-primary hover:underline">
                  AddPermissionlessValidatorTx
                </Link>{" "}
                on the P-Chain.
              </p>

              {error && (
                <Alert variant="error">{error}</Alert>
              )}

              <Button
                onClick={submitStake}
                disabled={!pChainAddress || isSubmitting}
                loading={isSubmitting}
                loadingText="Processing..."
                variant="primary"
                className="w-full mt-3"
              >
                Stake {networkName} Validator
              </Button>

              <CliAlternative command={cliCommand} />
            </Step>
          </Steps>
        )}
      </div>
    </SDKCodeViewer>
  )
}

export default withConsoleToolMetadata(Stake, metadata)
