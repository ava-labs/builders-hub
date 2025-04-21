"use client"
import { useEffect, useState } from "react"
import { AlertCircle, Loader2, CheckCircle2, ArrowUpRight } from "lucide-react"
import { Button } from "../../components/Button"
import { Container } from "../components/Container"
import { Context, pvm, utils } from "@avalabs/avalanchejs"
import { useWalletStore } from "../../lib/walletStore"
import { cn } from "../../lib/utils"
import { bytesToHex } from "viem"
import CrossChainTransfer from "../Wallet/CrossChainTransfer" // Import your existing component
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define the type for window.avalanche response
interface AvalancheResponse {
  txID?: string;
  [key: string]: any;
}

export default function ValidatorBalanceIncrease() {

  const [amount, setAmount] = useState<string>("")
  const [validationId, setValidationId] = useState<string>("")
  const [pChainBalance, setPChainBalance] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [showConfetti, setShowConfetti] = useState<boolean>(false)
  const [transferCompleted, setTransferCompleted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [validatorTxId, setValidatorTxId] = useState<string>("")
  const [step, setStep] = useState<"transfer" | "validator" | "success">("transfer")

  // Use nullish coalescing to safely access store values
  const { pChainAddress, coreWalletClient, isTestnet } = useWalletStore()

  // Fetch P-Chain balance
  const fetchPChainBalance = async () => {
    if (coreWalletClient && pChainAddress) {
      try {
        const balance = await coreWalletClient.getPChainBalance()
        const balanceNumber = Number(balance) / 1e9
        setPChainBalance(balanceNumber)

        // If P-Chain balance>0, enable the Increase Validator Balance step
        if (balanceNumber > 0 && step === "transfer") {
          setStep("validator")
        }
      } catch (error) {
        console.error("Error fetching P-Chain balance:", error)
      }
    }
  }

  // Fetch P-Chain balance periodically
  useEffect(() => {
    if (coreWalletClient && pChainAddress) {
      fetchPChainBalance()
      const interval = setInterval(fetchPChainBalance, 5000)
      return () => clearInterval(interval)
    }
  }, [coreWalletClient, pChainAddress, step])

  // Handle confetti timeout
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showConfetti])

  // Function to increase validator balance
  const increaseValidatorBalance = async () => {
    if (!pChainAddress || !validationId || !amount) {
      setError("Missing required information")
      return
    }

    setLoading(true)
    setError(null)
    setStatusMessage("Increasing validator balance...")

    try {
      const platformEndpoint = getRPCEndpoint(isTestnet ?? false)
      const pvmApi = new pvm.PVMApi(platformEndpoint)
      const context = await Context.getContextFromURI(platformEndpoint)
      const feeState = await pvmApi.getFeeState()

      const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] })
      if (utxos.length === 0) {
        throw new Error('No UTXOs found for P-chain transfer')
      }

      const amountNAvax = BigInt(Math.floor(Number(amount) * 1e9))

      const unsignedTx = pvm.e.newIncreaseL1ValidatorBalanceTx(
        {
          balance: amountNAvax,
          feeState,
          fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
          utxos,
          validationId,
        },
        context,
      )

      const unsignedTxBytes = unsignedTx.toBytes()
      const unsignedTxHex = bytesToHex(unsignedTxBytes)

      // Check if wallet extension is available
      if (typeof window === 'undefined' || !window.avalanche) {
        throw new Error("Avalanche wallet extension not found")
      }

      // Send the transaction to the wallet for signing and broadcasting
      console.log("Sending transaction to wallet:", unsignedTxHex)
      const response = await window.avalanche.request({
        method: "avalanche_sendTransaction",
        params: {
          transactionHex: unsignedTxHex,
          chainAlias: "P",
        },
      }) as AvalancheResponse

      console.log("Validator balance increase transaction sent:", response)

      if (response?.txID) {
        setValidatorTxId(response.txID)
      } else if (typeof response === 'string') {
        setValidatorTxId(response)
      }

      setShowConfetti(true)
      setTransferCompleted(true)
      setStep("success")

      await delay(2000)
      await fetchPChainBalance()

      return response
    } catch (error) {
      console.error("Error increasing validator balance:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
      throw error
    } finally {
      setLoading(false)
      setStatusMessage("")
    }
  }

  // Handler for amount change from cross-chain transfer
  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount)
  }

  const handleReset = () => {
    setStep("transfer")
    setAmount("")
    setValidatorTxId("")
    setTransferCompleted(false)
    setError(null)
    setStatusMessage("")
  }

  return (
    <Container
      title="L1 Validator Balance Topup"
      description="Transfer tokens from C-Chain to P-Chain and increase validator balance."
    >
      <div className="space-y-8 w-full max-w-4xl mx-auto">
        {/* C to P Transfer */}
        <div className={cn(
          "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden",
          step !== "transfer" && "opacity-60"
        )}>
          <div className="p-4 bg-red-50 dark:bg-red-900/10 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Step 1: Transfer AVAX from C-Chain to P-Chain
            </h2>
          </div>
          <div className="p-6">
            <CrossChainTransfer
              suggestedAmount={amount}
              onAmountChange={handleAmountChange}
              onTransferComplete={() => setStep("validator")}
            />
          </div>
        </div>

        {/* Increase Validator Balance */}
        <div className={cn(
          "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden",
          step !== "validator" && (step === "transfer" ? "opacity-40" : "opacity-60")
        )}>
          <div className="p-4 bg-gradient-to-r from-red-50 to-blue-50 dark:from-red-900/10 dark:to-blue-900/10 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Step 2: Increase Validator Balance
            </h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="validationId">
                  Validation ID
                </label>
                <input
                  id="validationId"
                  type="text"
                  value={validationId}
                  onChange={(e) => setValidationId(e.target.value)}
                  className="mt-1 block w-full font-mono text-sm rounded-md border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-3"
                  placeholder="Enter validation ID"
                  disabled={step !== "validator"}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Amount to Transfer
                </label>
                <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent border-none focus:outline-none text-zinc-900 dark:text-zinc-100"
                    placeholder="0.000"
                    step="0.001"
                    min="0"
                    disabled={step !== "validator"}
                  />
                  <span className="text-zinc-500 dark:text-zinc-400">AVAX</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Available P-Chain Balance
                </label>
                <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {pChainBalance.toFixed(4)} <span className="text-blue-500 dark:text-blue-400">AVAX</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              <div className="flex gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p>This will increase your validator's P-Chain balance. Ensure the ValidationID is correct.</p>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={increaseValidatorBalance}
              disabled={loading || !validationId || !amount || Number(amount) <= 0 || Number(amount) > pChainBalance || step !== "validator"}
              className="w-full py-2 px-4 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-white inline-block" />
                  {statusMessage || "Processing..."}
                </span>
              ) : (
                <>
                  Increase Validator Balance
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Upon Successful Tx */}
        {step === "success" && transferCompleted && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden p-6 space-y-6 animate-fadeIn">
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
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Amount</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{amount} AVAX</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Validator ID</span>
                <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]">{validationId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Status</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Confirmed</span>
              </div>
              {validatorTxId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Transaction</span>
                  <a
                    href={`https://subnets-test.avax.network/p-chain/tx/${validatorTxId}`}
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
              variant="primary"
              onClick={handleReset}
              className="w-full py-2 px-4 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200"
            >
              Start New Transfer →
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
            <div className="flex gap-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-4 h-4 bg-yellow-500 rounded-full animate-confetti-1"></div>
          <div className="absolute top-0 left-1/2 w-4 h-4 bg-green-500 rounded-full animate-confetti-2"></div>
          <div className="absolute top-0 right-1/4 w-4 h-4 bg-pink-500 rounded-full animate-confetti-3"></div>
          <div className="absolute top-0 right-1/3 w-3 h-3 bg-blue-500 rounded-full animate-confetti-2"></div>
          <div className="absolute top-0 left-1/3 w-3 h-3 bg-purple-500 rounded-full animate-confetti-3"></div>
        </div>
      )}
    </Container>
  )
}
