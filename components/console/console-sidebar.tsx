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
  LayoutGrid,
  Workflow,

  Search,
  X,
  Bell,
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

interface SearchableNavItem extends NavItem {
  category: string;
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

// Navigation data structure
const data = {
  navMain: [
    {
      title: "Home",
      url: "/console",
      icon: Home,
    },
    {
      title: "Toolbox",
      url: "/console/toolbox",
      icon: LayoutGrid,
    },
  ],
  navGroups: [
    // Primary Network — the starting point for all developers
    {
      id: "primary-network",
      title: "Primary Network",
      icon: Network,
      items: [
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
        {
          title: "Data API Keys",
          url: "/console/utilities/data-api-keys",
          icon: BookKey,
        },
        {
          title: "Stake AVAX",
          url: "/console/primary-network/stake",
          icon: HandCoins,
        },
        {
          title: "Node Setup",
          url: "/console/primary-network/node-setup",
          icon: Server,
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
          title: "Validator Lookup",
          url: "/console/primary-network/validator-lookup",
          icon: Search,
        },
        {
          title: "Validator Alerts",
          url: "/console/primary-network/validator-alerts",
          icon: Bell,
        },
      ],
    },
    // Create & Deploy — L1 lifecycle entry point
    {
      id: "create-deploy",
      title: "Create & Deploy",
      icon: Rocket,
      items: [
        {
          title: "Create L1",
          url: "/console/layer-1/create",
          icon: Layers,
        },
        {
          title: "My L1 Dashboard",
          url: "/console/my-l1",
          icon: LayoutDashboard,
        },
      ],
    },
    // Permissioned L1s — admin-controlled validator management
    {
      id: "permissioned-l1s",
      title: "Permissioned L1s",
      icon: Shield,
      items: [
        {
          id: "permissioned-setup",
          title: "Setup",
          icon: SquareTerminal,
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
          ],
        },
        {
          id: "permissioned-manage",
          title: "Manage Validators",
          icon: Hexagon,
          items: [
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
            {
              title: "Disable Validator",
              url: "/console/permissioned-l1s/disable-validator",
              icon: ShieldOff,
            },
            {
              title: "Remove Expired Registration",
              url: "/console/permissioned-l1s/remove-expired-validator-registration",
              icon: SquareMinus,
            },
          ],
        },
      ],
    },
    // Permissionless L1s — open staking and delegation
    {
      id: "permissionless-l1s",
      title: "Permissionless L1s",
      icon: HandCoins,
      items: [
        {
          id: "permissionless-setup",
          title: "Setup",
          icon: GitMerge,
          items: [
            {
              title: "Native Staking Manager Setup",
              url: "/console/permissionless-l1s/native-staking-manager-setup",
              icon: GitMerge,
            },
            {
              title: "ERC20 Staking Manager Setup",
              url: "/console/permissionless-l1s/erc20-staking-manager-setup",
              icon: GitMerge,
            },
          ],
        },
        {
          id: "permissionless-stake",
          title: "Stake & Delegate",
          icon: HandCoins,
          items: [
            {
              title: "Stake (Native Token)",
              url: "/console/permissionless-l1s/stake/native",
              icon: HandCoins,
            },
            {
              title: "Stake (ERC20 Token)",
              url: "/console/permissionless-l1s/stake/erc20",
              icon: HandCoins,
            },
            {
              title: "Delegate (Native Token)",
              url: "/console/permissionless-l1s/delegate/native",
              icon: ArrowUpDown,
            },
            {
              title: "Delegate (ERC20 Token)",
              url: "/console/permissionless-l1s/delegate/erc20",
              icon: ArrowUpDown,
            },
          ],
        },
        {
          id: "permissionless-withdraw",
          title: "Withdraw",
          icon: SquareMinus,
          items: [
            {
              title: "Remove Validator",
              url: "/console/permissionless-l1s/remove-validator",
              icon: SquareMinus,
            },
            {
              title: "Remove Delegation",
              url: "/console/permissionless-l1s/remove-delegation",
              icon: SquareMinus,
            },
          ],
        },
      ],
    },
    // Interchain Messaging — cross-chain communication
    {
      id: "cross-chain",
      title: "Interchain Messaging",
      icon: ArrowLeftRight,
      items: [
        {
          id: "icm-setup",
          title: "Setup",
          icon: MessagesSquare,
          items: [
            {
              title: "ICM Setup",
              url: "/console/icm/setup",
              icon: MessagesSquare,
            },
            {
              title: "ICTT Setup",
              url: "/console/ictt/setup",
              icon: Workflow,
            },
          ],
        },
        {
          title: "Token Transfer Test",
          url: "/console/ictt/token-transfer",
          icon: ArrowLeftRight,
        },
      ],
    },
    // L1 Management — configure and monitor your running L1
    {
      id: "l1-management",
      title: "L1 Management",
      icon: Box,
      items: [
        {
          id: "infrastructure",
          title: "Infrastructure",
          icon: Server,
          items: [
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
              title: "Performance Monitor",
              url: "/console/layer-1/performance-monitor",
              icon: Activity,
            },
          ],
        },
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
        {
          title: "Query Validator Set",
          url: "/console/layer-1/validator-set",
          icon: Hexagon,
        },
        {
          title: "L1 Validator Balance",
          url: "/console/layer-1/l1-validator-balance",
          icon: Coins,
        },
      ],
    },
    // Utilities — tools and infra helpers
    {
      id: "utilities",
      title: "Utilities",
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
          title: "Unit Converter",
          url: "/console/primary-network/unit-converter",
          icon: Calculator,
        },
        {
          title: "Transfer Proxy Admin",
          url: "/console/utilities/transfer-proxy-admin",
          icon: Wrench,
        },
        {
          title: "VMC Migration (V1 → V2)",
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
  const sidebarState = useSidebarState(["primary-network"]);
  const { isCollapsed, toggleSection } = sidebarState;

  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Get wallet chain ID to determine if user is on an L1
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const isConnectedToL1 =
    walletChainId !== 0 && !C_CHAIN_IDS.includes(walletChainId);

  // Flatten all nav items for search, tracking their category path
  const allNavItems = React.useMemo(() => {
    const items: SearchableNavItem[] = [];
    data.navMain.forEach((item) =>
      items.push({ ...item, category: "" })
    );
    data.navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (isCollapsibleSubGroup(item)) {
          const category = `${group.title} › ${item.title}`;
          item.items.forEach((subItem) =>
            items.push({ ...subItem, category })
          );
        } else {
          items.push({ ...item, category: group.title });
        }
      });
    });
    return items;
  }, []);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allNavItems.filter((item) =>
      item.title.toLowerCase().includes(query)
    );
  }, [searchQuery, allNavItems]);

  const isSearching = searchQuery.trim().length > 0;

  // Clear search on navigation
  React.useEffect(() => {
    setSearchQuery("");
  }, [pathname]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      searchInputRef.current?.blur();
    }
  };

  return (
    <SidebarStateContext.Provider value={sidebarState}>
      <Sidebar {...props} data-tour="sidebar">
        <SidebarHeader className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/40" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full rounded-md border border-sidebar-border bg-transparent pl-8 pr-8 py-1.5 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {isSearching ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.length > 0 ? (
                    (() => {
                      const grouped: { category: string; items: SearchableNavItem[] }[] = [];
                      filteredItems.forEach((item) => {
                        const last = grouped[grouped.length - 1];
                        if (last && last.category === item.category) {
                          last.items.push(item);
                        } else {
                          grouped.push({ category: item.category, items: [item] });
                        }
                      });
                      return grouped.map((group) => (
                        <React.Fragment key={group.category || "_root"}>
                          {group.category && (
                            <div className="px-3 pt-3 pb-1 text-xs font-medium text-sidebar-foreground/40">
                              {group.category}
                            </div>
                          )}
                          {group.items.map((item) => (
                            <NavMenuItem
                              key={item.url}
                              item={item}
                              pathname={pathname}
                            />
                          ))}
                        </React.Fragment>
                      ));
                    })()
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-sidebar-foreground/40">
                      No results for &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <>
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
            </>
          )}
        </SidebarContent>
      </Sidebar>
    </SidebarStateContext.Provider>
  );
}

// Export the navigation data for use in other components
export { data };
