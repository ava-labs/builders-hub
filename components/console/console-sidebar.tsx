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
  Network,
  GitMerge,
  Server,
  Telescope,
  ArrowLeftRight,
  Calculator,
  ShieldUser,
  SquareTerminal,
  Hexagon,
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
  Lock,
  BookOpen,
  Search,
  Star,
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
import { useFavoriteTools } from "@/hooks/useFavoriteTools";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { cn } from "@/lib/utils";
import { TOOLS as ALL_CONSOLE_TOOLS } from "@/components/toolbox/console/toolbox/tools";

// C-Chain chain IDs (Fuji testnet and Mainnet)
const C_CHAIN_IDS = [43113, 43114];

// Types for navigation structure
interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  sourceCategory?: string;
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
    // Getting started — entry points
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Rocket,
      items: [
        {
          title: "Create L1",
          url: "/console/create-l1",
          icon: Layers,
        },
        {
          title: "My L1 Dashboard",
          url: "/console/my-l1",
          icon: LayoutDashboard,
        },
        {
          title: "Testnet Faucet",
          url: "/console/primary-network/faucet",
          icon: Droplets,
        },
      ],
    },
    // Testnet Infrastructure — sits right after Getting Started because these
    // are the two entry points users return to after a Quick L1: the managed
    // node they just provisioned, and the relayer that drives ICM/ICTT for
    // it. The rest of the old Manage L1 group (Validator Set/Balance, Fee
    // Params) lives in /console/toolbox.
    {
      id: "testnet-infra",
      title: "Testnet Infrastructure",
      icon: Server,
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
      ],
    },
    // Primary Network
    {
      id: "primary-network",
      title: "Primary Network",
      icon: Network,
      defaultOpen: true,
      items: [
        {
          title: "Node Setup",
          url: "/console/primary-network/node-setup",
          icon: Server,
        },
        {
          title: "Stake AVAX",
          url: "/console/primary-network/stake",
          icon: HandCoins,
        },
        {
          title: "C/P Bridge",
          url: "/console/primary-network/c-p-bridge",
          icon: ArrowLeftRight,
        },
        {
          title: "Validator Alerts",
          url: "/console/primary-network/validator-alerts",
          icon: Bell,
        },
      ],
    },
    // Validators — flat list of the highest-traffic actions. Add Validator
    // is the canonical entry point for a freshly created PoA L1; Stake is
    // the equivalent for PoS-Native; Disable Validator is the consensus-
    // agnostic P-Chain exit. The full matrix (force-remove, change-weight,
    // delegations, ERC20-flavored variants, etc.) lives in /console/toolbox
    // so power users can still find them while the sidebar stays focused.
    {
      id: "validators",
      title: "Validators",
      icon: Hexagon,
      items: [
        {
          title: "Add Validator",
          url: "/console/permissioned-l1s/add-validator",
          icon: SquarePlus,
        },
        {
          title: "Stake",
          url: "/console/permissionless-l1s/stake/native",
          icon: HandCoins,
        },
        {
          title: "Disable Validator",
          url: "/console/permissioned-l1s/disable-validator",
          icon: ShieldOff,
        },
      ],
    },
    // Cross-Chain
    {
      id: "cross-chain",
      title: "Cross-Chain",
      icon: MessagesSquare,
      items: [
        {
          title: "ICM Setup",
          url: "/console/icm/setup",
          icon: MessagesSquare,
        },
        {
          title: "Token Bridge",
          url: "/console/ictt/setup",
          icon: Workflow,
        },
        {
          title: "Token Transfer",
          url: "/console/ictt/token-transfer",
          icon: ArrowLeftRight,
        },
      ],
    },
    // Encrypted ERC — slim to two entries: Overview (the in-page hub with
    // bubble nav for register / deposit / transfer / withdraw / balance /
    // auditor) and Deploy Your Own (the wizard for custom L1s). The full
    // sub-tool catalog lives in /console/toolbox under "Encrypted ERC".
    {
      id: "encrypted-erc",
      title: "Encrypted ERC",
      icon: Lock,
      items: [
        {
          title: "Overview",
          url: "/console/encrypted-erc/overview",
          icon: BookOpen,
        },
        {
          title: "Deploy Your Own",
          url: "/console/encrypted-erc/deploy",
          icon: Rocket,
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
  onUnpin,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onUnpin?: (path: string) => void;
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
                if (group.id === "pinned" && onUnpin) {
                  return (
                    <PinnedNavMenuItem
                      key={item.title}
                      item={item}
                      pathname={pathname}
                      onUnpin={onUnpin}
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

function PinnedNavMenuItem({
  item,
  pathname,
  onUnpin,
}: {
  item: NavItem;
  pathname: string;
  onUnpin: (path: string) => void;
}) {
  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
  const handleUnpin = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onUnpin(item.url);
  };

  return (
    <SidebarMenuItem>
      <div
        className={cn(
          "group/pinned flex min-h-9 items-center gap-1 rounded-md pr-1 text-sidebar-foreground/70 transition-colors",
          "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          isActive && "bg-sidebar-accent text-sidebar-foreground"
        )}
      >
        <Link href={item.url} className="flex min-w-0 flex-1 flex-col px-2 py-1.5">
          <span className="truncate text-sm leading-4">{item.title}</span>
          {item.sourceCategory && (
            <span className="truncate text-[10px] leading-3 text-sidebar-foreground/40">
              {item.sourceCategory}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={handleUnpin}
          title={`Unpin ${item.title}`}
          aria-label={`Unpin ${item.title} from sidebar`}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-500 transition-all",
            "opacity-100 hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            "sm:opacity-0 sm:group-hover/pinned:opacity-100 sm:focus-visible:opacity-100"
          )}
        >
          <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.5} />
        </button>
      </div>
    </SidebarMenuItem>
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
  "/console/create-l1": "create-l1-link",

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

// Search-result row variant. Same body as NavMenuItem, plus a trailing star
// button when the result corresponds to a pinnable tool — so users can pin
// from search without first navigating to the toolbox grid. Mandatory tools
// render the star as filled+disabled to communicate "already in your
// sidebar" without offering an unpin path.
function SearchResultMenuItem({
  item,
  pathname,
  isPinnable,
  isUserStarred,
  isMandatory,
  onTogglePin,
}: {
  item: NavItem;
  pathname: string;
  isPinnable: boolean;
  isUserStarred: boolean;
  isMandatory: boolean;
  onTogglePin: (path: string) => void;
}) {
  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
  const isComingSoon = item.comingSoon;
  const isExternal = item.url.startsWith("https://");
  const tourAttr = TOUR_DATA_ATTRS[item.url];
  const showStar = isPinnable && !isComingSoon && !isExternal;
  const isPinned = isUserStarred || isMandatory;

  const handlePinClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMandatory) return;
    onTogglePin(item.url);
  };

  const starTitle = isMandatory
    ? `${item.title} is already in the sidebar by default`
    : isUserStarred
      ? `Unpin ${item.title} from sidebar`
      : `Pin ${item.title} to sidebar`;

  if (!showStar) {
    return <NavMenuItem item={item} pathname={pathname} />;
  }

  return (
    <SidebarMenuItem data-tour={tourAttr}>
      <div
        className={cn(
          "group/searchresult flex min-h-9 items-center gap-1 rounded-md pr-1 text-sidebar-foreground/70 transition-colors",
          "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          isActive && "bg-sidebar-accent text-sidebar-foreground"
        )}
      >
        <Link
          href={item.url}
          className="flex min-w-0 flex-1 px-2 py-1.5 text-sm"
        >
          <span className="truncate">{item.title}</span>
        </Link>
        <button
          type="button"
          onClick={handlePinClick}
          disabled={isMandatory}
          title={starTitle}
          aria-label={starTitle}
          aria-pressed={isPinned}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isPinned
              ? "text-amber-500 opacity-100"
              : "text-sidebar-foreground/40 opacity-0 hover:text-sidebar-foreground group-hover/searchresult:opacity-100 focus-visible:opacity-100",
            isMandatory && "cursor-not-allowed opacity-60",
            !isMandatory && "hover:bg-sidebar-accent"
          )}
        >
          <Star
            className="h-3.5 w-3.5"
            fill={isPinned ? "currentColor" : "none"}
            strokeWidth={isPinned ? 1.5 : 2}
          />
        </button>
      </div>
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

  // User-pinned tools from the toolbox. Mandatory tools are already in the
  // canonical sidebar groups below; we only inject what the user explicitly
  // starred and isn't already pinned by the static navigation.
  const {
    userStarred,
    isHydrated: favoritesHydrated,
    isUserStarred,
    isMandatory: isMandatoryTool,
    toggle: toggleFavoriteTool,
  } = useFavoriteTools();

  // Set of every toolbox tool path — used by search results to decide
  // whether a hit is "pinnable" (i.e., backed by a real tool) and should
  // surface the star toggle. Pure-navigation hits (e.g. "Console" home)
  // don't pin meaningfully so they get no star.
  const toolPaths = React.useMemo(
    () =>
      new Set(
        ALL_CONSOLE_TOOLS.filter((t) => !t.external).map((t) => t.path),
      ),
    [],
  );

  const starredGroup = React.useMemo<NavGroup | null>(() => {
    if (!favoritesHydrated || userStarred.length === 0) return null;
    const items: NavItem[] = [];
    for (const path of userStarred) {
      const tool = ALL_CONSOLE_TOOLS.find((t) => t.path === path);
      if (!tool || tool.external) continue;
      items.push({
        title: tool.name,
        url: tool.path,
        icon: tool.icon,
        sourceCategory: tool.category,
      });
    }
    if (items.length === 0) return null;
    return {
      id: 'pinned',
      title: 'Pinned',
      icon: Star,
      defaultOpen: true,
      items,
    };
  }, [userStarred, favoritesHydrated]);

  // "Create L1" is a single sidebar entry. When an in-progress flow exists,
  // the `/console/create-l1` page itself auto-redirects to the resume step,
  // so we no longer inject a separate "Resume" item here.
  // Inject the user's Starred group at the top so pinned tools always render
  // ahead of the canonical sidebar nav.
  const navGroups = React.useMemo(
    () => (starredGroup ? [starredGroup, ...data.navGroups] : data.navGroups),
    [starredGroup],
  );

  // Flatten all searchable items, tracking their category path. The sidebar
  // surfaces a curated subset; the toolbox grid is the source of truth for
  // every console tool. Merge both so search results stay complete even when
  // an item isn't pinned to the sidebar (e.g. encrypted-erc sub-tools after
  // the group was slimmed to Overview + Deploy).
  const allNavItems = React.useMemo(() => {
    const items: SearchableNavItem[] = [];
    const seenUrls = new Set<string>();

    const push = (item: SearchableNavItem) => {
      if (seenUrls.has(item.url)) return;
      seenUrls.add(item.url);
      items.push(item);
    };

    data.navMain.forEach((item) => push({ ...item, category: "" }));
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (isCollapsibleSubGroup(item)) {
          const category = `${group.title} › ${item.title}`;
          item.items.forEach((subItem) => push({ ...subItem, category }));
        } else {
          push({ ...item, category: group.title });
        }
      });
    });

    // Append every toolbox entry not already pinned to the sidebar. The
    // "Toolbox › <category>" prefix flags it visually in the search results
    // so users know they're reaching beyond the sidebar tree.
    ALL_CONSOLE_TOOLS.forEach((tool) => {
      if (tool.external) return;
      push({
        title: tool.name,
        url: tool.path,
        icon: tool.icon,
        category: `Toolbox › ${tool.category}`,
      });
    });

    return items;
  }, [navGroups]);

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
              className="w-full rounded-md border border-sidebar-border bg-sidebar-accent/50 pl-8 pr-8 py-1.5 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none focus:ring-1 focus:ring-sidebar-ring focus:bg-sidebar-accent/70 focus:border-sidebar-ring transition-colors"
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
                            <SearchResultMenuItem
                              key={item.url}
                              item={item}
                              pathname={pathname}
                              isPinnable={
                                toolPaths.has(item.url) || isMandatoryTool(item.url)
                              }
                              isUserStarred={isUserStarred(item.url)}
                              isMandatory={isMandatoryTool(item.url)}
                              onTogglePin={toggleFavoriteTool}
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
              {navGroups.map((group) => {
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
                    onUnpin={group.id === "pinned" ? toggleFavoriteTool : undefined}
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
