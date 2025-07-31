"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Layers, 
  Users, 
  MessagesSquare, 
  ArrowUpDown, 
  Settings, 
  Wrench, 
  Droplets, 
  ArrowLeft,
  Shield,
  RefreshCcw,

  Network,
  Building2,
  Zap,
  GitMerge
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";


// Navigation data structure matching user specification
const data = {
  navMain: [
    {
      title: "Home",
      url: "/console",
      icon: Home,
    },
  ],
  navGroups: [
    {
      title: "Primary Network",
      icon: Network,
      items: [
        {
          title: "Node Setup",
          url: "/console/primary-network/node-setup?flow=node-setup",
          icon: Settings,
        },
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
        {
          title: "C<->P Chain Bridge",
          url: "/console/primary-network/bridge",
          icon: ArrowUpDown,
        },
        {
          title: "AVAX Unit Converter",
          url: "/console/primary-network/unit-converter",
          icon: RefreshCcw,
        },
      ],
    },
    {
      title: "Layer 1",
      icon: Building2,
      items: [
        {
          title: "Create New L1",
          url: "/console/layer-1/create",
          icon: Layers,
        },
        {
          title: "L1 Node Setup",
          url: "/console/layer-1/node-setup?flow=node-setup",
          icon: Settings,
        },
        {
          title: "Explorer Setup",
          url: "/console/layer-1/explorer-setup",
          icon: Building2,
        },
        {
          title: "Manage Transaction Fees",
          url: "/console/layer-1/manage-tx-fees",
          icon: Zap,
        },
      ],
    },
    {
      title: "L1 Tokenomics",
      icon: Users,
      items: [
        {
          title: "Transaction Fee Parameters",
          url: "/console/l1-tokenomics/fee-manager",
          icon: Zap,
        },
        {
          title: "Fee Distributions",
          url: "/console/l1-tokenomics/reward-manager",
          icon: Zap,
        },
        {
          title: "Mint Native Coins",
          url: "/console/l1-tokenomics/native-minter",
          icon: Zap,
        },
      ],
    },
    {
      title: "Permissioned L1s",
      icon: Settings,
      items: [
        {
          title: "Validator Manager Setup",
          url: "/console/permissioned-l1s/validator-manager-setup?flow=validator-manager",
          icon: Users,
        },
        {
          title: "Manage Validators",
          url: "/console/permissioned-l1s/add-validator?flow=manage-validators",
          icon: Users,
        },
        {
          title: "Contract Deployer Allowlist",
          url: "/console/permissioned-l1s/deployer-allowlist",
          icon: Shield,
        },
        {
          title: "Transactor Allowlist",
          url: "/console/permissioned-l1s/transactor-allowlist",
          icon: Shield,
        },
      ],
    },
    {
      title: "Permissionless L1s",
      icon: Zap,
      items: [
        {
          title: "Migrate from Permissioned L1",
          url: "/console/permissionless-l1s/deploy-reward-manager?flow=migrate",
          icon: GitMerge,
        },
        {
          title: "Stake & Unstake",
          url: "/console/permissionless-l1s/manage-validators",
          icon: Users,
          comingSoon: true,
        },
      ],
    },
    {
      title: "Interchain Messaging",
      icon: MessagesSquare,
      items: [
        {
          title: "Setup",
          url: "/console/icm/setup",
          icon: Settings,
        },
        {
          title: "Send Test Message",
          url: "/console/icm/send-test-message",
          icon: MessagesSquare,
        },
      ],
    },
    {
      title: "Interchain Token Transfer",
      icon: ArrowUpDown,
      items: [
        {
          title: "Bridge Setup",
          url: "/console/ictt/deploy-native-home",
          icon: ArrowUpDown,
        },
        {
          title: "Token Transfer",
          url: "/console/ictt/token-transfer",
          icon: ArrowUpDown,
        },
      ],
    },
    {
      title: "Utilities",
      icon: Wrench,
      items: [
        {
          title: "Format Converter",
          url: "/console/utilities/format-converter",
          icon: Wrench,
        },
      ],
    },
  ],
  navSecondary: [],
};

interface ConsoleSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function ConsoleSidebar({ 
  ...props 
}: ConsoleSidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <Link
            href="/console"
            className="flex flex-col items-center gap-2 group transition-all duration-200"
          >
            <div className="relative">
              <img 
                src="/logo-white.png" 
                alt="Avalanche" 
                className="h-8 w-auto hidden dark:block transition-all duration-200" 
              />
              <img 
                src="/logo-black.png" 
                alt="Avalanche" 
                className="h-8 w-auto block dark:hidden transition-all duration-200" 
              />
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs font-medium text-muted-foreground">Builder Console</span>
            </div>
          </Link>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const isActive = pathname === item.url;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                    className={isActive 
                      ? 'bg-sky-100 dark:bg-sky-900/20 text-sky-900 dark:text-sky-100 border-r-2 border-sky-500 hover:bg-sky-150 dark:hover:bg-sky-900/30' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className={isActive ? 'text-sky-600 dark:text-sky-400' : ''} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Flat Navigation Groups */}
        {data.navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-sidebar-foreground/70">
              <group.icon className="h-4 w-4" />
              <span>{group.title}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild={!item.comingSoon}
                        isActive={isActive}
                        className={`pl-6 ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''} ${
                          isActive 
                            ? 'bg-sky-100 dark:bg-sky-900/20 text-sky-900 dark:text-sky-100 border-r-2 border-sky-500 hover:bg-sky-150 dark:hover:bg-sky-900/30' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        disabled={item.comingSoon}
                      >
                        {item.comingSoon ? (
                          <div className="flex items-center gap-2">
                            <item.icon />
                            <span>{item.title}</span>
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full ml-auto">
                              Coming Soon
                            </span>
                          </div>
                        ) : (
                          <Link href={item.url}>
                            <item.icon className={isActive ? 'text-sky-600 dark:text-sky-400' : ''} />
                            <span>{item.title}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}


      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                <ArrowLeft />
                <span>Back to Builder Hub</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => window.location.reload()}>
              <RefreshCcw />
              <span>Reset State</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}

// Export the navigation data for use in other components
export { data };