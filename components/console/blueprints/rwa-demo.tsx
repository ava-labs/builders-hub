"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Wallet,
  UserCheck,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  FileText,
} from "lucide-react";

type DemoStep = "connect" | "verify" | "approve" | "access";
type TransactionResult = "pending" | "success" | "failed";

interface DemoWallet {
  address: string;
  isVerified: boolean;
}

const COUNTRIES = [
  { code: "US", name: "United States", restricted: false },
  { code: "GB", name: "United Kingdom", restricted: false },
  { code: "DE", name: "Germany", restricted: false },
  { code: "JP", name: "Japan", restricted: false },
  { code: "SG", name: "Singapore", restricted: false },
  { code: "KP", name: "North Korea", restricted: true },
  { code: "IR", name: "Iran", restricted: true },
];

// Generate a random demo wallet address
function generateAddress(): string {
  const chars = "0123456789abcdef";
  let address = "0x";
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

export function RwaDemo() {
  const [currentStep, setCurrentStep] = useState<DemoStep>("connect");
  const [wallet, setWallet] = useState<DemoWallet | null>(null);
  const [kycName, setKycName] = useState("");
  const [kycCountry, setKycCountry] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [txResult, setTxResult] = useState<TransactionResult>("pending");
  const [auditTrail, setAuditTrail] = useState<
    Array<{ action: string; timestamp: string; txHash?: string }>
  >([]);

  const steps: Array<{ id: DemoStep; label: string; icon: React.ReactNode }> = [
    { id: "connect", label: "Connect", icon: <Wallet className="w-4 h-4" /> },
    { id: "verify", label: "Verify", icon: <UserCheck className="w-4 h-4" /> },
    { id: "approve", label: "Approve", icon: <Shield className="w-4 h-4" /> },
    { id: "access", label: "Access", icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const getStepStatus = (stepId: DemoStep) => {
    const stepOrder: DemoStep[] = ["connect", "verify", "approve", "access"];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  const addAuditEntry = useCallback(
    (action: string, txHash?: string) => {
      setAuditTrail((prev) => [
        {
          action,
          timestamp: new Date().toISOString(),
          txHash,
        },
        ...prev,
      ]);
    },
    []
  );

  const handleConnect = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const newWallet = {
        address: generateAddress(),
        isVerified: false,
      };
      setWallet(newWallet);
      addAuditEntry(`Wallet ${newWallet.address.slice(0, 10)}... connected`);
      setCurrentStep("verify");
      setIsProcessing(false);
    }, 800);
  };

  const handleTestTransaction = () => {
    if (!wallet) return;
    setIsProcessing(true);
    setTxResult("pending");

    setTimeout(() => {
      // If not verified, transaction fails
      if (!wallet.isVerified) {
        setTxResult("failed");
        addAuditEntry("Transaction REJECTED: Address not on allowlist");
      } else {
        setTxResult("success");
        addAuditEntry(
          "Transaction SUCCESS: Transfer completed",
          `0x${Math.random().toString(16).slice(2, 10)}...`
        );
      }
      setIsProcessing(false);
    }, 1500);
  };

  const handleVerify = () => {
    const selectedCountry = COUNTRIES.find((c) => c.code === kycCountry);
    if (!kycName || !selectedCountry) return;

    if (selectedCountry.restricted) {
      addAuditEntry(`KYC REJECTED: Restricted jurisdiction (${selectedCountry.name})`);
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      addAuditEntry(`KYC verification initiated for ${kycName}`);

      setTimeout(() => {
        addAuditEntry("Identity verified via Jumio");
        addAuditEntry("AML screening passed via Chainalysis");
        setCurrentStep("approve");
        setIsProcessing(false);
      }, 1200);
    }, 800);
  };

  const handleApprove = () => {
    if (!wallet) return;
    setIsProcessing(true);

    setTimeout(() => {
      const txHash = `0x${Math.random().toString(16).slice(2, 10)}...`;
      addAuditEntry(`Address added to txAllowList`, txHash);
      setWallet({ ...wallet, isVerified: true });
      setCurrentStep("access");
      setIsProcessing(false);
    }, 1000);
  };

  const handleReset = () => {
    setCurrentStep("connect");
    setWallet(null);
    setKycName("");
    setKycCountry("");
    setTxResult("pending");
    setAuditTrail([]);
  };

  return (
    <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="text-center mb-6">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Experience Compliant Access
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          See how the KYC-gated transaction flow works. Only verified wallets can transact on this permissioned L1.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.id);
          return (
            <React.Fragment key={step.id}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                  status === "complete" && "bg-green-100 dark:bg-green-900/30",
                  status === "active" && "bg-emerald-100 dark:bg-emerald-900/30",
                  status === "pending" && "bg-zinc-100 dark:bg-zinc-800"
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    status === "complete" && "bg-green-500 text-white",
                    status === "active" && "bg-emerald-500 text-white",
                    status === "pending" && "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                  )}
                >
                  {status === "complete" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    status === "complete" && "text-green-700 dark:text-green-400",
                    status === "active" && "text-emerald-700 dark:text-emerald-400",
                    status === "pending" && "text-zinc-500"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight
                  className={cn(
                    "w-4 h-4",
                    getStepStatus(steps[idx + 1].id) !== "pending"
                      ? "text-emerald-400"
                      : "text-zinc-300 dark:text-zinc-600"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="max-w-md mx-auto">
        {/* Connect Step */}
        {currentStep === "connect" && (
          <div className="text-center space-y-4">
            <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30">
              <Wallet className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Connect a demo wallet to begin the verification process.
              </p>
              <button
                onClick={handleConnect}
                disabled={isProcessing}
                className={cn(
                  "px-6 py-3 rounded-xl font-medium text-white transition-all",
                  isProcessing
                    ? "bg-emerald-400 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
                )}
              >
                {isProcessing ? "Connecting..." : "Connect Demo Wallet"}
              </button>
            </div>
          </div>
        )}

        {/* Verify Step */}
        {currentStep === "verify" && wallet && (
          <div className="space-y-4">
            {/* Wallet Info */}
            <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500">Connected Wallet</div>
                <code className="text-sm text-zinc-700 dark:text-zinc-300 truncate block">
                  {wallet.address}
                </code>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs">
                <AlertTriangle className="w-3 h-3" />
                Not Verified
              </div>
            </div>

            {/* Try Transaction (should fail) */}
            <div className="p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                Try sending a transaction before verification...
              </p>
              <button
                onClick={handleTestTransaction}
                disabled={isProcessing}
                className="w-full px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Send Test Transaction"}
              </button>
              {txResult === "failed" && (
                <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <XCircle className="w-4 h-4" />
                  Transaction rejected: Address not on allowlist
                </div>
              )}
            </div>

            {/* KYC Form */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Complete KYC Verification
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={kycName}
                    onChange={(e) => setKycName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">
                    Country of Residence
                  </label>
                  <select
                    value={kycCountry}
                    onChange={(e) => setKycCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">Select country...</option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                        {country.restricted && " (Restricted)"}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isProcessing || !kycName || !kycCountry}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-lg font-medium text-white transition-all",
                    isProcessing || !kycName || !kycCountry
                      ? "bg-emerald-400 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
                  )}
                >
                  {isProcessing ? "Verifying..." : "Submit for Verification"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Step */}
        {currentStep === "approve" && wallet && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Identity Verified
                </span>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400/80 mb-4">
                Your identity has been verified. Click below to add your address to the
                transaction allowlist.
              </p>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg font-medium text-white transition-all",
                  isProcessing
                    ? "bg-emerald-400 cursor-not-allowed"
                    : "bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]"
                )}
              >
                {isProcessing ? "Adding to Allowlist..." : "Add to Allowlist"}
              </button>
            </div>
          </div>
        )}

        {/* Access Step */}
        {currentStep === "access" && wallet && (
          <div className="space-y-4">
            {/* Wallet Info - Verified */}
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-green-600 dark:text-green-400">
                  Verified Wallet
                </div>
                <code className="text-sm text-green-700 dark:text-green-300 truncate block">
                  {wallet.address}
                </code>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">
                <CheckCircle2 className="w-3 h-3" />
                On Allowlist
              </div>
            </div>

            {/* Try Transaction (should succeed) */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-sm text-emerald-800 dark:text-emerald-300 mb-3">
                Now try sending a transaction with your verified wallet...
              </p>
              <button
                onClick={handleTestTransaction}
                disabled={isProcessing}
                className="w-full px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Send Test Transaction"}
              </button>
              {txResult === "success" && (
                <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Transaction successful! Recorded in permanent audit trail.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audit Trail */}
        {auditTrail.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <FileText className="w-4 h-4" />
                Audit Trail
              </h4>
              <span className="text-xs text-zinc-500">
                {auditTrail.length} entries
              </span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {auditTrail.map((entry, idx) => (
                <div
                  key={idx}
                  className="text-xs p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                >
                  <div className="flex items-center justify-between text-zinc-500 mb-1">
                    <span className="font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.txHash && (
                      <code className="text-zinc-400">{entry.txHash}</code>
                    )}
                  </div>
                  <div
                    className={cn(
                      "font-medium",
                      entry.action.includes("REJECTED") || entry.action.includes("FAILED")
                        ? "text-red-600 dark:text-red-400"
                        : entry.action.includes("SUCCESS") || entry.action.includes("added")
                        ? "text-green-600 dark:text-green-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {entry.action}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              State pruning is disabled on this chain. All transactions are permanently recorded for regulatory compliance.
            </p>
          </div>
        )}

        {/* Reset Button */}
        {currentStep !== "connect" && (
          <div className="mt-6 text-center">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Demo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RwaDemo;
