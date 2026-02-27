"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  HandCoins,
  BookKey,
  ShieldOff,
  Activity,
  Clock,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Navigation items matching console-sidebar.tsx
interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
  group?: string;
}

const navigationItems: NavigationItem[] = [
  // Main navigation
  { title: "Home", url: "/console", icon: Home, keywords: ["dashboard", "start", "main"], group: "Navigation" },

  // Primary Network
  { title: "Data API Keys", url: "/console/utilities/data-api-keys", icon: BookKey, keywords: ["api", "key", "data", "access"], group: "Primary Network" },
  { title: "Node Setup", url: "/console/primary-network/node-setup", icon: Server, keywords: ["node", "setup", "install", "validator"], group: "Primary Network" },
  { title: "Stake", url: "/console/primary-network/stake", icon: HandCoins, keywords: ["stake", "staking", "delegate", "validator"], group: "Primary Network" },
  { title: "Testnet Faucet", url: "/console/primary-network/faucet", icon: Droplets, keywords: ["faucet", "testnet", "avax", "free", "tokens"], group: "Primary Network" },
  { title: "C/P-Chain Bridge", url: "/console/primary-network/c-p-bridge", icon: ArrowLeftRight, keywords: ["bridge", "transfer", "c-chain", "p-chain", "cross"], group: "Primary Network" },
  { title: "AVAX Unit Converter", url: "/console/primary-network/unit-converter", icon: Calculator, keywords: ["convert", "unit", "avax", "navax", "wei", "gwei"], group: "Primary Network" },

  // Layer 1
  { title: "Create New L1", url: "/console/layer-1/create", icon: Layers, keywords: ["create", "l1", "layer", "subnet", "new", "blockchain"], group: "Layer 1" },
  { title: "L1 Node Setup", url: "/console/layer-1/l1-node-setup", icon: Server, keywords: ["node", "setup", "l1", "validator"], group: "Layer 1" },
  { title: "L1 Validator Balance", url: "/console/layer-1/l1-validator-balance", icon: Coins, keywords: ["validator", "balance", "stake", "l1"], group: "Layer 1" },
  { title: "Explorer Setup", url: "/console/layer-1/explorer-setup", icon: Telescope, keywords: ["explorer", "block", "transactions", "setup"], group: "Layer 1" },
  { title: "Performance Monitor", url: "/console/layer-1/performance-monitor", icon: Activity, keywords: ["performance", "monitor", "metrics", "stats"], group: "Layer 1" },

  // Free Testnet Infrastructure
  { title: "Testnet Nodes", url: "/console/testnet-infra/nodes", icon: Layers, keywords: ["testnet", "nodes", "free", "infrastructure"], group: "Testnet Infrastructure" },
  { title: "ICM Relayer", url: "/console/testnet-infra/icm-relayer", icon: Layers, keywords: ["icm", "relayer", "messaging", "testnet"], group: "Testnet Infrastructure" },

  // L1 Tokenomics
  { title: "Transaction Fee Parameters", url: "/console/l1-tokenomics/fee-manager", icon: Coins, keywords: ["fee", "gas", "transaction", "tokenomics"], group: "L1 Tokenomics" },
  { title: "Fee Distributions", url: "/console/l1-tokenomics/reward-manager", icon: Coins, keywords: ["fee", "distribution", "rewards", "tokenomics"], group: "L1 Tokenomics" },
  { title: "Mint Native Coins", url: "/console/l1-tokenomics/native-minter", icon: Coins, keywords: ["mint", "native", "coins", "tokens", "create"], group: "L1 Tokenomics" },

  // Permissioned L1s
  { title: "Validator Manager Setup", url: "/console/permissioned-l1s/validator-manager-setup", icon: SquareTerminal, keywords: ["validator", "manager", "setup", "permissioned"], group: "Permissioned L1s" },
  { title: "Multisig Setup", url: "/console/permissioned-l1s/multisig-setup", icon: ShieldUser, keywords: ["multisig", "multi-signature", "setup", "security"], group: "Permissioned L1s" },
  { title: "Query Validator Set", url: "/console/layer-1/validator-set", icon: Hexagon, keywords: ["validator", "set", "query", "list"], group: "Permissioned L1s" },
  { title: "Add Validator", url: "/console/permissioned-l1s/add-validator", icon: SquarePlus, keywords: ["add", "validator", "new", "register"], group: "Permissioned L1s" },
  { title: "Remove Validator", url: "/console/permissioned-l1s/remove-validator", icon: SquareMinus, keywords: ["remove", "validator", "delete"], group: "Permissioned L1s" },
  { title: "Disable Validator", url: "/console/permissioned-l1s/disable-validator", icon: ShieldOff, keywords: ["disable", "validator", "pause"], group: "Permissioned L1s" },
  { title: "Change Validator Weight", url: "/console/permissioned-l1s/change-validator-weight", icon: SlidersVertical, keywords: ["weight", "validator", "change", "update"], group: "Permissioned L1s" },
  { title: "Remove Expired Validator Registration", url: "/console/permissioned-l1s/remove-expired-validator-registration", icon: SquareMinus, keywords: ["expired", "validator", "remove", "registration"], group: "Permissioned L1s" },

  // L1 Access Restrictions
  { title: "Contract Deployer Allowlist", url: "/console/l1-access-restrictions/deployer-allowlist", icon: ShieldCheck, keywords: ["deployer", "allowlist", "contract", "permission"], group: "L1 Access Restrictions" },
  { title: "Transactor Allowlist", url: "/console/l1-access-restrictions/transactor-allowlist", icon: ShieldUser, keywords: ["transactor", "allowlist", "permission", "access"], group: "L1 Access Restrictions" },

  // Permissionless L1s
  { title: "Native Staking Manager Setup", url: "/console/permissionless-l1s/native-staking-manager-setup", icon: GitMerge, keywords: ["staking", "manager", "native", "permissionless"], group: "Permissionless L1s" },

  // Interchain Messaging
  { title: "ICM Setup", url: "/console/icm/setup", icon: SquareTerminal, keywords: ["icm", "interchain", "messaging", "setup"], group: "Interchain Messaging" },
  { title: "ICM Test Connection", url: "/console/icm/test-connection", icon: MessagesSquare, keywords: ["icm", "test", "connection", "ping"], group: "Interchain Messaging" },

  // Interchain Token Transfer
  { title: "ICTT Setup", url: "/console/ictt/setup", icon: Network, keywords: ["ictt", "workbench", "visual", "bridge", "drag", "drop", "wizard", "playground", "setup", "token", "transfer"], group: "Token Transfer" },
  { title: "Token Transfer", url: "/console/ictt/token-transfer", icon: ArrowLeftRight, keywords: ["token", "transfer", "bridge", "send"], group: "Token Transfer" },

  // Utilities
  { title: "Format Converter", url: "/console/utilities/format-converter", icon: Wrench, keywords: ["format", "convert", "address", "hex", "bech32"], group: "Utilities" },
  { title: "Transfer Proxy Admin", url: "/console/utilities/transfer-proxy-admin", icon: Wrench, keywords: ["proxy", "admin", "transfer", "ownership"], group: "Utilities" },
  { title: "VMC Migration V1 to V2", url: "/console/utilities/vmcMigrateFromV1", icon: Wrench, keywords: ["vmc", "migrate", "v1", "v2", "upgrade"], group: "Utilities" },
  { title: "Revert PoA Manager", url: "/console/utilities/revert-poa-manager", icon: Wrench, keywords: ["poa", "manager", "revert", "rollback"], group: "Utilities" },
];

