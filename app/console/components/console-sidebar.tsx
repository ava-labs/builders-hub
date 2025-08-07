"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Layers, 
  Users, 
  MessagesSquare,
  Settings, 
  Wrench, 
  Droplets, 
  ArrowLeft,
  Shield,
  RefreshCcw,
  Network,
  GitMerge,
  Server,
  Telescope,
  ArrowLeftRight,
  Calculator,
  Coins,
  Box,
  Globe,
  ArrowUpDown
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
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";


// Navigation data structure matching user specification
const data = {
  navMain: [
    {
      title: "Home",
      url: "/console",
      icon: Home,
    },
    {
        title: "Back to Builder Hub",
        url: "/",
        icon: ArrowLeft,
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
          icon: Server,
        },
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
        {
          title: "C/P-Chain Bridge",
          url: "/console/primary-network/bridge",
          icon: ArrowLeftRight,
        },
        {
          title: "Ethereum Bridge",
          url: "https://core.app/bridge",
          icon: ArrowUpDown,
        },
        {
          title: "AVAX Unit Converter",
          url: "/console/primary-network/unit-converter",
          icon: Calculator,
        },
      ],
    },
    {
      title: "Layer 1",
      icon: Box,
      items: [
        {
          title: "Create New L1",
          url: "/console/layer-1/create",
          icon: Layers,
        },
        {
          title: "L1 Node Setup",
          url: "/console/layer-1/node-setup?flow=node-setup",
          icon: Server,
        },
        {
          title: "Explorer Setup",
          url: "/console/layer-1/explorer-setup",
          icon: Telescope,
        }
      ],
    },
    {
      title: "L1 Tokenomics",
      icon: Coins,
      items: [
        {
          title: "Transaction Fee Parameters",
          url: "/console/l1-tokenomics/fee-manager",
          icon: Coins,
        },
        {
          title: "Fee Distributions",
          url: "/console/l1-tokenomics/reward-manager",
          icon: Coins,
        },
        {
          title: "Mint Native Coins",
          url: "/console/l1-tokenomics/native-minter",
          icon: Coins,
        },
      ],
    },
    {
      title: "Permissioned L1s",
      icon: Shield,
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
      icon: Globe,
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
      icon: ArrowLeftRight,
      items: [
        {
          title: "Bridge Setup",
          url: "/console/ictt/deploy-native-home",
          icon: ArrowLeftRight,
        },
        {
          title: "Token Transfer",
          url: "/console/ictt/token-transfer",
          icon: ArrowLeftRight,
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
        <Link
          href="/console"
          className="flex items-center gap-2 group transition-all duration-200 p-2"
        >
          <AvalancheLogo className='size-7' fill='currentColor' />
          <span className="font-large font-semibold">Builder Console</span>
        </Link>
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
                  >
                    <Link href={item.url}>
                      <item.icon />
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
            <SidebarGroupLabel>
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
                        className={`${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={item.comingSoon}
                      >

                        
                        {item.comingSoon ? (
                          <div className="flex items-center gap-2">
                            <item.icon />
                            <span>{item.title} (soon)</span>
                          </div>
                        ) : (
                          <Link href={item.url}>
                            <item.icon />
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