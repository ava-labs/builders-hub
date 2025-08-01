"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { ConsoleSidebar } from "./ConsoleSidebar";
import { UserButton } from "./UserButton";
import { FlowNavigation } from "./FlowNavigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Sun, Moon, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

// Dynamically import HeaderWalletConnection from toolbox
const HeaderWalletConnection = lazy(() => 
  import("../../../toolbox/src/components/HeaderWalletConnection").then(module => ({
    default: module.HeaderWalletConnection
  }))
);

// Premium background styles
const backgroundStyles = `
  @keyframes constellation-twinkle {
    0%, 100% { 
      opacity: 0.3;
    }
    50% { 
      opacity: 1;
    }
  }
  
  .animate-constellation-twinkle {
    animation: constellation-twinkle 4s ease-in-out infinite;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = backgroundStyles;
  document.head.appendChild(styleSheet);
}

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const pathname = usePathname();
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark');
      setIsDarkMode(!isDarkMode);
      // Save preference to localStorage
      localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light');
    }
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }
  }, []);

  // Get breadcrumb navigation
  const getBreadcrumbs = () => {
    if (pathname === '/console') return [{ label: 'Dashboard', isActive: true }];
    
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length >= 3) {
      const category = pathSegments[1]; // e.g., "layer-1s"
      const tool = pathSegments[2]; // e.g., "create-chain"
      
      const breadcrumbs = [];
      
      // Add category
      const categoryMap: Record<string, string> = {
        'primary-network': 'Primary Network',
        'layer-1': 'Layer 1',
        'l1-tokenomics': 'L1 Tokenomics',
        'permissioned-l1s': 'Permissioned L1s',
        'permissionless-l1s': 'Permissionless L1s',
        'icm': 'Interchain Messaging',
        'ictt': 'Interchain Token Transfer',
        'utilities': 'Utilities'
      };
      
      const categoryLabel = categoryMap[category] || category;
      breadcrumbs.push({ label: categoryLabel, isActive: false });
      
      // Add current tool directly (no subcategories since we removed expandable sections)
      const fullPath = `${category}/${tool}`;
      const toolMap: Record<string, string> = {
        // Primary Network
        'primary-network/node-setup': 'Node Setup',
        'primary-network/faucet': 'Testnet Faucet',
        'primary-network/bridge': 'C<->P Chain Bridge',
        'primary-network/unit-converter': 'AVAX Unit Converter',
        
        // Layer 1
        'layer-1/create': 'Create New L1',
        'layer-1/node-setup': 'Node Setup',
        'layer-1/node-setup-managed': 'BuilderHub Managed Nodes',
        'layer-1/rpc-security-check': 'RPC Method Security Check',
        'layer-1/performance-check': 'L1 Performance Check',
        'layer-1/convert-to-l1': 'Convert to L1',
        'layer-1/explorer-setup': 'Explorer Setup',
        'layer-1/manage-tx-fees': 'Manage Transactions Fees',
        
        // L1 Tokenomics
        'l1-tokenomics/fee-manager': 'Transaction Fee Parameters (Fee Manager)',
        'l1-tokenomics/reward-manager': 'Fee Distributions (Reward Manager)',
        'l1-tokenomics/native-minter': 'Mint native Coins (Native Minter)',
        
        // Permissioned L1s
        'permissioned-l1s/validator-manager-setup': 'Deploy Validator Manager',
        'permissioned-l1s/upgrade-proxy': 'Upgrade Proxy',
        'permissioned-l1s/initialize': 'Initialize',
        'permissioned-l1s/init-validator-set': 'Initialize Validator Set',
        'permissioned-l1s/read-contract': 'Read Proxy Contract',
        'permissioned-l1s/add-validator': 'Add Validator',
        'permissioned-l1s/change-weight': 'Change Weight',
        'permissioned-l1s/remove-validator': 'Remove Validator',
        'permissioned-l1s/query-validators': 'Query L1 Validator Set',
        'permissioned-l1s/balance-topup': 'Validator Balance Topup',
        'permissioned-l1s/deployer-allowlist': 'Contract Deployer Allowlist',
        'permissioned-l1s/transactor-allowlist': 'Transactor Allowlist',
        
        // Permissionless L1s
        'permissionless-l1s/migrate': 'Migrate from Permissioned L1',
        'permissionless-l1s/deploy-reward-manager': 'Deploy Reward Manager',
        'permissionless-l1s/deploy-staking-manager': 'Deploy Staking Manager',
        'permissionless-l1s/initialize-staking-manager': 'Initialize Staking Manager',
        'permissionless-l1s/transfer-ownership': 'Transfer VMC Ownership to Staking Manager',
        'permissionless-l1s/manage-validators': 'Stake & Unstake',
        
        // Interchain Messaging (ICM)
        'icm/setup': 'Setup',
        'icm/deploy-contracts': 'ICM Contracts Deployment',
        'icm/deploy-registry': 'ICM Registry Deployment',
        'icm/relayer-setup': 'ICM Relayer Setup',
        'icm/test-message': 'Test Message Delivery',
        'icm/deploy-demo': 'Demo Contract Deployment',
        'icm/send-test-message': 'Send Test Message',
        
        // Interchain Token Transfer (ICTT)
        'ictt/deploy-native-home': 'Deploy Native Token Home',
        'ictt/deploy-erc20-home': 'Deploy ERC-20 Token Home',
        'ictt/deploy-native-remote': 'Deploy Native Token Remote',
        'ictt/deploy-erc20-remote': 'Deploy ERC-20 Token Remote',
        'ictt/register-remote': 'Register Remote with Home',
        'ictt/deposit-collateral': 'Deposit Collateral with Home',
        
        // Utilities
        'utilities/format-converter': 'Format Converter'
      };
      
      const toolLabel = toolMap[fullPath] || tool.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      breadcrumbs.push({ label: toolLabel, isActive: true });
      
      return breadcrumbs;
    }
    
    return [{ label: 'Console', isActive: true }];
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        {/* Premium Background */}
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#0A0A0A] dark:via-[#0A0A0A] dark:to-[#0A0A0A]">
            {/* Subtle grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>
            
            {/* Constellation dots */}
            <div className="absolute inset-0">
              <div className="absolute top-1/5 left-1/5 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60"></div>
              <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '1s'}}></div>
              <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '2s'}}></div>
              <div className="absolute bottom-1/5 right-1/3 w-1 h-1 bg-slate-400/40 rounded-full animate-constellation-twinkle dark:bg-slate-500/60" style={{animationDelay: '3s'}}></div>
            </div>
          </div>
        </div>

        <ConsoleSidebar />
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 min-h-[72px]">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-5 w-px bg-sidebar-border" />
              <div className="flex items-center gap-3">
                <nav className="flex items-center space-x-1 text-sm">
                  {getBreadcrumbs().map((crumb, index) => (
                    <div key={index} className="flex items-center">
                      {index > 0 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                      )}
                      <span className={
                        crumb.isActive 
                          ? "text-lg font-semibold text-foreground" 
                          : "text-sm text-muted-foreground hover:text-foreground transition-colors"
                      }>
                        {crumb.label}
                      </span>
                    </div>
                  ))}
                </nav>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Wallet Connection */}
              <Suspense fallback={
                <Button size="default" className="h-12" disabled>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  <span className="text-sm">Loading...</span>
                </Button>
              }>
                <HeaderWalletConnection />
              </Suspense>
              
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="h-12 w-12"
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              
              {/* User Login Button */}
              <UserButton />
            </div>
          </header>
          
          {/* Flow Navigation */}
          <FlowNavigation currentPath={pathname} />
          
          <div className="flex-1 flex flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}