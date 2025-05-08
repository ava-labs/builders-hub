"use client"
import { useEffect, useState } from "react"
import { AlertCircle, Loader2, CheckCircle2, ArrowUpRight, RefreshCw } from "lucide-react"
import { Button } from "../../components/Button"
import { Container } from "../components/Container"
import { Context, pvm, utils } from "@avalabs/avalanchejs"
import { useWalletStore } from "../../lib/walletStore"
import { bytesToHex } from "viem"
import { getRPCEndpoint } from "../../coreViem/utils/rpc"
import { Input } from "../../components/Input"

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
  const [operationSuccessful, setOperationSuccessful] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [validatorTxId, setValidatorTxId] = useState<string>("")

  // Use nullish coalescing to safely access store values
  const { pChainAddress, coreWalletClient, isTestnet } = useWalletStore()

  // Fetch P-Chain balance
  const fetchPChainBalance = async () => {
    if (coreWalletClient && pChainAddress) {
      try {
        const balance = await coreWalletClient.getPChainBalance()
        const balanceNumber = Number(balance) / 1e9
        setPChainBalance(balanceNumber)
      } catch (error) {
        console.error("Error fetching P-Chain balance:", error)
      }
    }
  }

  // Fetch P-Chain balance periodically
  useEffect(() => {
    if (coreWalletClient && pChainAddress) {
      fetchPChainBalance()
      const interval = setInterval(fetchPChainBalance, 10000)
      return () => clearInterval(interval)
    }
  }, [coreWalletClient, pChainAddress])

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
      const platformEndpoint = getRPCEndpoint(isTestnet ?? false)
      const pvmApi = new pvm.PVMApi(platformEndpoint)
      const context = await Context.getContextFromURI(platformEndpoint)
      const feeState = await pvmApi.getFeeState()

      const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] })
      if (utxos.length === 0) {
        setError('No UTXOs found on your P-chain address. Make sure you have funds.')
        setLoading(false)
        return;
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
        throw new Error("Avalanche wallet extension not found. Please ensure it's installed and enabled.")
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
      } else {
        throw new Error("Unexpected response format from wallet.")
      }

      setShowConfetti(true)
      setOperationSuccessful(true)

      await delay(2000)
      await fetchPChainBalance()

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
    setValidationId("")
    setError(null)
    setOperationSuccessful(false)
    setValidatorTxId("")
  }

  return (
    <Container
      title="L1 Validator Balance Topup"
      description="Increase your validator's balance using funds from your P-Chain address."
    >
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
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Validator ID</span>
                <span className="text-sm font-mono text-blue-700 dark:text-blue-300 truncate max-w-[200px]">{validationId}</span>
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
              <Input
                label="Validation ID"
                id="validationId"
                value={validationId}
                onChange={setValidationId}
                placeholder="Enter the L1 Validator's Validation ID (e.g., validation1...)"
                disabled={loading}
                error={error && error.toLowerCase().includes("validation id") ? error : undefined}
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
                    onClick={loading ? undefined : fetchPChainBalance}
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

            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              <div className="flex gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p>This action will use AVAX from your P-Chain address ({pChainAddress ? `${pChainAddress.substring(0, 10)}...${pChainAddress.substring(pChainAddress.length - 4)}` : 'Loading...'}) to increase the balance of the specified L1 validator. Ensure the Validation ID is correct.</p>
              </div>
            </div>

            {error && !error.toLowerCase().includes("amount") && !error.toLowerCase().includes("balance") && !error.toLowerCase().includes("utxo") && !error.toLowerCase().includes("validation id") && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
                <div className="flex gap-3">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              onClick={increaseValidatorBalance}
              disabled={loading || !validationId || !amount || Number(amount) <= 0 || Number(amount) > pChainBalance}
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