// Recent pages store
interface RecentPagesStore {
  recentPages: Array<{ url: string; title: string; timestamp: number }>;
  addRecentPage: (url: string, title: string) => void;
}

const MAX_RECENT_PAGES = 5;

export const useRecentPagesStore = create<RecentPagesStore>()(
  persist(
    (set) => ({
      recentPages: [],
      addRecentPage: (url, title) => {
        set((state) => {
          // Remove existing entry with same URL
          const filtered = state.recentPages.filter((p) => p.url !== url);
          // Add new entry at the beginning
          const newPages = [{ url, title, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_PAGES);
          return { recentPages: newPages };
        });
      },
    }),
    {
      name: "console-recent-pages",
    }
  )
);

// Command palette open state
interface CommandPaletteStore {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

export function CommandPalette() {
  const router = useRouter();
  const { isOpen, setIsOpen } = useCommandPaletteStore();
  const { recentPages, addRecentPage } = useRecentPagesStore();

  // Keyboard shortcut handler
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, setIsOpen]);

  const handleSelect = (item: NavigationItem) => {
    addRecentPage(item.url, item.title);
    router.push(item.url);
    setIsOpen(false);
  };

  const handleSelectRecent = (url: string) => {
    router.push(url);
    setIsOpen(false);
  };

  // Group navigation items by group
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, NavigationItem[]> = {};
    navigationItems.forEach((item) => {
      const group = item.group || "Other";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
    });
    return groups;
  }, []);

  return (
    <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
      <CommandInput placeholder="Search console pages..." />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-4">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p>No results found.</p>
            <p className="text-sm text-muted-foreground">Try searching for "faucet", "validator", or "bridge"</p>
          </div>
        </CommandEmpty>

        {/* Recent Pages */}
        {recentPages.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentPages.map((page) => (
                <CommandItem
                  key={page.url}
                  value={`recent-${page.url}`}
                  onSelect={() => handleSelectRecent(page.url)}
                  className="cursor-pointer"
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{page.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Grouped Navigation Items */}
        {Object.entries(groupedItems).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => (
              <CommandItem
                key={item.url}
                value={`${item.title} ${item.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(item)}
                className="cursor-pointer"
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>

      <div className="border-t p-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              <span className="text-xs">
                {typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac') ? '\u2318' : 'Ctrl'}
              </span>
            </kbd>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">K</kbd>
            <span>to open</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              <span className="text-xs">\u2191</span>
            </kbd>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              <span className="text-xs">\u2193</span>
            </kbd>
            <span>to navigate</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd>
            <span>to select</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}

// Trigger button component
export function CommandPaletteTrigger() {
  const { setIsOpen } = useCommandPaletteStore();
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(navigator.platform?.toLowerCase().includes('mac') ?? false);
  }, []);

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
        {isMac ? "\u2318" : "Ctrl"}K
      </kbd>
    </button>
  );
}
