"use client"
import { useEffect, useState } from "react"
import { ChevronDown, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "../../components/Button"
import { Input } from "../../components/Input"
import { Container } from "../../components/Container"
import { Context, pvm, utils, evm, TransferableOutput } from "@avalabs/avalanchejs"
import { useWalletStore } from "../../stores/walletStore"
import { useViemChainStore } from "../../stores/toolboxStore"
import { JsonRpcProvider } from "ethers"
import { bytesToHex, Chain } from "viem"
import { createPublicClient, http } from "viem"

// Define the type for window.avalanche response
interface AvalancheResponse {
  txID?: string;
  [key: string]: any;
}

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function CrossChainTransfer() {

  const platformEndpoint = "https://api.avax-test.network";

  const [amount, setAmount] = useState<string>("0.0")
  const [sourceChain, setSourceChain] = useState<string>("c-chain")
  const [destinationChain, setDestinationChain] = useState<string>("p-chain")
  const [availableBalance, setAvailableBalance] = useState<number>(0)
  const [pChainAvailableBalance, setPChainAvailableBalance] = useState<number>(0)
  const [publicClient, setPublicClient] = useState<any>(null)
  const [exportLoading, setExportLoading] = useState<boolean>(false)
  const [importLoading, setImportLoading] = useState<boolean>(false)
  const [exportTxId, setExportTxId] = useState<string>("")
  const [waitingForConfirmation, setWaitingForConfirmation] = useState<boolean>(false)

  // Use nullish coalescing to safely access store values
  const { pChainAddress = '', walletEVMAddress = '', coreWalletClient = null } = useWalletStore() || {}
  const chain = useViemChainStore()

  // Initialize the client on the client-side only
  useEffect(() => {
    if (typeof window !== 'undefined' && chain) {
      const client = createPublicClient({
        chain: chain as Chain,
        transport: http(),
      })
      setPublicClient(client)
    }
  }, [chain])

  // Function to fetch balances from both chains
  const fetchBalances = async () => {
    if (!publicClient || !walletEVMAddress) return

    // Fetch C-Chain balance
    try {
      const availableBalance = await publicClient.getBalance({
        address: walletEVMAddress as `0x${string}`,
      })
      setAvailableBalance(Number(availableBalance) / 1e18)
    } catch (error) {
      console.error("Error fetching EVM balance:", error)
    }

    // Fetch P-Chain balance
    if (pChainAddress) {
      try {
        const pvmApi = new pvm.PVMApi(platformEndpoint);
        const balance = await pvmApi.getBalance({
          addresses: [pChainAddress],
        })
        console.log(balance)
        setPChainAvailableBalance(Number(balance.balance) / 1e9)
      } catch (error) {
        console.error("Error fetching P-Chain balance:", error)
      }
    }
  }

  // Initial balance fetching
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
    setAmount(availableBalance.toString())
  }

  // Handler to swap source and destination chains
  const handleSwapChains = () => {
    // Remove temporary restriction on P→C transfers
    const tempChain = sourceChain
    setSourceChain(destinationChain)
    setDestinationChain(tempChain)
  }

  // Add handlers for buttons
  const handleExport = async () => {
    if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress) {
      console.error("Missing required data or not in client environment")
      return
    }

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
      // Refresh balances after import completes
      await fetchBalances();
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
      description="Transfer tokens between Avalanche chains securely and efficiently."
    >
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 flex flex-col justify-center space-y-1">
          <div className="rounded-md bg-white dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Source Chain</span>
              <div className="flex items-center">
                {sourceChain === "c-chain" ? (
                  <>
                    <div className="bg-red-500 rounded-full p-1.5 flex items-center justify-center mr-2">
                      <span className="text-white font-bold text-xs">C</span>
                    </div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">C-Chain</span>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-red-500 to-blue-500 rounded-full p-1.5 flex items-center justify-center mr-2">
                      <span className="text-white font-bold text-xs">P</span>
                    </div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">P-Chain</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center py-0.5">
            <button
              onClick={handleSwapChains}
              className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-white dark:bg-zinc-800 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Swap chains"
            >
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </button>
          </div>

          <div className="rounded-md bg-white dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Destination Chain</span>
              <div className="flex items-center">
                {destinationChain === "c-chain" ? (
                  <>
                    <div className="bg-red-500 rounded-full p-1.5 flex items-center justify-center mr-2">
                      <span className="text-white font-bold text-xs">C</span>
                    </div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">C-Chain</span>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-red-500 to-blue-500 rounded-full p-1.5 flex items-center justify-center mr-2">
                      <span className="text-white font-bold text-xs">P</span>
                    </div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">P-Chain</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="rounded-md bg-white dark:bg-zinc-900 p-6 border border-zinc-300 dark:border-zinc-700 h-full shadow-sm">
            <h2 className="text-xl font-medium mb-4 text-zinc-900 dark:text-zinc-100">Transfer Amount</h2>

            <div className="relative">
              <Input
                type="text"
                value={amount}
                onChange={setAmount}
                className="w-full px-3 py-2 h-12 text-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-zinc-900 dark:text-zinc-100 pr-16 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
                label=""
              />
              <Button
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 bg-transparent h-8 w-12 p-0"
                onClick={handleMaxAmount}
                disabled={sourceChain !== "c-chain"}
              >
                Max
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <span className="text-zinc-700 dark:text-zinc-300">C-Chain</span>
                </div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {availableBalance.toFixed(4)} <span className="text-red-500 dark:text-red-400">AVAX</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <span className="text-zinc-700 dark:text-zinc-300">P-Chain</span>
                </div>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {pChainAvailableBalance.toFixed(4)} <span className="text-blue-500 dark:text-blue-400">AVAX</span>
                </span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              <div className="flex gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p>You'll need to sign two transactions (export and import). The import will automatically trigger after export.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                variant="primary"
                onClick={handleExport}
                disabled={exportLoading || importLoading || waitingForConfirmation}
                className="w-full py-2 px-4 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {exportLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </span>
                ) : `Transfer ${sourceChain === "c-chain" ? "C→P" : "P→C"}`}
              </Button>

              {waitingForConfirmation && (
                <div className="flex items-center justify-center p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-yellow-500" />
                  <span className="text-yellow-700 dark:text-yellow-300 text-sm">Waiting for export confirmation...</span>
                </div>
              )}

              {importLoading && (
                <div className="flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-500" />
                  <span className="text-blue-700 dark:text-blue-300 text-sm">Importing to {destinationChain === "p-chain" ? "P-Chain" : "C-Chain"}...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

