'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Search, X } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { isPrimaryNetwork, type CombinedL1 } from '@/lib/console/my-l1/types';
import {
  chainKey,
  useChainOrderStore,
  useHiddenL1s,
} from '@/lib/console/my-l1/chainOrderStore';

// ---------------------------------------------------------------------
// Tinted fallback avatars
// ---------------------------------------------------------------------
//
// Most managed L1s come through without a `logoUrl` (the upstream service
// doesn't publish brand assets), so we fall back to a coloured initials
// square. Five-tone palette + four well-known overrides is enough to
// keep adjacent pills visually distinct without hand-curating every chain.

const FALLBACK_BGS = [
  'bg-rose-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
] as const;

const KNOWN_CHAIN_BGS: Record<string, (typeof FALLBACK_BGS)[number]> = {
  '11111111111111111111111111111111LpoYY': 'bg-rose-500', // C-Chain (AVAX red)
  i9gFpZQHPLcGfZaQLiwFAStddQD7iTKBpFfurPFJsXm1CkTZK: 'bg-emerald-500', // Echo
  '7WtoAMPhrmh5KosDUsFL9yTcvw7YSxiKHPpdfs4JsgW47oZT5': 'bg-violet-500', // Dispatch
  '9m6a3Qte8FaRbLZixLhh8Ptdkemm4csNaLwQeKkENx5wskbWP': 'bg-rose-500', // Dexalot
};

function pickFallbackBg(subnetId: string): string {
  const known = KNOWN_CHAIN_BGS[subnetId];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < subnetId.length; i++) hash = (hash * 31 + subnetId.charCodeAt(i)) >>> 0;
  return FALLBACK_BGS[hash % FALLBACK_BGS.length]!;
}

// "Avalanche Fuji" → "AF"; "Echo" → "Ec"; missing → "?".
function chainInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

/** Chain count above which the rail surfaces a search field. Below this
 *  the rail stays clean — most users have 2-6 chains and don't need a
 *  filter eating vertical space. */
const SEARCH_THRESHOLD = 8;

// ---------------------------------------------------------------------
// SwitchChainRail
// ---------------------------------------------------------------------
//
// Horizontal row of chain "pills" — each shows a small logo on the left
// and the chain name on the right, like an account chip. Active pill
// picks up the emerald accent that matches the rest of the dashboard's
// "this is the live thing" cue.
//
// Differences from the v1 marquee rail:
//   - No marquee. v1 auto-scrolled every L1 past the user, which made
//     scanning impossible and broke "which chain am I on?". Replaced
//     with native horizontal scroll plus edge-fade gradients and
//     scroll-arrow buttons that fade in only when there's overflow.
//   - Logo + name (vs name only). Adjacent pills don't visually repeat
//     anymore — each chain has its own colour or logo.
//   - Search field appears above 8 chains so power-users can filter.

