"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Layers,
  MessagesSquare,
  Wrench,
  Droplets,
  Shield,
  Network,
  GitMerge,
  Server,
  Telescope,
  ArrowLeftRight,
  Calculator,
  Coins,
  Box,
  Globe,
  ArrowUpDown,
  ShieldCheck,
  ShieldUser,
  SquareTerminal,
  Hexagon,
  SlidersVertical,
  SquareMinus,
  SquarePlus,
  BookKey,
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
} from "@/components/ui/sidebar";
import { AvalancheLogo } from "./avalanche-logo";

// Navigation data structure matching user specification
const data = {
  navMain: [
    {
      title: "Console Home",
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
          url: "/console/primary-network/node-setup",
          icon: Server,
        },
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
        {
          title: "C/P-Chain Bridge",
          url: "/console/primary-network/c-p-bridge",
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
          url: "/console/layer-1/l1-node-setup",
          icon: Server,
        },
        {
          title: "Explorer Setup",
          url: "/console/layer-1/explorer-setup",
          icon: Telescope,
        },
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
          url: "/console/permissioned-l1s/validator-manager-setup",
          icon: SquareTerminal,
        },
        {
          title: "Query Validator Set",
          url: "/console/layer-1/validator-set",
          icon: Hexagon,
        },
        {
          title: "Add Validator",
          url: "/console/permissioned-l1s/add-validator",
          icon: SquarePlus,
        },
        {
          title: "Remove Validator",
          url: "/console/permissioned-l1s/remove-validator",
          icon: SquareMinus,
        },
        {
          title: "Change Validator Weight",
          url: "/console/permissioned-l1s/change-validator-weight",
          icon: SlidersVertical,
        },
      ],
    },
    {
      title: "L1 Access Restrictions",
      icon: Shield,
      items: [
        {
          title: "Contract Deployer Allowlist",
          url: "/console/l1-access-restrictions/deployer-allowlist",
          icon: ShieldCheck,
        },
        {
          title: "Transactor Allowlist",
          url: "/console/l1-access-restrictions/transactor-allowlist",
          icon: ShieldUser,
        },
      ],
    },
    {
      title: "Permissionless L1s",
      icon: Globe,
      items: [
        {
          title: "Migrate from Permissioned L1",
          url: "/console/permissionless-l1s/deploy-reward-manager",
          icon: GitMerge,
          comingSoon: true,
        },
        {
          title: "Stake & Unstake",
          url: "/console/permissionless-l1s/manage-validators",
          icon: Hexagon,
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
          icon: SquareTerminal,
        },
        {
          title: "Test Connection",
          url: "/console/icm/test-connection",
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
          url: "/console/ictt/setup",
          icon: SquareTerminal,
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
        {
          title: "Migrate VMC From V1 to V2",
          url: "/console/utilities/vmcMigrateFromV1",
          icon: Wrench,
        },
        {
          title: "Glacier API Tokens",
          url: "/console/utilities/glacier-api-tokens",
          icon: BookKey,
        },
      ],
    },
  ],
  navSecondary: [],
};

interface AcademySidebarProps extends React.ComponentProps<typeof Sidebar> { }

export function AcademySidebar({ ...props }: AcademySidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar
      variant="sidebar"
      collapsible="offcanvas"
      className="not-prose absolute top-[var(--header-height)] left-0 right-0 bottom-0 z-50"
      {...props}
    >
      <SidebarHeader>
        <Link
          href="/console"
          className="flex items-center gap-2 group transition-all duration-200 p-2"
        >
          <AvalancheLogo className="size-7" fill="currentColor" />
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
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link href={item.url} target="_blank">
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
                  const isComingSoon =
                    "comingSoon" in item && (item as any).comingSoon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`${isComingSoon ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        disabled={isComingSoon}
                      >
                        {isComingSoon ? (
                          <Link href="#">
                            <item.icon />
                            <span>{item.title} (soon)</span>
                          </Link>
                        ) : (
                          <Link href={item.url} target="_blank">
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
    </Sidebar>
  );
}
