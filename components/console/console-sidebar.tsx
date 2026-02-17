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
  ArrowLeft,
  Shield,
  Network,
  GitMerge,
  Server,
  Telescope,
  ArrowLeftRight,
  Calculator,
  Coins,
  Box,
  ArrowUpDown,
  ShieldCheck,
  ShieldUser,
  SquareTerminal,
  Hexagon,
  SlidersVertical,
  SquareMinus,
  SquarePlus,
  HandCoins,
  ExternalLink,
  BookKey,
  ShieldOff,
  Activity,
  ChevronRight,
  Rocket,
  LayoutDashboard,
  Workflow,
  Sparkles,
  type LucideIcon,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { cn } from "@/lib/utils";

// C-Chain chain IDs (Fuji testnet and Mainnet)
const C_CHAIN_IDS = [43113, 43114];

// Types for navigation structure
interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

interface CollapsibleSubGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  requiresL1?: boolean;
  items: (NavItem | CollapsibleSubGroup)[];
}

// Helper to check if item is a collapsible subgroup
function isCollapsibleSubGroup(
  item: NavItem | CollapsibleSubGroup
): item is CollapsibleSubGroup {
  return "items" in item && Array.isArray(item.items);
}

// Sidebar state context for nested components
interface SidebarStateContextValue {
  isCollapsed: (sectionId: string) => boolean;
  toggleSection: (sectionId: string) => void;
}

const SidebarStateContext = React.createContext<SidebarStateContextValue | null>(null);

function useSidebarStateContext() {
  const context = React.useContext(SidebarStateContext);
  if (!context) {
    throw new Error("useSidebarStateContext must be used within SidebarStateProvider");
  }
  return context;
}

