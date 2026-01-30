"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Loader2,
  Check,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Wallet,
  AlertTriangle
} from "lucide-react"
import { Steps, Step } from "fumadocs-ui/components/steps"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { Button } from "../../components/Button"
import SelectValidationID, { ValidationSelection } from "../../components/SelectValidationID"
import SelectSubnetId from "../../components/SelectSubnetId"
import { WalletRequirementsConfigKey } from "../../hooks/useWalletRequirements"
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata"
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext"
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url"
import { SDKCodeViewer, type SDKCodeSource } from "@/components/console/sdk-code-viewer"
import { cn } from "@/lib/utils"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const metadata: ConsoleToolMetadata = {
  title: "Validator Balance Increase",
  description: "Increase the balance of a validator to extend its validation period and maintain network participation",
  toolRequirements: [WalletRequirementsConfigKey.PChainBalance],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

// The actual source code from components/toolbox/coreViem/methods/increaseL1ValidatorBalance.ts
const INCREASE_BALANCE_SOURCE = `import type { AvalancheWalletClient } from "@avalanche-sdk/client";

export type IncreaseL1ValidatorBalanceParams = {
    validationId: string;
    balanceInAvax: number;
}

export async function increaseL1ValidatorBalance(
    client: AvalancheWalletClient,
    params: IncreaseL1ValidatorBalanceParams
): Promise<string> {
    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareIncreaseL1ValidatorBalanceTxn({
        validationId: params.validationId,
        balanceInAvax: params.balanceInAvax,
    });

    // Send the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}`

const SDK_SOURCES: SDKCodeSource[] = [
  {
    name: "TypeScript",
    filename: "increaseL1ValidatorBalance.ts",
    code: INCREASE_BALANCE_SOURCE,
    description: "Increase L1 validator balance using the Avalanche SDK. The balance funds continuous validation fees on the P-Chain.",
    githubUrl: "https://github.com/ava-labs/builders-hub/blob/master/components/toolbox/coreViem/methods/increaseL1ValidatorBalance.ts"
  }
]

function ValidatorBalanceIncrease({ onSuccess }: BaseConsoleToolProps) {
  const [amount, setAmount] = useState<string>("")
  const [subnetId, setSubnetId] = useState<string>("")
  const [validatorSelection, setValidatorSelection] = useState<ValidationSelection>({ validationId: "", nodeId: "" })
  const [loading, setLoading] = useState<boolean>(false)
  const [operationSuccessful, setOperationSuccessful] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [validatorTxId, setValidatorTxId] = useState<string>("")
  const [txCopied, setTxCopied] = useState(false)

  const { pChainAddress, isTestnet } = useWalletStore()
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance)
  const pChainBalance = useWalletStore((s) => s.balances.pChain)
  const { coreWalletClient } = useConnectedWallet()

  useEffect(() => {
    if (pChainAddress) {
      updatePChainBalance()
      const interval = setInterval(updatePChainBalance, 10000)
      return () => clearInterval(interval)
    }
  }, [pChainAddress, updatePChainBalance])

  const increaseValidatorBalance = async () => {
    if (!pChainAddress || !validatorSelection.validationId || !amount) {
      setError("Missing required information")
      return
    }
    const amountNumber = Number(amount)
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setError("Invalid amount provided.")
      return
    }
    if (amountNumber > pChainBalance) {
      setError("Amount exceeds available P-Chain balance.")
      return
    }

    setLoading(true)
    setError(null)
    setOperationSuccessful(false)
    setValidatorTxId("")

    try {
      const txHash = await coreWalletClient.increaseL1ValidatorBalance({
        validationId: validatorSelection.validationId,
        balanceInAvax: amountNumber,
      })

      setValidatorTxId(txHash)
      setOperationSuccessful(true)
      onSuccess?.()

      await delay(2000)
      await updatePChainBalance()
    } catch (error) {
      console.error("Error increasing validator balance:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const clearForm = () => {
    setAmount("")
    setSubnetId("")
    setValidatorSelection({ validationId: "", nodeId: "" })
    setError(null)
    setOperationSuccessful(false)
    setValidatorTxId("")
  }

  const handleCopyTx = useCallback(async () => {
    await navigator.clipboard.writeText(validatorTxId)
    setTxCopied(true)
    setTimeout(() => setTxCopied(false), 2000)
  }, [validatorTxId])

  const explorerUrl = `https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${validatorTxId}`
  const isDisabled = loading || !validatorSelection.validationId || !amount || Number(amount) <= 0 || Number(amount) > pChainBalance

  return (
    <SDKCodeViewer sources={SDK_SOURCES} height="auto">
      <div>
          {operationSuccessful ? (
            /* Success State */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-green-900 dark:text-green-100">
                      Balance Increased Successfully
                    </h3>
                    <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                      Added {amount} AVAX to validator balance
                    </p>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Amount</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{amount} AVAX</span>
                </div>
                {subnetId && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">L1</span>
                    <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {subnetId.slice(0, 8)}...{subnetId.slice(-6)}
                    </code>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Validation ID</span>
                  <code className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    {validatorSelection.validationId.slice(0, 8)}...{validatorSelection.validationId.slice(-6)}
                  </code>
                </div>
              </div>

              {/* Transaction Hash */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <code className="flex-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
                  {validatorTxId}
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
                Increase Another Balance
              </Button>
            </div>
          ) : (
            /* Form State with Steps */
            <Steps>
              <Step>
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Select L1</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  Choose the L1 network where your validator operates.
                </p>
                <SelectSubnetId
                  value={subnetId}
                  onChange={setSubnetId}
                  hidePrimaryNetwork={true}
                  error={error && error.toLowerCase().includes("subnet") ? error : undefined}
                />
              </Step>

              <Step>
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Select Validator</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  Choose the validator to increase balance for.
                </p>
                <SelectValidationID
                  value={validatorSelection.validationId}
                  onChange={setValidatorSelection}
                  format="cb58"
                  subnetId={subnetId}
                  error={error && error.toLowerCase().includes("validation") ? error : undefined}
                />
              </Step>

              <Step>
                <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100 mb-1">Enter Amount</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                  Specify the AVAX amount to add to your validator's balance.
                </p>

                <div className="space-y-4">
                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.0"
                        step="0.001"
                        min="0"
                        disabled={loading}
                        className={cn(
                          "w-full px-3 py-2 pr-16 text-sm rounded-lg border bg-white dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 transition-colors",
                          error && error.toLowerCase().includes("amount")
                            ? "border-red-300 dark:border-red-700"
                            : "border-zinc-200 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-600",
                          "focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded">
                        AVAX
                      </div>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">P-Chain Balance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {pChainBalance.toFixed(4)} AVAX
                      </span>
                      <button
                        type="button"
                        onClick={loading ? undefined : updatePChainBalance}
                        disabled={loading}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && !error.toLowerCase().includes("amount") && !error.toLowerCase().includes("balance") && !error.toLowerCase().includes("validation") && !error.toLowerCase().includes("subnet") && (
                    <div className="flex gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/50">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    variant="primary"
                    onClick={increaseValidatorBalance}
                    loading={loading}
                    disabled={isDisabled}
                    className="w-full"
                  >
                    Increase Balance
                  </Button>
                </div>
              </Step>
            </Steps>
          )}
      </div>
    </SDKCodeViewer>
  )
}

export default withConsoleToolMetadata(ValidatorBalanceIncrease, metadata)