export function SwitchChainRail({
  l1s,
  selected,
  onSelect,
}: {
  l1s: CombinedL1[];
  selected: CombinedL1 | null;
  onSelect: (l1: CombinedL1) => void;
}) {
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const l1ListStore = useL1ListStore();
  const chainOrderStore = useChainOrderStore();
  const hiddenL1s = useHiddenL1s();

  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // PointerSensor's distance constraint preserves click-to-select alongside
  // drag-to-reorder: drag only fires after 8px of pointer travel.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const showSearch = l1s.length > SEARCH_THRESHOLD;

  const filteredL1s = useMemo(() => {
    if (!showSearch || query.trim() === '') return l1s;
    const needle = query.toLowerCase();
    return l1s.filter(
      (l1) =>
        l1.chainName.toLowerCase().includes(needle) ||
        String(l1.evmChainId ?? '').includes(needle),
    );
  }, [l1s, query, showSearch]);

  // Scroll-arrow / edge-fade visibility tracks the rail's actual scroll
  // position. ResizeObserver catches viewport resizes; scroll listener
  // catches user scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      // Tiny epsilon (4px) so a hairline scrollLeft from layout rounding
      // doesn't keep the left arrow visible when the user is logically
      // at the start.
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [filteredL1s.length]);

  // Auto-scroll the active pill into view when selection changes —
  // skipping the first render so the rail doesn't yank itself before
  // the user has done anything. Looks up the active pill via
  // `data-active="true"` so we don't have to plumb refs through the
  // sortable wrapper.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const active = scrollRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selected?.subnetId, selected?.evmChainId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Persist against the FULL list so search filtering doesn't drop
    // out-of-view chains from the saved order.
    const allKeys = l1s.map(chainKey);
    const oldIndex = allKeys.indexOf(active.id as string);
    const newIndex = allKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    chainOrderStore.getState().setOrder(arrayMove(allKeys, oldIndex, newIndex));
  };

  // Removal branches on source — managed L1s hide locally (reversible);
  // wallet L1s drop from l1ListStore (existing flow preserved verbatim
  // so the undo path keeps working).
  const handleRemove = (l1: CombinedL1) => {
    const key = chainKey(l1);
    const orderSnapshot = l1s.map(chainKey);
    const orderStore = chainOrderStore.getState();

    if (l1.source === 'managed') {
      // Server-backed entries — removing from `l1ListStore` would be
      // undone on the next `useMyL1s` poll, so we hide locally instead.
      // Destructive decommission still lives in Managed Nodes (DELETE
      // /api/managed-testnet-nodes/...).
      orderStore.hide(key);
      orderStore.setOrder(orderSnapshot.filter((k) => k !== key));
      toast.success(
        `Hid ${l1.chainName}`,
        'It’s still running. To decommission a node, use Managed Nodes below.',
        {
          id: `l1-hide:${key}`,
          action: {
            label: 'Undo',
            onClick: () => {
              chainOrderStore.getState().unhide(key);
              chainOrderStore.getState().setOrder(orderSnapshot);
            },
          },
        },
      );
      return;
    }

    if (l1.source !== 'wallet' || l1.evmChainId === null) return;
    const listStore = l1ListStore.getState() as {
      l1List: L1ListItem[];
      addL1: (item: L1ListItem) => void;
      removeL1: (id: string) => void;
    };
    const itemSnapshot = listStore.l1List.find((w) => w.id === l1.blockchainId);
    if (!itemSnapshot) return;

    // Drop from the order store first so the rail visibly shifts as
    // soon as the user clicks X — without this the pill would only
    // disappear once setState propagated through the wallet list, which
    // can lag a frame behind the explicit order update.
    orderStore.setOrder(orderSnapshot.filter((k) => k !== key));
    listStore.removeL1(l1.blockchainId);

    toast.success(
      `Removed ${l1.chainName}`,
      'You can re-add it from the Add Chain modal.',
      {
        id: `l1-remove:${l1.blockchainId}`,
        action: {
          label: 'Undo',
          onClick: () => {
            l1ListStore.getState().addL1(itemSnapshot);
            chainOrderStore.getState().setOrder(orderSnapshot);
          },
        },
      },
    );
  };

  const handleUnhideAll = () => chainOrderStore.getState().unhideAll();
  const showHiddenLink = hiddenL1s.length > 0;

  // Empty rail with nothing hidden → render nothing. With hidden chains
  // we still want the unhide link so the user has a way back.
  if (l1s.length === 0 && !showHiddenLink) return null;

  const sortableIds = filteredL1s.map(chainKey);

  const scrollByDirection = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    // ~70% viewport step keeps a sliver of the previous pill visible so
    // the user has spatial continuity across clicks.
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  const derive = (l1: CombinedL1): PillState => ({
    isActive:
      selected !== null &&
      (l1.evmChainId !== null
        ? selected.evmChainId === l1.evmChainId
        : selected.subnetId === l1.subnetId),
    walletIsHere: l1.evmChainId !== null && walletChainId === l1.evmChainId,
    // Primary Network stays gated because the wallet store reseeds it on
    // every page load, so even a "hide" would be reversed.
    isRemovable: !isPrimaryNetwork(l1),
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          Switch Chain
        </h2>
        {showSearch && <ChainSearchInput value={query} onChange={setQuery} />}
      </div>

      <div className="relative">
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10',
            'bg-gradient-to-r from-background to-transparent transition-opacity duration-150',
            canScrollLeft ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            'pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10',
            'bg-gradient-to-l from-background to-transparent transition-opacity duration-150',
            canScrollRight ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden="true"
        />

        {canScrollLeft && (
          <ScrollArrow direction="left" onClick={() => scrollByDirection(-1)} />
        )}
        {canScrollRight && (
          <ScrollArrow direction="right" onClick={() => scrollByDirection(1)} />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div
              ref={scrollRef}
              // Hide native scrollbar — the edge fade + arrow buttons
              // already telegraph overflow, and a stray scrollbar across
              // the rail's bottom looked unfinished against the rest of
              // the dashboard chrome.
              className="flex gap-2 overflow-x-auto pt-2 pb-2 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filteredL1s.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-3 py-3">
                  No chains match &quot;{query}&quot;.
                </div>
              ) : (
                filteredL1s.map((l1) => {
                  const state = derive(l1);
                  return (
                    <SortablePill
                      key={chainKey(l1)}
                      id={chainKey(l1)}
                      l1={l1}
                      state={state}
                      onSelect={() => onSelect(l1)}
                      onRemove={() => handleRemove(l1)}
                    />
                  );
                })
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {showHiddenLink && (
        <div className="px-1">
          <button
            type="button"
            onClick={handleUnhideAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-2"
          >
            Show {hiddenL1s.length} hidden {hiddenL1s.length === 1 ? 'chain' : 'chains'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------

interface PillState {
  isActive: boolean;
  walletIsHere: boolean;
  isRemovable: boolean;
}

function ChainSearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative w-full max-w-[200px]">
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter chains"
        aria-label="Filter chains by name or chain id"
        className="h-8 pl-8 text-xs"
      />
    </div>
  );
}

function ScrollArrow({
  direction,
  onClick,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Scroll ${direction}`}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full',
        'border border-border bg-background/95 text-muted-foreground shadow-sm',
        'hover:text-foreground hover:bg-background',
        'flex items-center justify-center',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        direction === 'left' ? 'left-1' : 'right-1',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SortablePill({
  id,
  l1,
  state,
  onSelect,
  onRemove,
}: {
  id: string;
  l1: CombinedL1;
  state: PillState;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // Clamp y so the dragged pill stays on the rail axis — without this
  // the original element follows the cursor on both axes, which lets
  // the user "drop" the pill below the row.
  const horizontalTransform = transform ? { ...transform, y: 0 } : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(horizontalTransform),
    transition,
    // Drag-during-translate gets a higher z-index so the pill rides over
    // its neighbours instead of being clipped by the next pill's border.
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/pill relative shrink-0 touch-none',
        isDragging ? 'cursor-grabbing opacity-80' : 'cursor-grab',
      )}
      {...attributes}
      {...listeners}
    >
      <ChainPill l1={l1} state={state} onSelect={onSelect} />
      {state.isRemovable && (
        <RemoveButton chainName={l1.chainName} onRemove={onRemove} />
      )}
    </div>
  );
}

function ChainPill({
  l1,
  state,
  onSelect,
}: {
  l1: CombinedL1;
  state: PillState;
  onSelect: () => void;
}) {
  const fallbackBg = pickFallbackBg(l1.subnetId);
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(l1.logoUrl) && !imgFailed;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          data-active={state.isActive ? 'true' : 'false'}
          aria-pressed={state.isActive}
          aria-label={[
            l1.chainName,
            l1.evmChainId !== null ? `(chain ${l1.evmChainId})` : null,
            state.isActive ? '— selected' : null,
            state.walletIsHere ? '— wallet on this chain' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm',
            'transition-[background-color,border-color,color,transform,box-shadow] duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            state.isActive
              ? 'border-emerald-500/60 bg-emerald-500/5 text-foreground shadow-[0_0_0_1px_rgba(16,185,129,0.15)]'
              : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:-translate-y-px hover:text-foreground',
          )}
        >
          {/* 24x24 logo / initials avatar with optional wallet-here pip. */}
          <div className="relative flex-shrink-0">
            <div
              className={cn(
                'h-6 w-6 rounded-md overflow-hidden flex items-center justify-center',
                showImg ? 'bg-muted' : fallbackBg,
              )}
            >
              {showImg ? (
                <img
                  src={l1.logoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-contain p-0.5"
                />
              ) : (
                <span className="text-white text-[10px] font-bold tracking-tight">
                  {chainInitials(l1.chainName)}
                </span>
              )}
            </div>
            {state.walletIsHere && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-2 w-2"
                title="Your wallet is currently on this L1"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50 animate-ping [animation-duration:2.4s]" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-background" />
              </span>
            )}
          </div>
          <span className="font-medium whitespace-nowrap">{l1.chainName}</span>
          {l1.source === 'managed' && l1.expiresAt && (
            <ExpiryPip expiresAt={l1.expiresAt} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">
        <div className="space-y-0.5">
          <div className="font-medium">{l1.chainName}</div>
          <div className="text-[10px] text-muted-foreground font-mono">
            chain {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function RemoveButton({
  chainName,
  onRemove,
}: {
  chainName: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      // Stop drag from kicking off when the user reaches for the X — the
      // 8px PointerSensor distance constraint isn't enough on its own
      // because pressing-and-clicking the X moves the pointer a few pixels.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={`Remove ${chainName} from the rail`}
      title={`Remove ${chainName}`}
      className={cn(
        'absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full',
        'border border-border bg-background text-muted-foreground',
        'opacity-0 group-hover/pill:opacity-100 focus-visible:opacity-100',
        'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30',
        'transition-opacity duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

// Small expiry chip rendered inside managed pills. Counts down a minute
// at a time so the user catches expirations approaching without us
// spamming re-renders. Switches to amber when ≤6h remain, red when
// already expired.
function ExpiryPip({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400"
        aria-label="Managed nodes expired"
      >
        <Clock className="w-2.5 h-2.5" aria-hidden="true" />
        expired
      </span>
    );
  }
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const tone =
    totalHours < 6
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
      : 'bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]',
        tone,
      )}
      aria-label={`Expires in ${label}`}
    >
      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
