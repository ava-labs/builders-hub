"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Home,
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
import { TOOLS as ALL_CONSOLE_TOOLS } from "@/components/toolbox/console/toolbox/tools";

// Navigation items matching console-sidebar.tsx
interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
  group?: string;
}

// Static items that aren't tools (e.g. the console home dashboard) and so
// don't appear in `ALL_CONSOLE_TOOLS`. Everything else is derived from the
// canonical tools registry below — that's the same source the sidebar
// search uses, so palette + sidebar stay in sync automatically.
const STATIC_NAV_ITEMS: NavigationItem[] = [
  {
    title: "Home",
    url: "/console",
    icon: Home,
    keywords: ["dashboard", "start", "main"],
    group: "Navigation",
  },
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

  // Build the canonical nav list from the same `TOOLS` registry the sidebar
  // search uses. We strip externals (router.push can't open https:// URLs)
  // and concat the static entries (Home) at the front. Mapping the shape:
  //   ToolCard.name        -> NavigationItem.title
  //   ToolCard.path        -> NavigationItem.url
  //   ToolCard.category    -> NavigationItem.group
  //   ToolCard.icon        -> NavigationItem.icon
  //   ToolCard.description -> NavigationItem.keywords (split into tokens for
  //                           cmdk's substring matcher)
  const navigationItems = React.useMemo<NavigationItem[]>(() => {
    const fromTools = ALL_CONSOLE_TOOLS.filter((t) => !t.external).map(
      (t) => ({
        title: t.name,
        url: t.path,
        icon: t.icon,
        group: t.category,
        keywords: t.description
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2),
      }),
    );
    return [...STATIC_NAV_ITEMS, ...fromTools];
  }, []);

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
  }, [navigationItems]);

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
