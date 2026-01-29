"use client";

import Link from "next/link";
import {
  ChevronRight,
  Activity,
  Users,
  Clock,
  Fuel,
  Wallet,
  CheckCircle2,
  Circle,
  Settings,
  ArrowUpDown,
  MessagesSquare,
  BarChart3,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useL1Dashboard, type L1HealthStatus } from "@/hooks/useL1Dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// Health status badge component
function HealthStatusBadge({ status, size = "default" }: { status: L1HealthStatus; size?: "default" | "large" }) {
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
  const sizeClasses = size === "large" ? "px-3 py-1 text-sm" : "";

  return (
    <Badge className={`${config.className} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot} mr-1.5 ${size === "large" ? "animate-pulse" : ""}`} />
      {config.label}
    </Badge>
  );
}

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  isLoading?: boolean;
}) {
  return (
    <Card className="py-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <>
                <p className="text-lg font-semibold text-foreground">{value}</p>
                {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Setup step component
function SetupStep({
  label,
  completed,
  href,
}: {
  label: string;
  completed: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        {completed ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/50" />
        )}
        <span className={`flex-1 text-sm ${completed ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          {label}
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// Quick action card
function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 h-full">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-foreground text-sm mb-1">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>
      </div>
    </Link>
  );
}

// Not connected state
function NotConnectedState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Wallet className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">No L1 Connected</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Connect your wallet and switch to an L1 network to view your dashboard.
        Or create a new L1 to get started.
      </p>
      <div className="flex gap-3">
        <Link href="/console/layer-1/create">
          <Button>Create New L1</Button>
        </Link>
        <Link href="/console">
          <Button variant="outline">Back to Console</Button>
        </Link>
      </div>
    </div>
  );
}

export default function MyL1DashboardPage() {
  const {
    isConnected,
    isConnectedToL1,
    currentL1,
    healthStatus,
    validatorCount,
    blockTime,
    gasPrice,
    walletAddress,
    balance,
    setupProgress,
    setupProgressPercent,
    isLoading,
  } = useL1Dashboard();

  // If not connected to an L1, show the not connected state
  if (!isConnected || !isConnectedToL1 || !currentL1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My L1 Dashboard</h1>
            <p className="text-muted-foreground">Manage and monitor your Layer 1 blockchain</p>
          </div>
        </div>
        <NotConnectedState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {currentL1.logoUrl && (
            <img
              src={currentL1.logoUrl}
              alt={currentL1.name}
              className="w-12 h-12 rounded-lg object-contain bg-muted p-1"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{currentL1.name}</h1>
              <HealthStatusBadge status={healthStatus} size="large" />
            </div>
            <p className="text-muted-foreground">
              Chain ID: {currentL1.evmChainId} | {currentL1.isTestnet ? "Testnet" : "Mainnet"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {currentL1.explorerUrl && (
            <a href={currentL1.explorerUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Explorer
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Network Status"
          value={healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
          subValue={blockTime ? `~${blockTime}s block time` : undefined}
          isLoading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Validators"
          value={validatorCount}
          subValue="Active validators"
          isLoading={isLoading}
        />
        <StatCard
          icon={Wallet}
          label="Your Balance"
          value={`${balance.toFixed(4)} ${currentL1.coinName}`}
          subValue={`Address: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
        />
        <StatCard
          icon={Fuel}
          label="Gas Price"
          value={gasPrice ? `${parseFloat(gasPrice).toExponential(2)} ETH` : "N/A"}
          subValue="Current gas price"
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Setup Progress */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Setup Progress</CardTitle>
            <CardDescription>Complete these steps to fully configure your L1</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{setupProgressPercent}%</span>
              </div>
              <Progress value={setupProgressPercent} className="h-2" />
            </div>
            <div className="space-y-1">
              <SetupStep
                label="L1 Created"
                completed={setupProgress.l1Created}
                href="/console/layer-1/create"
              />
              <SetupStep
                label="Node Running"
                completed={setupProgress.nodeRunning}
                href="/console/primary-network/node-setup"
              />
              <SetupStep
                label="Validator Manager Setup"
                completed={setupProgress.vmSetup}
                href="/console/permissioned-l1s/add-validator"
              />
              <SetupStep
                label="Interchain Messaging (ICM)"
                completed={setupProgress.icmEnabled}
                href="/console/icm/setup"
              />
              <SetupStep
                label="Token Bridge"
                completed={setupProgress.bridgeSetup}
                href="/console/ictt/setup"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks for managing your L1</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <QuickActionCard
                icon={Users}
                title="Add Validator"
                description="Register a new validator to your L1 network"
                href="/console/permissioned-l1s/add-validator"
              />
              <QuickActionCard
                icon={ArrowUpDown}
                title="Setup Bridge"
                description="Enable token transfers to other chains"
                href="/console/ictt/setup"
              />
              <QuickActionCard
                icon={MessagesSquare}
                title="Configure ICM"
                description="Set up cross-chain messaging"
                href="/console/icm/setup"
              />
              <QuickActionCard
                icon={BarChart3}
                title="View Performance"
                description="Monitor network metrics and health"
                href={currentL1.explorerUrl || "#"}
              />
              <QuickActionCard
                icon={Settings}
                title="L1 Settings"
                description="Configure gas, fees, and permissions"
                href="/console/l1-tokenomics/fee-manager"
              />
              <QuickActionCard
                icon={Wallet}
                title="Get Test Tokens"
                description="Request tokens from the faucet"
                href="/console/primary-network/faucet"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Network Details</CardTitle>
          <CardDescription>Technical information about your L1</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">RPC URL</p>
              <p className="text-sm font-mono text-foreground truncate" title={currentL1.rpcUrl}>
                {currentL1.rpcUrl}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Subnet ID</p>
              <p className="text-sm font-mono text-foreground truncate" title={currentL1.subnetId}>
                {currentL1.subnetId}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Blockchain ID</p>
              <p className="text-sm font-mono text-foreground truncate" title={currentL1.id}>
                {currentL1.id}
              </p>
            </div>
            {currentL1.validatorManagerAddress && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Validator Manager</p>
                <p className="text-sm font-mono text-foreground truncate" title={currentL1.validatorManagerAddress}>
                  {currentL1.validatorManagerAddress}
                </p>
              </div>
            )}
            {currentL1.wellKnownTeleporterRegistryAddress && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Teleporter Registry</p>
                <p className="text-sm font-mono text-foreground truncate" title={currentL1.wellKnownTeleporterRegistryAddress}>
                  {currentL1.wellKnownTeleporterRegistryAddress}
                </p>
              </div>
            )}
            {currentL1.wrappedTokenAddress && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Wrapped Token</p>
                <p className="text-sm font-mono text-foreground truncate" title={currentL1.wrappedTokenAddress}>
                  {currentL1.wrappedTokenAddress}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      {currentL1.features && currentL1.features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentL1.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {feature}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
