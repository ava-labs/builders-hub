'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Home, Search, type LucideIcon } from 'lucide-react';
import { defaultFilter, useCommandState } from 'cmdk';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOOLS as ALL_CONSOLE_TOOLS } from '@/components/toolbox/console/toolbox/tools';

// Navigation items matching console-sidebar.tsx
interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string[];
  group?: string;
}

// Static items that aren't tools (e.g. the console home dashboard) and so
// don't appear in `ALL_CONSOLE_TOOLS`. Everything else comes from the
// canonical tools registry, the same source that the sidebar search uses,
// so palette and sidebar stay in sync automatically.
const STATIC_NAV_ITEMS: NavigationItem[] = [
  {
    title: 'Home',
    url: '/console',
    icon: Home,
    keywords: ['dashboard', 'start', 'main'],
    group: 'Navigation',
  },
];

// The canonical nav list, from the same `TOOLS` registry that the sidebar
// search uses. Externals are removed (router.push can't open https:// URLs),
// and the static entries (Home) come first. Mapping the shape:
//   ToolCard.name        -> NavigationItem.title
//   ToolCard.path        -> NavigationItem.url
//   ToolCard.category    -> NavigationItem.group
//   ToolCard.icon        -> NavigationItem.icon
//   ToolCard.description -> NavigationItem.keywords (one keyword per word)
// The title is the cmdk item value, so each title must be unique.
export const PALETTE_ITEMS: NavigationItem[] = [
  ...STATIC_NAV_ITEMS,
  ...ALL_CONSOLE_TOOLS.filter((t) => !t.external).map((t) => ({
    title: t.name,
    url: t.path,
    icon: t.icon,
    group: t.category,
    keywords: t.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  })),
];

/**
 * Ranks a palette item for cmdk. The item value is the title, and the
 * keywords are the words of the description. cmdk's default filter scores
 * the value and the keywords as one string, so a description word can put a
 * tool above the tool whose title matches. Here a title match scores in
 * (0.5, 1] and a keyword-only match scores in (0, 0.5], so title matches
 * always come first.
 */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const titleScore = defaultFilter(value, search);
  if (titleScore > 0) return 0.5 + titleScore / 2;
  return defaultFilter(value, search, keywords) / 2;
}

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
      name: 'console-recent-pages',
    },
  ),
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

type PaletteGroup = [heading: string, items: NavigationItem[]];

// Group navigation items by group
export const PALETTE_GROUPS: PaletteGroup[] = Object.entries(
  PALETTE_ITEMS.reduce<Record<string, NavigationItem[]>>((groups, item) => {
    const group = item.group || 'Other';
    (groups[group] ??= []).push(item);
    return groups;
  }, {}),
);

/**
 * The groups and their items in display order. While a search runs, the group
 * with the best match comes first, and each group lists its best match first,
 * so the first item (the one that cmdk selects) is the best match. cmdk 1.1.1
 * does not move the groups: it looks a group up by its id, and the group
 * element holds its heading. It sorts the items of a group once per search
 * change, but an item that a new search shows again mounts later, in render
 * order (for example after a paste over another search). So the render order
 * is the score order too. The sorts are stable: equal scores keep their order.
 */
export function orderPaletteGroups(groups: PaletteGroup[], search: string): PaletteGroup[] {
  if (!search) return groups;
  return groups
    .map(([heading, items]) => {
      const scored = items
        .map((item) => ({ item, score: paletteFilter(item.title, search, item.keywords) }))
        .sort((a, b) => b.score - a.score);
      return { group: [heading, scored.map(({ item }) => item)] as PaletteGroup, score: scored[0]?.score ?? 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ group }) => group);
}

/** The tool groups, ordered by the current search. */
function NavigationGroups({ onSelect }: { onSelect: (item: NavigationItem) => void }) {
  const search = useCommandState((state) => state.search);
  const groups = React.useMemo(() => orderPaletteGroups(PALETTE_GROUPS, search), [search]);
  return groups.map(([group, items]) => (
    <CommandGroup key={group} heading={group}>
      {items.map((item) => (
        <CommandItem
          // Two tools can share a URL (Add Validator and the Stake tools), so the unique title is the key.
          key={item.title}
          value={item.title}
          keywords={item.keywords}
          onSelect={() => onSelect(item)}
          className="cursor-pointer"
        >
          <item.icon className="mr-2 h-4 w-4" />
          <span>{item.title}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  ));
}

/**
 * The recent pages, shown only while the search is empty. Their values are
 * URLs, so a search would match URL text instead of page names.
 */
function RecentPagesGroup({ onSelect }: { onSelect: (url: string) => void }) {
  const search = useCommandState((state) => state.search);
  const recentPages = useRecentPagesStore((s) => s.recentPages);
  if (search || recentPages.length === 0) return null;
  return (
    <>
      <CommandGroup heading="Recent">
        {recentPages.map((page) => (
          <CommandItem
            key={page.url}
            value={`recent-${page.url}`}
            onSelect={() => onSelect(page.url)}
            className="cursor-pointer"
          >
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>{page.title}</span>
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandSeparator />
    </>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const setIsOpen = useCommandPaletteStore((s) => s.setIsOpen);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const addRecentPage = useRecentPagesStore((s) => s.addRecentPage);

  // Keyboard shortcut handler. The fumadocs docs search (RootProvider wraps
  // every route) listens for the same Cmd/Ctrl+K on window in the bubble
  // phase. This listener runs first, in the capture phase on document, and
  // stops the event, so only the palette opens on Console pages. Other
  // pages do not mount the palette, so Cmd/Ctrl+K there opens the docs search.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };

    document.addEventListener('keydown', down, true);
    return () => document.removeEventListener('keydown', down, true);
  }, [toggle]);

  const handleSelect = (item: NavigationItem) => {
    addRecentPage(item.url, item.title);
    router.push(item.url);
    setIsOpen(false);
  };

  const handleSelectRecent = (url: string) => {
    router.push(url);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Palette</DialogTitle>
          <DialogDescription>Search for a command to run...</DialogDescription>
        </DialogHeader>
        <Command
          filter={paletteFilter}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput placeholder="Search console pages..." />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-4">
                <Search className="h-8 w-8 text-muted-foreground" />
                <p>No results found.</p>
                <p className="text-sm text-muted-foreground">Try searching for "faucet", "validator", or "bridge"</p>
              </div>
            </CommandEmpty>

            <RecentPagesGroup onSelect={handleSelectRecent} />

            {/* Grouped Navigation Items */}
            <NavigationGroups onSelect={handleSelect} />
          </CommandList>

          <div className="border-t p-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  <span className="text-xs">
                    {typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac')
                      ? '⌘'
                      : 'Ctrl'}
                  </span>
                </kbd>
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">K</kbd>
                <span>to open</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  <span className="text-xs">{'↑'}</span>
                </kbd>
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  <span className="text-xs">{'↓'}</span>
                </kbd>
                <span>to navigate</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd>
                <span>to select</span>
              </div>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
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
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  );
}