// Navigation data structure with new hierarchy
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
    // Get Started - prominent for new users
    {
      id: "get-started",
      title: "Get Started",
      icon: Rocket,
      items: [
        {
          title: "Blueprints",
          url: "/console/blueprints",
          icon: Sparkles,
        },
        {
          title: "Create L1",
          url: "/console/layer-1/create",
          icon: Layers,
        },
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
      ],
    },
    // Primary Network
    {
      id: "primary-network",
      title: "Primary Network",
      icon: Network,
      items: [
        {
          title: "Data API Keys",
          url: "/console/utilities/data-api-keys",
          icon: BookKey,
        },
        {
          title: "Node Setup",
          url: "/console/primary-network/node-setup",
          icon: Server,
        },
        {
          title: "Stake",
          url: "/console/primary-network/stake",
          icon: HandCoins,
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
          title: "Unit Converter",
          url: "/console/primary-network/unit-converter",
          icon: Calculator,
        },
      ],
    },
    // Your L1 - always visible, pages handle wallet state
    {
      id: "your-l1",
      title: "Your L1",
      icon: Box,
      defaultOpen: true,
      items: [
        {
          title: "My L1 Dashboard",
          url: "/console/my-l1",
          icon: LayoutDashboard,
        },
        {
          title: "Performance Monitor",
          url: "/console/layer-1/performance-monitor",
          icon: Activity,
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
        {
          title: "L1 Validator Balance",
          url: "/console/layer-1/l1-validator-balance",
          icon: Coins,
        },
        // Validators sub-group
        {
          id: "validators",
          title: "Validators",
          icon: Hexagon,
          items: [
            {
              title: "Validator Manager Setup",
              url: "/console/permissioned-l1s/validator-manager-setup",
              icon: SquareTerminal,
            },
            {
              title: "Multisig Setup",
              url: "/console/permissioned-l1s/multisig-setup",
              icon: ShieldUser,
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
              title: "Disable Validator",
              url: "/console/permissioned-l1s/disable-validator",
              icon: ShieldOff,
            },
            {
              title: "Change Validator Weight",
              url: "/console/permissioned-l1s/change-validator-weight",
              icon: SlidersVertical,
            },
            {
              title: "Remove Expired Registration",
              url: "/console/permissioned-l1s/remove-expired-validator-registration",
              icon: SquareMinus,
            },
          ],
        },
        // Tokenomics sub-group
        {
          id: "tokenomics",
          title: "Tokenomics",
          icon: Coins,
          items: [
            {
              title: "Fee Parameters",
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
        // Access Control sub-group
        {
          id: "access-control",
          title: "Access Control",
          icon: Shield,
          items: [
            {
              title: "Deployer Allowlist",
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
        // Staking sub-group (permissionless L1 operations)
        {
          id: "staking",
          title: "Staking",
          icon: HandCoins,
          items: [
            {
              title: "Staking Manager Setup",
              url: "/console/permissionless-l1s/staking-manager-setup",
              icon: GitMerge,
            },
            {
              title: "Native Staking Manager",
              url: "/console/permissionless-l1s/native-staking-manager-setup",
              icon: GitMerge,
            },
            {
              title: "Query PoS Validators",
              url: "/console/permissionless-l1s/query-pos-validator-set",
              icon: Hexagon,
            },
            {
              title: "Stake",
              url: "/console/permissionless-l1s/stake",
              icon: HandCoins,
            },
            {
              title: "Delegate",
              url: "/console/permissionless-l1s/delegate",
              icon: ArrowUpDown,
            },
            {
              title: "Withdraw",
              url: "/console/permissionless-l1s/withdraw",
              icon: SquareMinus,
            },
          ],
        },
      ],
    },
    // Cross-Chain
    {
      id: "cross-chain",
      title: "Cross-Chain",
      icon: ArrowLeftRight,
      items: [
        {
          title: "ICTT Setup",
          url: "/console/ictt/setup",
          icon: Workflow,
        },
        {
          title: "Token Transfer",
          url: "/console/ictt/token-transfer",
          icon: ArrowLeftRight,
        },
        {
          title: "ICM Setup",
          url: "/console/icm/setup",
          icon: SquareTerminal,
        },
        {
          title: "ICM Test",
          url: "/console/icm/test-connection",
          icon: MessagesSquare,
        },
      ],
    },
    // Tools & Utilities (merged testnet-infra + utilities)
    {
      id: "tools",
      title: "Tools",
      icon: Wrench,
      items: [
        {
          title: "Testnet Nodes",
          url: "/console/testnet-infra/nodes",
          icon: Server,
        },
        {
          title: "ICM Relayer",
          url: "/console/testnet-infra/icm-relayer",
          icon: Layers,
        },
        {
          title: "Format Converter",
          url: "/console/utilities/format-converter",
          icon: Wrench,
        },
        {
          title: "Transfer Proxy Admin",
          url: "/console/utilities/transfer-proxy-admin",
          icon: Wrench,
        },
        {
          title: "VMC Migration (V1 to V2)",
          url: "/console/utilities/vmcMigrateFromV1",
          icon: Wrench,
        },
        {
          title: "Revert PoA Manager",
          url: "/console/utilities/revert-poa-manager",
          icon: Wrench,
        },
      ],
    },
  ] as NavGroup[],
};

interface ConsoleSidebarProps extends React.ComponentProps<typeof Sidebar> {}

// Check if a group contains the active path
function groupContainsPath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => {
    if (isCollapsibleSubGroup(item)) {
      return item.items.some(
        (sub) => pathname === sub.url || pathname.startsWith(sub.url + "/")
      );
    }
    return pathname === item.url || pathname.startsWith(item.url + "/");
  });
}

// Collapsible Section Component
function CollapsibleSection({
  group,
  pathname,
  isOpen,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Auto-expand if the current path is inside this group
  const containsActive = groupContainsPath(group, pathname);
  const effectiveOpen = isOpen || containsActive;

  return (
    <Collapsible open={effectiveOpen} onOpenChange={onToggle}>
      <SidebarGroup className="py-1">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md transition-colors group/label font-semibold text-xs uppercase tracking-wide">
            <div className="flex items-center justify-between w-full">
              <span>{group.title}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 opacity-50 transition-transform duration-200",
                  effectiveOpen && "rotate-90"
                )}
              />
            </div>
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                if (isCollapsibleSubGroup(item)) {
                  return (
                    <CollapsibleSubGroupItem
                      key={item.id}
                      subGroup={item}
                      pathname={pathname}
                    />
                  );
                }
                return (
                  <NavMenuItem key={item.title} item={item} pathname={pathname} />
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

// Collapsible Sub-group Component (nested within a section)
function CollapsibleSubGroupItem({
  subGroup,
  pathname,
}: {
  subGroup: CollapsibleSubGroup;
  pathname: string;
}) {
  const { isCollapsed, toggleSection } = useSidebarStateContext();
  const subGroupId = `sub-${subGroup.id}`;

  // Check if any child is active
  const hasActiveChild = subGroup.items.some(
    (item) => pathname === item.url || pathname.startsWith(item.url + "/")
  );

  // Subgroups default collapsed — open if child is active or user explicitly expanded
  // (inverted: presence in collapsed set = user toggled open for subgroups)
  const isOpen = hasActiveChild || isCollapsed(subGroupId);

  return (
    <SidebarMenuItem>
      <Collapsible open={isOpen} onOpenChange={() => toggleSection(subGroupId)}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            size="sm"
            className={cn(
              "cursor-pointer text-sidebar-foreground/50 hover:text-sidebar-foreground font-medium",
              hasActiveChild && "text-sidebar-foreground"
            )}
          >
            <span>{subGroup.title}</span>
            <ChevronRight
              className={cn(
                "ml-auto h-3 w-3 opacity-40 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <SidebarMenuSub>
            {subGroup.items.map((item) => {
              const isActive =
                pathname === item.url || pathname.startsWith(item.url + "/");
              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "text-sidebar-foreground/50 hover:text-sidebar-foreground",
                      isActive && "text-sidebar-foreground"
                    )}
                  >
                    <Link href={item.url}>
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

// Map URLs to tour data attributes
const TOUR_DATA_ATTRS: Record<string, string> = {
  "/console/primary-network/faucet": "faucet-link",
  "/console/layer-1/create": "create-l1-link",
  "/console/blueprints": "blueprints-link",
};

// Single Nav Menu Item
function NavMenuItem({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
  const isComingSoon = item.comingSoon;
  const isExternal = item.url.startsWith("https://");
  const tourAttr = TOUR_DATA_ATTRS[item.url];

  return (
    <SidebarMenuItem data-tour={tourAttr}>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "text-sidebar-foreground/70 hover:text-sidebar-foreground",
          isActive && "text-sidebar-foreground",
          isComingSoon && "opacity-50 cursor-not-allowed"
        )}
        disabled={isComingSoon}
      >
        {isComingSoon ? (
          <span>
            <span>{item.title} (soon)</span>
          </span>
        ) : isExternal ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center w-full"
          >
            <span>{item.title}</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
          </a>
        ) : (
          <Link href={item.url}>
            <span>{item.title}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function ConsoleSidebar({ ...props }: ConsoleSidebarProps) {
  const pathname = usePathname();
  const sidebarState = useSidebarState();
  const { isCollapsed, toggleSection } = sidebarState;

  // Get wallet chain ID to determine if user is on an L1
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isConnectedToL1 =
    walletChainId !== 0 && !C_CHAIN_IDS.includes(walletChainId);

  return (
    <SidebarStateContext.Provider value={sidebarState}>
      <Sidebar {...props} data-tour="sidebar">
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
          <SidebarGroup className="pb-0">
            <SidebarMenu>
              {data.navMain.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      size="sm"
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-3.5 w-3.5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>

          {/* Navigation Groups with Collapsible Sections */}
          {data.navGroups.map((group) => {
            // Skip L1-only sections when not connected to L1
            if (group.requiresL1 && !isConnectedToL1) {
              return null;
            }

            const isOpen = !isCollapsed(group.id);

            return (
              <CollapsibleSection
                key={group.id}
                group={group}
                pathname={pathname}
                isOpen={isOpen}
                onToggle={() => toggleSection(group.id)}
              />
            );
          })}
        </SidebarContent>
      </Sidebar>
    </SidebarStateContext.Provider>
  );
}

// Export the navigation data for use in other components
export { data };
