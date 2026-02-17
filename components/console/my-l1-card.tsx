"use client";

import Link from "next/link";
import { ChevronRight, Gamepad2, Wallet, AlertCircle, Rocket } from "lucide-react";
import { useL1Dashboard, type L1HealthStatus } from "@/hooks/useL1Dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Health status badge component
function HealthStatusBadge({ status }: { status: L1HealthStatus }) {
  const statusConfig = {
    healthy: {
      label: "Healthy",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      dot: "bg-green-500",
    },
    degraded: {
      label: "Degraded",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      dot: "bg-yellow-500",
    },
    offline: {
      label: "Offline",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      dot: "bg-red-500",
    },
    unknown: {
      label: "Unknown",
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
      dot: "bg-gray-500",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={config.className}>
      <span className={`w-2 h-2 rounded-full ${config.dot} mr-1.5`} />
      {config.label}
    </Badge>
  );
}

// Banner for when wallet is not connected
export function ConnectWalletBanner() {
  return (
    <div className="p-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 mb-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Wallet className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">Connect Wallet to Get Started</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your wallet to view your L1 dashboard, track validators, and manage your blockchain infrastructure.
          </p>
          <p className="text-xs text-muted-foreground">
            Use the wallet button in the header to connect with Core, MetaMask, or other EVM-compatible wallets.
          </p>
        </div>
      </div>
    </div>
  );
}

// Banner for when connected to C-Chain but no L1
export function CreateL1Banner() {
  return (
    <div className="p-6 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <Rocket className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">Ready to Build Your Own L1?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You're connected to the C-Chain. Launch your own custom Layer 1 blockchain with Avalanche's powerful infrastructure.
          </p>
          <Link href="/console/layer-1/create">
            <Button size="sm">
              Create Your First L1
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Main My L1 Card showing connected L1 status
export function MyL1Card() {
  const {
    currentL1,
    healthStatus,
    validatorCount,
    setupProgress,
    balance,
    isLoading,
  } = useL1Dashboard();

  if (!currentL1) return null;

  // Build feature summary
  const features: string[] = [];
  if (validatorCount > 0) {
    features.push(`${validatorCount} validator${validatorCount !== 1 ? "s" : ""}`);
  }
  if (setupProgress.icmEnabled) {
    features.push("ICM ready");
  } else {
    features.push("No ICM");
  }
  if (setupProgress.bridgeSetup) {
    features.push("Bridge active");
  } else {
    features.push("No bridges");
  }

  return (
    <Link href="/console/my-l1" className="group block mb-6">
      <div className="p-6 rounded-lg border-2 border-primary/50 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 hover:border-primary hover:bg-primary/10 transition-all duration-200 cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gamepad2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{currentL1.name}</h3>
              <p className="text-xs text-muted-foreground">Chain ID: {currentL1.evmChainId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HealthStatusBadge status={healthStatus} />
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {features.map((feature, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <span className="text-muted-foreground/50">|</span>}
              <span className="ml-1">{feature}</span>
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Balance: </span>
            <span className="font-medium text-foreground">
              {balance.toFixed(4)} {currentL1.coinName}
            </span>
          </div>
          <span className="text-sm font-medium text-primary group-hover:underline">
            Open Dashboard
          </span>
        </div>
      </div>
    </Link>
  );
}

// Main export that conditionally renders based on wallet state
export function MyL1StatusSection() {
  const { isConnected, isConnectedToL1, isConnectedToCChain } = useL1Dashboard();

  if (!isConnected) {
    return <ConnectWalletBanner />;
  }

  if (isConnectedToCChain) {
    return <CreateL1Banner />;
  }

  if (isConnectedToL1) {
    return <MyL1Card />;
  }

  // Connected to an unknown chain
  return (
    <div className="p-6 rounded-lg border border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-900/10 mb-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground mb-1">Unknown Network</h3>
          <p className="text-sm text-muted-foreground">
            You're connected to an unrecognized network. Switch to C-Chain or add your L1 to the network list.
          </p>
        </div>
      </div>
    </div>
  );
}
