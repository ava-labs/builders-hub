"use client";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Loader2, Copy, CheckCircle2, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { avalancheFuji } from "viem/chains";
import { newPrivateKey } from "../common/utils/wallet";
import { transferCToP, getAddresses } from "./helper";
import { pvm, utils, Context, addTxSignatures } from "@avalabs/avalanchejs";

export default function ValidatorBalanceUI() {
  const [currentStep, setCurrentStep] = useState(1);
  const [tempPrivateKeyHex, setTempPrivateKeyHex] = useState(() => {
    if (typeof window === "undefined") return newPrivateKey();
    const stored = window.localStorage.getItem("temp-private-key");
    if (stored) return stored;
    const newKey = newPrivateKey();
    window.localStorage.setItem("temp-private-key", newKey);
    return newKey;
  });
  const [cChainBalance, setCChainBalance] = useState(BigInt(0));
  const [validationId, setValidationId] = useState(
    "BDP3ifTcrt6qMRS2g7dU7aQVwrYMHe9thJXYm2vJFh8tRVr3p"
  );
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferStep, setTransferStep] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [validatorTxId, setValidatorTxId] = useState("");

  const addresses = tempPrivateKeyHex ? getAddresses(tempPrivateKeyHex) : null;

  useEffect(() => {
    if (!tempPrivateKeyHex) {
      setTempPrivateKeyHex(newPrivateKey());
    }
  }, [tempPrivateKeyHex]);

  useEffect(() => {
    if (!addresses?.C) return;

    const checkCChainBalance = async () => {
      const client = createPublicClient({
        chain: avalancheFuji,
        transport: http(),
      });

      try {
        const balance = await client.getBalance({
          address: addresses.C,
        });
        setCChainBalance(balance);
        if (balance > BigInt(0) && currentStep === 1) {
          setCurrentStep(2);
        }
      } catch (error) {
        console.error("Failed to get C-Chain balance:", error);
      }
    };

    checkCChainBalance();
    const interval = setInterval(checkCChainBalance, 5000);
    return () => clearInterval(interval);
  }, [addresses?.C, currentStep]);

  const handleCopy = () => {
    if (addresses?.C) {
      navigator.clipboard.writeText(addresses.C);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const increaseBalanceTx = async (
    sourcePrivateKey: string,
    validationId: string,
    amount: string
  ) => {
    const pvmApi = new pvm.PVMApi("https://api.avax-test.network");
    const context = await Context.getContextFromURI("https://api.avax-test.network");
    const addresses = getAddresses(sourcePrivateKey);
    const feeState = await pvmApi.getFeeState();

    const { utxos } = await pvmApi.getUTXOs({ addresses: [addresses.P] });
    if (utxos.length === 0) {
      throw new Error("No UTXOs found for P-chain transfer");
    }

    const amountNAvax = BigInt(Math.floor(Number(amount) * 1e9));

    const unsignedTx = pvm.e.newIncreaseL1ValidatorBalanceTx(
      {
        balance: amountNAvax,
        feeState,
        fromAddressesBytes: [utils.bech32ToBytes(addresses.P)],
        utxos,
        validationId,
      },
      context
    );

    await addTxSignatures({
      unsignedTx,
      privateKeys: [utils.hexToBuffer(sourcePrivateKey)],
    });

    return pvmApi.issueSignedTx(unsignedTx.getSignedTx());
  };

  const handleCToPTransfer = async () => {
    if (!tempPrivateKeyHex || !validationId || !transferAmount) return;

    setTransferError(null);
    setTransferring(true);
    setTransferStep("Initiating C to P transfer...");
    setValidatorTxId("");

    try {
      await transferCToP(transferAmount, tempPrivateKeyHex, async (balance: string) => {
        try {
          setTransferStep("Waiting for chain confirmation...");
          await new Promise((resolve) => setTimeout(resolve, 2000));

          setTransferStep("Increasing validator balance...");
          const tx = await increaseBalanceTx(tempPrivateKeyHex, validationId, transferAmount);

          if (tx?.txID) {
            setValidatorTxId(tx.txID);
          }

          setShowConfetti(true);
          setCurrentStep(3);
        } catch (error) {
          console.error("Validator balance increase failed:", error);
          throw new Error(
            error instanceof Error ? error.message : "Failed to increase validator balance"
          );
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete transfer";
      setTransferError(errorMessage);
    } finally {
      setTransferring(false);
      setTransferStep("");
    }
  };

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  return (
    <div
      className={cn(
        "w-full max-w-[600px]",
        "rounded-2xl",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "shadow-lg",
        "overflow-hidden",
        "mx-auto",
        "my-8"
      )}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Increase Validator Balance
          </h3>
        </div>

        <div className={cn("space-y-4", currentStep !== 1 && "opacity-50")}>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">
              1
            </div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
              Fund Temporary C-Chain Address
            </h4>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                Address
              </span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                Balance: {formatEther(cChainBalance)} AVAX
              </span>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 rounded p-3">
              <code className="font-mono text-sm text-indigo-600 dark:text-indigo-400 flex-1">
                {addresses?.C}
              </code>
              <div className="flex items-center gap-2">
                <code className="text-xs text-indigo-400 dark:text-indigo-500">
                  {copied ? "Copied!" : ""}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                  title="Copy address"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("space-y-4", currentStep !== 2 && "opacity-50")}>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">
              2
            </div>
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Enter Transfer Details</h4>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="validationId"
              >
                Validation ID
              </label>
              <input
                id="validationId"
                type="text"
                value={validationId}
                onChange={(e) => setValidationId(e.target.value)}
                className="mt-1 block w-full font-mono text-sm rounded-md border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-3"
                placeholder="Enter validation ID"
                disabled={currentStep !== 2}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                htmlFor="transferAmount"
              >
                Amount to Transfer (AVAX)
              </label>
              <div className="relative">
                <input
                  id="transferAmount"
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  step="0.0001"
                  min="0"
                  className="mt-1 block w-full rounded-md border-zinc-300 dark:border-zinc-700 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.000"
                  disabled={currentStep !== 2}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400 pointer-events-none">
                  AVAX
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCToPTransfer}
            disabled={
              transferring ||
              !validationId ||
              !transferAmount ||
              Number(transferAmount) <= 0 ||
              Number(formatEther(cChainBalance)) < Number(transferAmount) ||
              currentStep !== 2
            }
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm font-medium",
              "bg-indigo-600 text-white",
              "hover:bg-indigo-700",
              "transition-colors duration-300",
              "flex items-center justify-center gap-2",
              "disabled:bg-zinc-400 disabled:cursor-not-allowed"
            )}
          >
            {transferring ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {transferStep || "Transferring..."}
              </>
            ) : (
              <>
                Transfer {transferAmount || "0"} AVAX to Validator
                <ArrowUpRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {currentStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h4 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Transfer Complete!
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You've successfully increased your validator balance.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Amount
                </span>
                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                  {transferAmount} AVAX
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Validator ID
                </span>
                <span className="text-sm font-mono text-green-700 dark:text-green-300">
                  {validationId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Status
                </span>
                <span className="text-sm font-bold text-green-700 dark:text-green-300">
                  Confirmed
                </span>
              </div>
              {validatorTxId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Transaction
                  </span>
                  <a
                    href={`https://subnets-test.avax.network/p-chain/tx/${validatorTxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                  >
                    View in Explorer
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setCurrentStep(1);
                setTransferAmount("");
                setCChainBalance(BigInt(0));
                setValidatorTxId("");
              }}
              className={cn(
                "w-full px-4 py-2 rounded-xl text-sm font-medium",
                "bg-indigo-600 text-white",
                "hover:bg-indigo-700",
                "transition-colors duration-300",
                "flex items-center justify-center gap-2"
              )}
            >
              Make Another Transfer
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {transferError && !transferError.includes("success") && (
          <p className="text-sm text-red-500">{transferError}</p>
        )}
      </div>

      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-4 h-4 bg-yellow-500 rounded-full animate-confetti-1"></div>
          <div className="absolute top-0 left-1/2 w-4 h-4 bg-green-500 rounded-full animate-confetti-2"></div>
          <div className="absolute top-0 right-1/4 w-4 h-4 bg-pink-500 rounded-full animate-confetti-3"></div>
        </div>
      )}
    </div>
  );
}
