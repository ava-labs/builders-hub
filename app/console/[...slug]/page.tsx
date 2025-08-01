"use client";

import { Suspense, lazy, use, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConsoleLayout } from "../components/ConsoleLayout";
// Import FlowStepNavigation dynamically
// const FlowStepNavigation = lazy(() => 
//   import("../components/FlowStepNavigation")
// );

// Import the ToolboxErrorBoundary which provides ErrorBoundary context without wallet
const ToolboxErrorBoundary = lazy(() => 
  import("../../../toolbox/src/components/ToolboxMdxWrapper").then(module => ({
    default: module.ToolboxErrorBoundary
  }))
);

// Component mapping for dynamic imports - matching user specification
const componentMap = {
  // Primary Network
  "primary-network/node-setup": () => import("../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerPrimaryNetwork"),
  "primary-network/rpc-security-check": () => import("../../../toolbox/src/toolbox/Nodes/RPCMethodsCheck"),
  "primary-network/performance-check": () => import("../../../toolbox/src/toolbox/Nodes/PerformanceMonitor"),
  "primary-network/faucet": () => import("../../../toolbox/src/toolbox/Wallet/Faucet"),
  "primary-network/bridge": () => import("../../../toolbox/src/components/CrossChainTransfer"),
  "primary-network/unit-converter": () => import("../../../toolbox/src/toolbox/Conversion/UnitConverter"),
  
  // Layer 1
  "layer-1/create": () => import("../../../toolbox/src/toolbox/L1/CreateChain"),
  "layer-1/node-setup": () => import("../../../toolbox/src/toolbox/Nodes/AvalancheGoDockerL1"),
  "layer-1/node-setup-managed": () => import("../components/BuilderHubManagedNodes"),
  "layer-1/rpc-security-check": () => import("../../../toolbox/src/toolbox/Nodes/RPCMethodsCheck"),
  "layer-1/performance-check": () => import("../../../toolbox/src/toolbox/Nodes/PerformanceMonitor"),
  "layer-1/convert-to-l1": () => import("../../../toolbox/src/toolbox/L1/ConvertToL1"),
  "layer-1/explorer-setup": () => import("../../../toolbox/src/toolbox/L1/SelfHostedExplorer"),
  "layer-1/manage-tx-fees": () => import("../../../toolbox/src/toolbox/Precompiles/FeeManager"),
  
  // L1 Tokenomics
  "l1-tokenomics/fee-manager": () => import("../../../toolbox/src/toolbox/Precompiles/FeeManager"),
  "l1-tokenomics/reward-manager": () => import("../../../toolbox/src/toolbox/Precompiles/RewardManager"),
  "l1-tokenomics/native-minter": () => import("../../../toolbox/src/toolbox/Precompiles/NativeMinter"),
  
  // Permissioned L1s
  "permissioned-l1s/validator-manager-setup": () => import("../../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager"),
  "permissioned-l1s/upgrade-proxy": () => import("../../../toolbox/src/toolbox/Proxy/UpgradeProxy"),
  "permissioned-l1s/initialize": () => import("../../../toolbox/src/toolbox/ValidatorManager/Initialize"),
  "permissioned-l1s/init-validator-set": () => import("../../../toolbox/src/toolbox/ValidatorManager/InitValidatorSet"),
  "permissioned-l1s/read-contract": () => import("../../../toolbox/src/toolbox/ValidatorManager/ReadContract"),
  "permissioned-l1s/add-validator": () => import("../../../toolbox/src/toolbox/ValidatorManager/AddValidator/AddValidator"),
  "permissioned-l1s/change-weight": () => import("../../../toolbox/src/toolbox/ValidatorManager/ChangeWeight/ChangeWeight"),
  "permissioned-l1s/remove-validator": () => import("../../../toolbox/src/toolbox/ValidatorManager/RemoveValidator/RemoveValidator"),
  "permissioned-l1s/query-validators": () => import("../../../toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet"),
  "permissioned-l1s/balance-topup": () => import("../../../toolbox/src/toolbox/Nodes/BalanceTopup"),
  "permissioned-l1s/deployer-allowlist": () => import("../../../toolbox/src/toolbox/Precompiles/DeployerAllowlist"),
  "permissioned-l1s/transactor-allowlist": () => import("../../../toolbox/src/toolbox/Precompiles/TransactionAllowlist"),
  
  // Permissionless L1s
  "permissionless-l1s/migrate": () => import("../../../toolbox/src/toolbox/L1/ConvertToL1"),
  "permissionless-l1s/deploy-reward-manager": () => import("../../../toolbox/src/toolbox/Precompiles/RewardManager"),
  "permissionless-l1s/deploy-staking-manager": () => import("../../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager"), // Placeholder
  "permissionless-l1s/initialize-staking-manager": () => import("../../../toolbox/src/toolbox/ValidatorManager/InitValidatorSet"),
  "permissionless-l1s/transfer-ownership": () => import("../../../toolbox/src/toolbox/ValidatorManager/DeployValidatorManager"), // Placeholder
  "permissionless-l1s/manage-validators": () => import("../../../toolbox/src/toolbox/ValidatorManager/QueryL1ValidatorSet"),
  
  // Interchain Messaging (ICM)
  "icm/setup": () => import("../../../toolbox/src/toolbox/ICM/TeleporterMessenger"),
  "icm/deploy-contracts": () => import("../../../toolbox/src/toolbox/ICM/TeleporterMessenger"),
  "icm/deploy-registry": () => import("../../../toolbox/src/toolbox/ICM/TeleporterRegistry"),
  "icm/relayer-setup": () => import("../../../toolbox/src/toolbox/ICM/ICMRelayer"),
  "icm/test-message": () => import("../../../toolbox/src/toolbox/ICM/SendICMMessage"),
  "icm/deploy-demo": () => import("../../../toolbox/src/toolbox/ICM/DeployICMDemo"),
  "icm/send-test-message": () => import("../../../toolbox/src/toolbox/ICM/SendICMMessage"),
  
  // Interchain Token Transfer (ICTT)
  "ictt/deploy-native-home": () => import("../../../toolbox/src/toolbox/ICTT/DeployTokenHome"),
  "ictt/deploy-erc20-home": () => import("../../../toolbox/src/toolbox/ICTT/DeployTokenHome"), // Placeholder - same component for now
  "ictt/deploy-native-remote": () => import("../../../toolbox/src/toolbox/ICTT/DeployNativeTokenRemote"),
  "ictt/deploy-erc20-remote": () => import("../../../toolbox/src/toolbox/ICTT/DeployERC20TokenRemote"),
  "ictt/register-remote": () => import("../../../toolbox/src/toolbox/ICTT/RegisterWithHome"),
  "ictt/deposit-collateral": () => import("../../../toolbox/src/toolbox/ICTT/AddCollateral"),
  
  // Utilities
  "utilities/format-converter": () => import("../../../toolbox/src/toolbox/Conversion/FormatConverter"),
};



// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-red-500 text-xl font-semibold">Something went wrong</div>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session.user.is_new_user &&
      pathname !== "/profile"
    ) {
      // Store the original URL with search params (including UTM) in localStorage
      const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterProfile", originalUrl);
      }
      router.replace("/profile");
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}

interface ConsoleToolPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

function ConsoleToolContent({ params }: ConsoleToolPageProps) {
  // Unwrap the params promise using React.use()
  const resolvedParams = use(params);
  const path = resolvedParams.slug.join("/");
  
  // Client-side only state to prevent SSR issues
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Check if the path exists in our component map
  if (!componentMap[path as keyof typeof componentMap]) {
    notFound();
  }
  
  // Dynamically import the component
  const DynamicComponent = lazy(componentMap[path as keyof typeof componentMap] as () => Promise<{ default: React.ComponentType<any> }>);
  
  // Don't render the dynamic component until we're on the client
  if (!isClient) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }
  
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading Toolbox...</p>
        </div>
      </div>
    }>
      <ToolboxErrorBoundary>
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-muted-foreground">Loading component...</p>
            </div>
          </div>
        }>
          <DynamicComponent />
        </Suspense>
      </ToolboxErrorBoundary>
    </Suspense>
  );
}

export default function ConsoleToolPage({ params }: ConsoleToolPageProps) {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <RedirectIfNewUser />
      </Suspense>
      <ConsoleLayout>
        <ConsoleToolContent params={params} />
      </ConsoleLayout>
    </SessionProvider>
  );
}