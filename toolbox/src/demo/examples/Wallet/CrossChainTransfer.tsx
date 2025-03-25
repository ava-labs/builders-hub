"use client"
import { useEffect, useState } from "react"
import { ChevronDown, AlertCircle } from "lucide-react"
import { Button } from "../../../components/button"
import { Input } from "../../../components/input"
import { Container } from "../../../components/container"
import { Select } from "../../ui/Select"
import { Context, pvm, utils, evm } from "@avalabs/avalanchejs"
import { useWalletStore, useViemChainStore } from "../../utils/store"
import { JsonRpcProvider } from "ethers"
import { bytesToHex, Chain, hexToBytes } from "viem"
import { createPublicClient, http } from "viem"

// Instead of declaring the window.avalanche type, we'll use proper client-side checks

export default function CrossChainTransfer() {
  
  const platformEndpoint = "https://api.avax-test.network";

  const [amount, setAmount] = useState<string>("0.0")
  const [sourceChain, setSourceChain] = useState<string>("c-chain")
  const [destinationChain, setDestinationChain] = useState<string>("p-chain")
  const [availableBalance, setAvailableBalance] = useState<number>(0)
  const [publicClient, setPublicClient] = useState<any>(null)
  
  // Use nullish coalescing to safely access store values
  const { pChainAddress = '', walletEVMAddress = '' } = useWalletStore() || {}
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

  useEffect(() => {
    const getAvailableBalance = async () => {
      if (!publicClient || !walletEVMAddress) return
      
      try {
        const availableBalance = await publicClient.getBalance({
          address: walletEVMAddress as `0x${string}`,
        })
        setAvailableBalance(Number(availableBalance) / 1e18)
      } catch (error) {
        console.error("Error fetching balance:", error)
      }
    }
    
    if (publicClient && walletEVMAddress) {
      getAvailableBalance()
    }
  }, [publicClient, walletEVMAddress])

  const handleMaxAmount = () => {
    setAmount(availableBalance.toString())
  }

  // Handler for source chain selection
  const handleSourceChainChange = (value: string | number) => {
    setSourceChain(value.toString())
  }

  // Handler for destination chain selection
  const handleDestinationChainChange = (value: string | number) => {
    setDestinationChain(value.toString())
  }

  // Handler to swap source and destination chains
  const handleSwapChains = () => {
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
    
    console.log("Export initiated with amount:", amount)
    try {
      const provider = new JsonRpcProvider(platformEndpoint + "/ext/bc/C/rpc");
      let evmapi = new evm.EVMApi(platformEndpoint);
      let context = await Context.getContextFromURI(platformEndpoint);
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
      })

      console.log("Export transaction sent:", response);
    } catch (error) {
      console.error("Error sending export transaction:", error);
    }
  }

  const handleImport = async () => {
    if (typeof window === 'undefined' || !walletEVMAddress || !pChainAddress) {
      console.error("Missing required data or not in client environment")
      return
    }
    
    console.log("Import initiated")
    
    try {
      const pvmApi = new pvm.PVMApi(platformEndpoint);
      let { utxos } = await pvmApi.getUTXOs({ sourceChain: 'C', addresses: [pChainAddress] });
      let context = await Context.getContextFromURI(platformEndpoint);

      const importTx = pvm.newImportTx(
        context,
        context.cBlockchainID,
        utxos,
        [hexToBytes(walletEVMAddress as `0x${string}`)],
        [utils.bech32ToBytes(pChainAddress)],
      );

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
          utxos: utxos,
        },
      })
      
      console.log("Import transaction sent:", response);
    } catch (error) {
      console.error("Error sending import transaction:", error);
    }
  }

  // Chain options with icons
  const sourceOptions = [
    {
      value: "c-chain",
      label: "C-Chain",
      icon: (
        <div className="bg-red-500 rounded-full p-1.5 flex items-center justify-center mr-2">
          <span className="text-white font-bold text-xs">A</span>
        </div>
      ),
    },
    // {
    //   value: "p-chain",
    //   label: "P-Chain",
    //   icon: (
    //     <div className="bg-blue-500 rounded-full p-1.5 flex items-center justify-center mr-2">
    //       <span className="text-white font-bold text-xs">A</span>
    //     </div>
    //   ),
    // },
  ]

  const destOptions = [
    {
      value: "p-chain",
      label: "P-Chain",
      icon: (
        <div className="bg-gradient-to-r from-red-500 to-blue-500 rounded-full p-1.5 flex items-center justify-center mr-2">
          <span className="text-white font-bold text-xs">P</span>
        </div>
      ),
    },
    // {
    //   value: "c-chain",
    //   label: "C-Chain",
    //   icon: (
    //     <div className="bg-blue-500 rounded-full p-1.5 flex items-center justify-center mr-2">
    //       <span className="text-white font-bold text-xs">A</span>
    //     </div>
    //   ),
    // },
  ]

  return (
    <Container
      title="Cross Chain Transfer"
      description="Transfer tokens between Avalanche chains securely and efficiently."
    >
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 flex flex-col justify-center space-y-1">
          <div className="rounded-md bg-white dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <Select
              label="Source Chain"
              value={sourceChain}
              onChange={handleSourceChainChange}
              options={sourceOptions}
              className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-center py-0.5">
            <button
              onClick={handleSwapChains}
              className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center bg-white dark:bg-zinc-800 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>
          </div>

          <div className="rounded-md bg-white dark:bg-zinc-900 p-4 border border-zinc-300 dark:border-zinc-700 shadow-sm">
            <Select
              label="Destination Chain"
              value={destinationChain}
              onChange={handleDestinationChainChange}
              options={destOptions}
              className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
            />
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
              >
                Max
              </Button>
            </div>

            <div className="flex justify-between mt-3 text-sm">
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold select-none pointer-events-none">
                Available Balance: {availableBalance.toFixed(3)} AVAX
              </span>
            </div>

            <div className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300 text-sm">
              <div className="flex gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p>You will be prompted to sign 2 separate transactions: one export, followed by one import.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                variant="primary"
                onClick={handleExport}
                className="w-full py-2 px-4 text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
              >
                Step 1 - Export
              </Button>

              <Button
                variant="secondary"
                onClick={handleImport}
                className="w-full py-2 px-4 text-sm font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all duration-200"
              >
                Step 2 - Import
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

