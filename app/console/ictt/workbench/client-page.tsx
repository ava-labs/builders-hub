"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useSelectedL1 } from "@/components/toolbox/stores/l1ListStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { Button } from "@/components/toolbox/components/Button";
import { Wallet, ArrowRight, Sparkles, Zap, Shield, RefreshCw } from "lucide-react";
import Link from "next/link";

// Dynamic import to avoid SSR issues with the workbench
const ICTTWorkbench = dynamic(
  () => import("@/components/console/ictt-workbench"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[500px] flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading workbench...</p>
        </div>
      </div>
    ),
  }
);

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
      <div>
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>
      </div>
    </div>
  );
}

export default function ICTTWorkbenchClient() {
  const selectedL1 = useSelectedL1()();
  const { walletEVMAddress, isTestnet } = useWalletStore();

  const isConnected = !!walletEVMAddress && !!selectedL1;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              ICTT Workbench
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Visual Bridge Builder for Cross-Chain Token Transfers
            </p>
          </div>
        </div>

        {/* Breadcrumb / Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/console"
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Console
          </Link>
          <span className="text-zinc-400">/</span>
          <Link
            href="/console/ictt/setup"
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ICTT
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="text-zinc-700 dark:text-zinc-200">Workbench</span>
        </div>
      </div>

      {/* Wallet not connected state */}
      {!isConnected && (
        <div className="space-y-6">
          {/* Hero section */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-8 text-white">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-3">
                Build Token Bridges Visually
              </h2>
              <p className="text-blue-100 max-w-xl mb-6">
                The ICTT Workbench provides an intuitive visual interface for creating
                cross-chain token bridges. Simply drag and drop chains to connect them,
                and the system handles the contract deployments for you.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                  <Wallet className="w-5 h-5" />
                  <span>Connect your wallet to get started</span>
                </div>
              </div>
            </div>
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon={Sparkles}
              title="Visual Bridge Builder"
              description="Drag and drop chains to create token bridge connections with an intuitive visual interface."
            />
            <FeatureCard
              icon={Zap}
              title="Auto-Generated Configs"
              description="Relayer configuration is automatically generated based on your bridge topology."
            />
            <FeatureCard
              icon={Shield}
              title="Status Tracking"
              description="Track deployment progress and resume from where you left off at any time."
            />
          </div>

          {/* How it works */}
          <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              How It Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  step: 1,
                  title: "Select Your L1",
                  description: "Connect your wallet and select the L1 you want to bridge to",
                },
                {
                  step: 2,
                  title: "Connect Chains",
                  description: "Click on available chains to create bridge connections",
                },
                {
                  step: 3,
                  title: "Configure Tokens",
                  description: "Choose which tokens to bridge and how they should appear",
                },
                {
                  step: 4,
                  title: "Deploy & Bridge",
                  description: "Deploy contracts and start transferring tokens",
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                      {item.step}
                    </div>
                    {item.step < 4 && (
                      <ArrowRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 hidden md:block" />
                    )}
                  </div>
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Link to traditional setup */}
          <div className="flex items-center justify-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span>Prefer the step-by-step wizard?</span>
            <Link
              href="/console/ictt/setup"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Use traditional setup
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Connected state - show workbench */}
      {isConnected && (
        <>
          {/* Network indicator */}
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-3">
              {selectedL1?.logoUrl && (
                <img
                  src={selectedL1.logoUrl}
                  alt={selectedL1.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Connected to {selectedL1?.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {isTestnet ? "Testnet" : "Mainnet"} - Chain ID: {selectedL1?.evmChainId}
                </p>
              </div>
            </div>
            <Link
              href="/console/ictt/setup"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Switch to wizard view
            </Link>
          </div>

          {/* Main workbench */}
          <ICTTWorkbench />

          {/* Help text */}
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p>
              Click on a chain in the selector to create a new bridge connection.
              Your progress is saved automatically.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
