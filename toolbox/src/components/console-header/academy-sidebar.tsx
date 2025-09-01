"use client";
import * as React from "react";
import { useState, useEffect } from "react";
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
import { AvalancheLogo } from "@/navigation/avalanche-logo";

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
          url: "/console/permissioned-l1s/deployer-allowlist",
          icon: ShieldCheck,
        },
        {
          title: "Transactor Allowlist",
          url: "/console/permissioned-l1s/transactor-allowlist",
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
      ],
    },
  ],
  navSecondary: [],
};

function usePathname() {
  const [pathname, setPathname] = useState(() => {
    // client-side check before accessing window
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleLocationChange = () => {
        setPathname(window.location.pathname);
      };

      window.addEventListener("popstate", handleLocationChange);
      return () => window.removeEventListener("popstate", handleLocationChange);
    }
  }, []);

  return pathname;
}

interface AcademySidebarProps extends React.ComponentProps<typeof Sidebar> {}

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
        <a
          href="/console"
          className="flex items-center gap-2 group transition-all duration-200 p-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          <AvalancheLogo className="size-7" fill="currentColor" />
          <span className="font-large font-semibold">Builder Console</span>
        </a>
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
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
                        className={`${
                          isComingSoon ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={isComingSoon}
                      >
                        {isComingSoon ? (
                          <a href="#" rel="noopener noreferrer">
                            <item.icon />
                            <span>{item.title} (soon)</span>
                          </a>
                        ) : (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
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
