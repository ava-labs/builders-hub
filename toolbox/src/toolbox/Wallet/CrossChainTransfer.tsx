"use client"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "../../components/Button"
import { Input } from "../../components/Input"
import { Container } from "../components/Container"
import { Context, pvm, utils, evm, TransferableOutput } from "@avalabs/avalanchejs"
import { useWalletStore } from "../../lib/walletStore"
import { JsonRpcProvider } from "ethers"
import { bytesToHex } from "viem"

import { useErrorBoundary } from "react-error-boundary"
import { RequireChain } from "../../components/RequireChain"
import { avalancheFuji } from "viem/chains"

// Define the type for window.avalanche response
interface AvalancheResponse {
  txID?: string;
  [key: string]: any;
}

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function CrossChainTransfer({
  suggestedAmount = "0.0",
  onAmountChange,
  onTransferComplete
}: {
  suggestedAmount?: string;
  onAmountChange?: (amount: string) => void;
  onTransferComplete?: () => void;
} = {}) {

  const platformEndpoint = "https://api.avax-test.network";

  const [amount, setAmount] = useState<string>(suggestedAmount)
  const [sourceChain, setSourceChain] = useState<string>("c-chain")
  const [destinationChain, setDestinationChain] = useState<string>("p-chain")
  const [availableBalance, setAvailableBalance] = useState<number>(0)
  const [pChainAvailableBalance, setPChainAvailableBalance] = useState<number>(0)
  const [exportLoading, setExportLoading] = useState<boolean>(false)
  const [importLoading, setImportLoading] = useState<boolean>(false)
  const [exportTxId, setExportTxId] = useState<string>("")
  const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const { showBoundary } = useErrorBoundary()

  const { pChainAddress, walletEVMAddress, coreWalletClient, publicClient } = useWalletStore()

  // Function to fetch balances from both chains
  const fetchBalances = async () => {
    if (publicClient && walletEVMAddress) {
      publicClient.getBalance({
        address: walletEVMAddress as `0x${string}`,
      }).then((balance: bigint) => {
        setAvailableBalance(Number(balance) / 1e18)
      }).catch(showBoundary)
    }

    if (coreWalletClient && pChainAddress) {
      coreWalletClient.getPChainBalance().then((balance: bigint) => {
        setPChainAvailableBalance(Number(balance) / 1e9)
      }).catch(showBoundary)
    }
  }

  useEffect(() => {
    if (publicClient && walletEVMAddress) {
      fetchBalances()
    }
  }, [publicClient, walletEVMAddress, pChainAddress])

  // Effect to handle automatic import after export
  useEffect(() => {
    if (exportTxId) {
      const startImport = async () => {
        // Show waiting message
        setWaitingForConfirmation(true);
        // Wait for 5 seconds to ensure the export transaction has time to confirm
        await delay(5000);
        setWaitingForConfirmation(false);
        handleImport();
      };
      startImport();
    }
  }, [exportTxId]);

  const handleMaxAmount = () => {
    if (sourceChain === "c-chain") {
      setAmount(availableBalance.toString())
    } else {
      setAmount(pChainAvailableBalance.toString())
    }
    // Update the step to 2 when MAX is clicked
    setCurrentStep(2);
  }

  // Handler to swap source and destination chains
  const handleSwapChains = () => {
    // Remove temporary restriction on P→C transfers
    const tempChain = sourceChain
    setSourceChain(destinationChain)
    setDestinationChain(tempChain)
  }

  // Handle amount change with step update
  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount);
    onAmountChange?.(newAmount);

    // If amount is valid, move to step 3
    if (Number(newAmount) > 0) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  }

  // Add handlers for buttons
  const handleExport = async () => {
    if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress) {
      console.error("Missing required data or not in client environment")
      return
    }

    setCurrentStep(3); // Move to step 3 when export is initiated
    setExportLoading(true);
    console.log("Export initiated with amount:", amount, "from", sourceChain, "to", destinationChain)

    try {
      // Get context for chain operations
      const context = await Context.getContextFromURI(platformEndpoint);

      if (sourceChain === "c-chain") {
        // C-Chain to P-Chain export
        const provider = new JsonRpcProvider(platformEndpoint + "/ext/bc/C/rpc");
        let evmapi = new evm.EVMApi(platformEndpoint);
        const baseFee = await evmapi.getBaseFee();
        const txCount = await provider.getTransactionCount(walletEVMAddress);

        console.log(walletEVMAddress)
        console.log(pChainAddress)
        const tx = evm.newExportTx(
          context,
          BigInt(Math.round(Number(amount) * 1e9)),
          context.pBlockchainID,
          utils.hexToBuffer(walletEVMAddress),
          [utils.bech32ToBytes(pChainAddress)],
          baseFee,
          BigInt(txCount),
        )

        const txBytes = tx.toBytes()
        const txHex = bytesToHex(txBytes)
        console.log("Export transaction created:", txHex);

        // Safely access window.avalanche using optional chaining
        if (!window.avalanche) {
          throw new Error("Avalanche wallet extension not found")
        }

        const response = await window.avalanche.request({
          method: "avalanche_sendTransaction",
          params: {
            transactionHex: txHex,
            chainAlias: "C",
          },
        }) as AvalancheResponse;

        console.log("Export transaction sent:", response);
        // Store the export transaction ID to trigger import
        setExportTxId(response.txID || String(response));
      } else {
        // P-Chain to C-Chain export
        const pvmApi = new pvm.PVMApi(platformEndpoint);
        const utxoResponse = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
        const utxos = utxoResponse.utxos;

        const corethAddress = await coreWalletClient?.getCorethAddress()

        // Create the P-Chain export transaction
        const exportTx = pvm.newExportTx(
          context,
          context.cBlockchainID,
          [utils.bech32ToBytes(pChainAddress)],
          utxos,
          [
            TransferableOutput.fromNative(
              context.avaxAssetID,
              BigInt(Math.round(Number(amount) * 1e9)),
              [utils.bech32ToBytes(corethAddress)],
            ),
          ]
        );

        const txBytes = exportTx.toBytes();
        const txHex = bytesToHex(txBytes);
        console.log("P-Chain Export transaction created:", txHex);

        if (!window.avalanche) {
          throw new Error("Avalanche wallet extension not found")
        }

        const response = await window.avalanche.request({
          method: "avalanche_sendTransaction",
          params: {
            transactionHex: txHex,
            chainAlias: "P",
          },
        }) as AvalancheResponse;

        console.log("P-Chain Export transaction sent:", response);
        setExportTxId(response.txID || String(response));
      }
    } catch (error) {
      console.error("Error sending export transaction:", error);
    } finally {
      setExportLoading(false);
    }
  }

  const handleImport = async () => {
    if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress) {
      console.error("Missing required data or not in client environment")
      return
    }

    setImportLoading(true);
    console.log("Import initiated from", sourceChain, "to", destinationChain)

    try {
      const context = await Context.getContextFromURI(platformEndpoint);

      if (destinationChain === "p-chain") {
        // Import to P-Chain
        const pvmApi = new pvm.PVMApi(platformEndpoint);
        const { utxos } = await pvmApi.getUTXOs({ sourceChain: 'C', addresses: [pChainAddress] });

        const importTx = pvm.newImportTx(
          context,
          context.cBlockchainID,
          utxos,
          [utils.bech32ToBytes(pChainAddress)],
          [utils.bech32ToBytes(pChainAddress)],
        );
        console.log(importTx)

        const importTxBytes = importTx.toBytes()
        const importTxHex = bytesToHex(importTxBytes)
        console.log("Import transaction created:", importTxHex);

        // Safely access window.avalanche using optional chaining
        if (!window.avalanche) {
          throw new Error("Avalanche wallet extension not found")
        }

        console.log("submitting import transaction")
        const response = await window.avalanche.request({
          method: "avalanche_sendTransaction",
          params: {
            transactionHex: importTxHex,
            chainAlias: "P",
            utxos: utxos
          },
        });

        console.log("Import transaction sent:", response);
      } else {
        // Import to C-Chain
        const evmApi = new evm.EVMApi(platformEndpoint);
        const baseFee = await evmApi.getBaseFee();
        // Get UTXOs from the P chain that can be imported
        const corethAddress = await coreWalletClient?.getCorethAddress()
        console.log(corethAddress)


        const { utxos } = await evmApi.getUTXOs({
          sourceChain: 'P',
          addresses: [corethAddress]
        });

        console.log(utxos)

        // Create the C-Chain import transaction
        const importTx = evm.newImportTx(
          context,
          utils.hexToBuffer(walletEVMAddress),
          [utils.bech32ToBytes(corethAddress)],
          utxos,
          context.pBlockchainID,
          baseFee,
        );

        const importTxBytes = importTx.toBytes();
        const importTxHex = bytesToHex(importTxBytes);
        console.log("C-Chain Import transaction created:", importTxHex);

        if (!window.avalanche) {
          throw new Error("Avalanche wallet extension not found")
        }

        const response = await window.avalanche.request({
          method: "avalanche_sendTransaction",
          params: {
            transactionHex: importTxHex,
            chainAlias: "C",
            utxos: utxos
          },
        });

        console.log("C-Chain Import transaction sent:", response);
      }

      // Add a short delay to ensure transaction is processed before refreshing balances
      await delay(2000);

      // Refresh balances multiple times after import to catch updates
      // Sometimes the balance update takes a moment to propagate
      const refreshIntervals = [2000, 4000, 8000];

      // Schedule multiple refreshes
      for (const interval of refreshIntervals) {
        setTimeout(async () => {
          try {
            await fetchBalances();
            console.log(`Refreshed balances after ${interval}ms`);
          } catch (error) {
            console.error(`Error refreshing balances after ${interval}ms:`, error);
          }
        }, interval);
      }

      onTransferComplete?.();
    } catch (error) {
      console.error("Error sending import transaction:", error);
    } finally {
      setImportLoading(false);
      // Clear export transaction ID after import is done
      setExportTxId("");
    }
  }

  return (
    <Container
      title="Cross Chain Transfer"
      description="Move your AVAX tokens between the C-Chain (EVM) and P-Chain (Platform chain)."
    >
      <RequireChain chain={avalancheFuji}>
        <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
          {/* Step Indicator */}
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${currentStep >= 1 ? 'bg-red-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'} flex items-center justify-center font-semibold transition-colors duration-200`}>1</div>
              <span className={`text-xs mt-1 ${currentStep >= 1 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}>Select Chains</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 2 ? 'bg-red-300 dark:bg-red-700' : 'bg-zinc-200 dark:bg-zinc-700'} transition-colors duration-200`}></div>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${currentStep >= 2 ? 'bg-red-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'} flex items-center justify-center font-semibold transition-colors duration-200`}>2</div>
              <span className={`text-xs mt-1 ${currentStep >= 2 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}>Enter Amount</span>
            </div>
            <div className={`flex-1 h-1 mx-2 ${currentStep >= 3 ? 'bg-red-300 dark:bg-red-700' : 'bg-zinc-200 dark:bg-zinc-700'} transition-colors duration-200`}></div>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${currentStep >= 3 ? 'bg-red-500 text-white' : 'bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'} flex items-center justify-center font-semibold transition-colors duration-200`}>3</div>
              <span className={`text-xs mt-1 ${currentStep >= 3 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-zinc-600 dark:text-zinc-400'}`}>Confirm Transfer</span>
            </div>
          </div>

          {/* Chain Selection Section */}
          <div className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="col-span-12 mb-2">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Select Chains</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Choose which chain to transfer from and to</p>
            </div>

            {/* Source Chain */}
            <div className="col-span-5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4 border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">From</span>
                <div className="flex items-center">
                  {sourceChain === "c-chain" ? (
                    <>
                      <div className="bg-red-500 rounded-full p-3 flex items-center justify-center mr-3 w-10 h-10 shadow-sm">
                        <span className="text-white font-bold text-base">C</span>
                      </div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">C-Chain</span>
                    </>
                  ) : (
                    <>
                      <div className="bg-gradient-to-r from-red-500 to-blue-500 rounded-full p-3 flex items-center justify-center mr-3 w-10 h-10 shadow-sm">
                        <span className="text-white font-bold text-base">P</span>
                      </div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">P-Chain</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  {sourceChain === "c-chain"
                    ? "EVM-compatible chain for smart contracts"
                    : "Native chain for staking & validators"}
                </div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {sourceChain === "c-chain"
                    ? `${availableBalance.toFixed(4)} AVAX`
                    : `${pChainAvailableBalance.toFixed(4)} AVAX`}
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <div className="col-span-2 flex justify-center relative">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-0.5 bg-zinc-200 dark:bg-zinc-700"></div>
              <button
                onClick={handleSwapChains}
                className="w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-white dark:bg-zinc-900 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 cursor-pointer hover:shadow-md z-10 group relative"
                aria-label="Swap source and destination chains"
              >
                <div className="relative flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-zinc-400 group-hover:text-red-500 transition-all duration-300 group-hover:scale-110 transform rotate-90"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 16L12 21L17 16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="group-hover:translate-y-0.5 transition-transform duration-300"
                    />
                    <path
                      d="M17 8L12 3L7 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="group-hover:-translate-y-0.5 transition-transform duration-300"
                    />
                    <path
                      d="M12 3V21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="group-hover:scale-y-110 origin-center transition-transform duration-300"
                    />
                  </svg>
                </div>
                <div className="absolute inset-0 rounded-full border border-transparent group-hover:border-red-500/30 group-hover:scale-110 transition-all duration-300"></div>
              </button>
            </div>

            {/* Destination Chain */}
            <div className="col-span-5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4 border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex flex-col items-center space-y-2">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">To</span>
                <div className="flex items-center">
                  {destinationChain === "c-chain" ? (
                    <>
                      <div className="bg-red-500 rounded-full p-3 flex items-center justify-center mr-3 w-10 h-10 shadow-sm">
                        <span className="text-white font-bold text-base">C</span>
                      </div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">C-Chain</span>
                    </>
                  ) : (
                    <>
                      <div className="bg-gradient-to-r from-red-500 to-blue-500 rounded-full p-3 flex items-center justify-center mr-3 w-10 h-10 shadow-sm">
                        <span className="text-white font-bold text-base">P</span>
                      </div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">P-Chain</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  {destinationChain === "c-chain"
                    ? "EVM-compatible chain for smart contracts"
                    : "Native chain for staking & validators"}
                </div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {destinationChain === "c-chain"
                    ? `${availableBalance.toFixed(4)} AVAX`
                    : `${pChainAvailableBalance.toFixed(4)} AVAX`}
                </div>
              </div>
            </div>
          </div>

          {/* Transfer Amount Section */}
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Transfer Amount</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Specify how much AVAX to transfer between chains</p>
                <div className="relative mt-2">
                  <Input
                    type="text"
                    value={amount}
                    onChange={(newAmount) => {
                      handleAmountChange(newAmount);
                    }}
                    className="w-full px-4 py-3 h-14 text-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 pr-20 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 transition-all duration-200"
                    label=""
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                    <span className="mr-2 text-zinc-500 dark:text-zinc-400">AVAX</span>
                    <Button
                      variant="secondary"
                      className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-zinc-100 dark:bg-zinc-800 h-9 px-2 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      onClick={handleMaxAmount}
                      disabled={false}
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>

              {/* Information Box */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">About Cross-Chain Transfers</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 pl-5 list-disc">
                  <li>Transfers require two transactions: an export from the source chain and an import to the destination chain</li>
                  <li>Import will automatically start after export is confirmed</li>
                  <li>Transfer times vary but typically take 15-30 seconds to complete</li>
                  <li>Small network fees apply to each transaction</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  variant="primary"
                  onClick={handleExport}
                  disabled={exportLoading || importLoading || waitingForConfirmation || Number(amount) <= 0}
                  className="w-full py-3 px-4 text-base font-medium text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Exporting from {sourceChain === "c-chain" ? "C-Chain" : "P-Chain"}...
                    </span>
                  ) : `Transfer ${Number(amount) > 0 ? amount : "0"} AVAX ${sourceChain === "c-chain" ? "C→P" : "P→C"}`}
                </Button>

                {waitingForConfirmation && (
                  <div className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <Loader2 className="h-5 w-5 mr-3 animate-spin text-yellow-500" />
                    <div>
                      <span className="text-yellow-700 dark:text-yellow-300 text-sm font-medium">Export Successful!</span>
                      <span className="text-yellow-600 dark:text-yellow-400 text-xs block">Waiting for confirmation before import...</span>
                    </div>
                  </div>
                )}

                {importLoading && (
                  <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Loader2 className="h-5 w-5 mr-3 animate-spin text-blue-500" />
                    <div>
                      <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Importing to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}...</span>
                      <span className="text-blue-600 dark:text-blue-400 text-xs block">Finalizing your transfer</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </RequireChain>
    </Container>
  )
}

