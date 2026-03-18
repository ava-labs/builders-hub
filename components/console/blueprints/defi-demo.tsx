"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, Shield, Clock, Zap, ArrowDownUp } from "lucide-react";

type TransactionState =
  | "idle"
  | "submitted"
  | "ordering"
  | "included"
  | "finalized";

interface TransactionStep {
  id: TransactionState;
  label: string;
  description: string;
  timing: number; // ms from start
}

const TRANSACTION_STEPS: TransactionStep[] = [
  {
    id: "submitted",
    label: "Tx Submitted",
    description: "Transaction sent to mempool",
    timing: 0,
  },
  {
    id: "ordering",
    label: "Fair Ordering",
    description: "No frontrunning possible",
    timing: 50,
  },
  {
    id: "included",
    label: "Block Inclusion",
    description: "Transaction in block",
    timing: 200,
  },
  {
    id: "finalized",
    label: "Finality",
    description: "Atomic settlement complete",
    timing: 300,
  },
];

// Random jitter to simulate realistic timing
function addJitter(base: number, percent: number = 15): number {
  const variance = base * (percent / 100);
  return Math.round(base + (Math.random() * variance * 2 - variance));
}

export function DefiDemo() {
  const [txState, setTxState] = useState<TransactionState>("idle");
  const [fromAmount, setFromAmount] = useState("100");
  const [toAmount, setToAmount] = useState("2,450.00");
  const [stepTimings, setStepTimings] = useState<Record<string, number>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [completedSwaps, setCompletedSwaps] = useState(0);
  const [tpsCounter, setTpsCounter] = useState(14892);

  // Simulate TPS counter in background
  useEffect(() => {
    const interval = setInterval(() => {
      setTpsCounter((prev) => {
        const change = Math.floor(Math.random() * 200) - 100;
        return Math.max(13000, Math.min(16000, prev + change));
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const executeSwap = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    setTxState("idle");
    setStepTimings({});

    const startTime = Date.now();

    // Animate through each step with realistic timing
    TRANSACTION_STEPS.forEach((step, idx) => {
      const delay = addJitter(step.timing);
      setTimeout(() => {
        setTxState(step.id);
        setStepTimings((prev) => ({
          ...prev,
          [step.id]: Date.now() - startTime,
        }));

        // Final step
        if (idx === TRANSACTION_STEPS.length - 1) {
          setTimeout(() => {
            setCompletedSwaps((prev) => prev + 1);
            setIsAnimating(false);
          }, 500);
        }
      }, delay);
    });
  }, [isAnimating]);

  const getStepStatus = (stepId: TransactionState) => {
    const stepIndex = TRANSACTION_STEPS.findIndex((s) => s.id === stepId);
    const currentIndex = TRANSACTION_STEPS.findIndex((s) => s.id === txState);

    if (txState === "idle") return "pending";
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  // Calculate simulated output based on input
  useEffect(() => {
    const inputNum = parseFloat(fromAmount) || 0;
    // Simulate AVAX -> USDC at ~$24.50 with 0.02% slippage
    const rate = 24.5 * (1 - 0.0002);
    const output = (inputNum * rate).toFixed(2);
    setToAmount(output.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  }, [fromAmount]);

  return (
    <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Try a Simulated Swap
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Experience sub-second finality with MEV protection. Watch the transaction lifecycle in real-time.
        </p>
      </div>

      {/* Swap Interface */}
      <div className="max-w-sm mx-auto mb-6">
        {/* From Token */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 mb-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>From</span>
            <span>Balance: 1,000.00</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              disabled={isAnimating}
              placeholder="0.0"
              className="flex-1 bg-transparent text-xl text-zinc-900 dark:text-zinc-100 font-mono outline-none placeholder-zinc-300 dark:placeholder-zinc-600 disabled:opacity-50"
            />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-red-600" />
              <span className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">
                AVAX
              </span>
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center -my-2 relative z-10">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
            <ArrowDownUp className="w-4 h-4 text-zinc-500" />
          </div>
        </div>

        {/* To Token */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>To</span>
            <span>Balance: 0.00</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-xl text-zinc-900 dark:text-zinc-100 font-mono">
              {txState === "finalized" ? toAmount : "~" + toAmount}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
              <span className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">
                USDC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Execute Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={executeSwap}
          disabled={isAnimating || !fromAmount || parseFloat(fromAmount) <= 0}
          className={cn(
            "px-6 py-3 rounded-xl font-medium text-white transition-all",
            isAnimating
              ? "bg-violet-400 cursor-not-allowed"
              : "bg-violet-500 hover:bg-violet-600 active:scale-[0.98]",
            (!fromAmount || parseFloat(fromAmount) <= 0) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isAnimating ? "Processing..." : "Execute Swap"}
        </button>
      </div>

      {/* Transaction Lifecycle */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
          Transaction Lifecycle
        </h3>

        {/* Progress Bar */}
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mb-4 overflow-hidden">
          <div
            className={cn(
              "h-full bg-violet-500 rounded-full transition-all duration-300",
              txState === "idle" && "w-0",
              txState === "submitted" && "w-1/4",
              txState === "ordering" && "w-2/4",
              txState === "included" && "w-3/4",
              txState === "finalized" && "w-full bg-green-500"
            )}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {TRANSACTION_STEPS.map((step, idx) => {
            const status = getStepStatus(step.id);
            const timing = stepTimings[step.id];

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 transition-all duration-300",
                  status === "pending" && "opacity-40"
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                    status === "complete" && "bg-green-500 text-white",
                    status === "active" && "bg-violet-500 text-white animate-pulse",
                    status === "pending" && "bg-zinc-200 dark:bg-zinc-700 text-zinc-400"
                  )}
                >
                  {status === "complete" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs font-medium">{idx + 1}</span>
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        status === "complete" && "text-green-600 dark:text-green-400",
                        status === "active" && "text-violet-600 dark:text-violet-400",
                        status === "pending" && "text-zinc-500"
                      )}
                    >
                      {step.label}
                    </span>
                    {timing !== undefined && (
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {timing}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {step.description}
                    {step.id === "ordering" && status !== "pending" && (
                      <span className="text-green-600 dark:text-green-400 ml-1">
                        (no frontrunning)
                      </span>
                    )}
                  </p>
                </div>

                {/* Step icon */}
                {step.id === "ordering" && (
                  <Shield
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      status === "complete"
                        ? "text-green-500"
                        : status === "active"
                        ? "text-violet-500"
                        : "text-zinc-400"
                    )}
                  />
                )}
                {step.id === "finalized" && (
                  <Zap
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      status === "complete"
                        ? "text-green-500"
                        : status === "active"
                        ? "text-violet-500"
                        : "text-zinc-400"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Results */}
        {txState === "finalized" && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  MEV Extracted
                </div>
                <div className="text-lg font-medium text-green-600 dark:text-green-400">
                  $0.00
                </div>
                <div className="text-xs text-zinc-400">(protected)</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  Slippage
                </div>
                <div className="text-lg font-medium text-green-600 dark:text-green-400">
                  0.02%
                </div>
                <div className="text-xs text-zinc-400">(within tolerance)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">~0.3s</span>
          finality
        </span>
        <span className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">0%</span>
          MEV loss
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
            {tpsCounter.toLocaleString()}
          </span>
          TPS
        </span>
      </div>

      {/* Completed swaps counter */}
      {completedSwaps > 0 && (
        <div className="text-center mt-4 text-xs text-zinc-400">
          {completedSwaps} swap{completedSwaps > 1 ? "s" : ""} simulated this session
        </div>
      )}
    </div>
  );
}

export default DefiDemo;
