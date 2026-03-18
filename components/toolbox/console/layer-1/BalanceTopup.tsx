"use client"
import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, ArrowUpRight, RefreshCw } from "lucide-react"
import { Button } from "../../components/Button"
import { useWalletStore } from "@/components/toolbox/stores/walletStore"
import { Input } from "../../components/Input"
import SelectValidationID, { ValidationSelection } from "../../components/SelectValidationID"
import SelectSubnetId from "../../components/SelectSubnetId"
import { WalletRequirementsConfigKey } from "../../hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Alert } from "../../components/Alert";

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const metadata: ConsoleToolMetadata = {
  title: "Validator Balance Increase",
  description: "Increase the balance of a validator to extend its validation period and maintain network participation",
  toolRequirements: [
    WalletRequirementsConfigKey.PChainBalance
  ],
  githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
}

function ValidatorBalanceIncrease({ onSuccess }: BaseConsoleToolProps) {

  const [amount, setAmount] = useState<string>("")
  const [subnetId, setSubnetId] = useState<string>("")
  const [validatorSelection, setValidatorSelection] = useState<ValidationSelection>({ validationId: "", nodeId: "" })
  const [loading, setLoading] = useState<boolean>(false)
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [operationSuccessful, setOperationSuccessful] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [validatorTxId, setValidatorTxId] = useState<string>("")

  // Use nullish coalescing to safely access store values
  const { pChainAddress, isTestnet } = useWalletStore()
  const updatePChainBalance = useWalletStore((s) => s.updatePChainBalance);
  const pChainBalance = useWalletStore((s) => s.balances.pChain);
  const { coreWalletClient } = useConnectedWallet()

  // Fetch P-Chain balance periodically
  useEffect(() => {
    if (pChainAddress) {
      updatePChainBalance()
      const interval = setInterval(updatePChainBalance, 10000)
      return () => clearInterval(interval)
    }
  }, [pChainAddress, updatePChainBalance])

  // Handle confetti timeout
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showConfetti])

  // Function to increase validator balance
  const increaseValidatorBalance = async () => {
    if (!pChainAddress || !validatorSelection.validationId || !amount) {
      setError("Missing required information")
      return
    }
    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setError("Invalid amount provided.")
      return;
    }
    if (amountNumber > pChainBalance) {
      setError("Amount exceeds available P-Chain balance.")
      return;
    }

    setLoading(true)
    setError(null)
    setOperationSuccessful(false)
    setValidatorTxId("")
    setStatusMessage("Increasing validator balance...")

    try {
      const txHash = await coreWalletClient.increaseL1ValidatorBalance({
        validationId: validatorSelection.validationId,
        balanceInAvax: amountNumber,
      })

      console.log("Validator balance increase transaction sent:", txHash)
      setValidatorTxId(txHash)

      setShowConfetti(true)
      setOperationSuccessful(true)
      onSuccess?.()

      await delay(2000)
      await updatePChainBalance()

    } catch (error) {
      console.error("Error increasing validator balance:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred during the balance increase.")
    } finally {
      setLoading(false)
      setStatusMessage("")
    }
  }

  // Helper function to clear form state
  const clearForm = () => {
    setAmount("")
    setSubnetId("")
    setValidatorSelection({ validationId: "", nodeId: "" })
    setError(null)
    setOperationSuccessful(false)
    setValidatorTxId("")
  }

  return (
    <div className="space-y-6 w-full">
      {operationSuccessful ? (
            <div className="p-6 space-y-6 animate-fadeIn max-w-md mx-auto">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Success!</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  You've successfully increased your validator's balance.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Amount Increased</span>
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{amount} AVAX</span>
                </div>
                {subnetId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Subnet ID</span>
                    <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]">{subnetId}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Validator ID</span>
                  <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]">{validatorSelection.validationId}</span>
                </div>
                {validatorSelection.nodeId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Node ID</span>
                    <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]">{validatorSelection.nodeId}</span>
                  </div>
                )}
                {validatorTxId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Transaction</span>
                    <a
                      href={`https://${isTestnet ? "subnets-test" : "subnets"}.avax.network/p-chain/tx/${validatorTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                    >
                      View in Explorer
                      <ArrowUpRight className="w-4 h-4 text-red-500" />
                    </a>
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={clearForm}
                className="w-full py-2 px-4 text-sm font-medium"
              >
                Increase Another Validator Balance
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <SelectSubnetId
                  value={subnetId}
                  onChange={setSubnetId}
                  hidePrimaryNetwork={true}
                  error={error && error.toLowerCase().includes("subnet") ? error : undefined}
                />

                <SelectValidationID
                  value={validatorSelection.validationId}
                  onChange={setValidatorSelection}
                  format="cb58"
                  subnetId={subnetId}
                  error={error && error.toLowerCase().includes("validation") ? error : undefined}
                />

                <Input
                  label="Amount to Add"
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.0"
                  step="0.001"
                  min="0"
                  disabled={loading}
                  error={error && error.toLowerCase().includes("amount") ? error : undefined}
                  button={<Button
                    variant="secondary"
                    className="pointer-events-none px-3"
                    stickLeft
                  >
                    AVAX
                  </Button>}
                />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Available P-Chain Balance
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pChainBalance.toFixed(4)} <span className="text-sm text-zinc-500 dark:text-zinc-400">AVAX</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Refresh balance"
                      onClick={loading ? undefined : updatePChainBalance}
                      className={`ml-1 flex items-center cursor-pointer transition text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ${loading ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </span>
                  </div>
                  {(error && error.toLowerCase().includes("balance") || error && error.toLowerCase().includes("utxo")) && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                  )}
                </div>
              </div>

              <Alert variant="error">
                This action will use AVAX from your P-Chain address ({pChainAddress ? `${pChainAddress.substring(0, 10)}...${pChainAddress.substring(pChainAddress.length - 4)}` : 'Loading...'}) to increase the balance of the specified L1 validator. Ensure the Validation ID is correct.
              </Alert>

              {error && !error.toLowerCase().includes("amount") && !error.toLowerCase().includes("balance") && !error.toLowerCase().includes("utxo") && !error.toLowerCase().includes("validation") && !error.toLowerCase().includes("subnet") && (
                <Alert variant="error">{error}</Alert>
              )}

              <Button
                variant="primary"
                onClick={increaseValidatorBalance}
                disabled={loading || !validatorSelection.validationId || !amount || Number(amount) <= 0 || Number(amount) > pChainBalance}
                className="w-full py-2 px-4 text-sm font-medium"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {statusMessage || "Processing..."}
                  </span>
                ) : (
                  "Increase Validator Balance"
                )}
              </Button>
            </div>
          )}

        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-4 h-4 bg-yellow-500 rounded-full animate-confetti-1"></div>
            <div className="absolute top-0 left-1/2 w-4 h-4 bg-green-500 rounded-full animate-confetti-2"></div>
            <div className="absolute top-0 right-1/4 w-4 h-4 bg-pink-500 rounded-full animate-confetti-3"></div>
            <div className="absolute top-0 right-1/3 w-3 h-3 bg-blue-500 rounded-full animate-confetti-2"></div>
            <div className="absolute top-0 left-1/3 w-3 h-3 bg-purple-500 rounded-full animate-confetti-3"></div>
          </div>
        )}
    </div>
  )
}

export default withConsoleToolMetadata(ValidatorBalanceIncrease, metadata)