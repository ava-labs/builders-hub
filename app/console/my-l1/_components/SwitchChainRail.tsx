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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SectionHeader } from '@/components/explorer-v2/ui';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { isPrimaryNetwork, type CombinedL1 } from '@/lib/console/my-l1/types';
import { FOCUS, TOOLTIP } from './chrome';
import { chainKey, useChainOrderStore, useHiddenL1s } from '@/lib/console/my-l1/chainOrderStore';

// Most managed L1s come through without a `logoUrl` (the upstream service
// doesn't publish brand assets), so pills fall back to a mono initials square.
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
// Horizontal row of square chain chips — each shows a small logo on the
// left and the chain name on the right. The active chip takes full ink and
// the red underline the explorer Tabs use for "you are here".
//
// Differences from the v1 marquee rail:
//   - No marquee. v1 auto-scrolled every L1 past the user, which made
//     scanning impossible and broke "which chain am I on?". Replaced
//     with native horizontal scroll plus scroll-arrow buttons that
//     appear only when there's overflow.
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
      (l1) => l1.chainName.toLowerCase().includes(needle) || String(l1.evmChainId ?? '').includes(needle),
    );
  }, [l1s, query, showSearch]);

  // Scroll-arrow visibility tracks the rail's actual scroll
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
    const active = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
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
      toast.success(`Hid ${l1.chainName}`, 'It’s still running. To decommission a node, use Managed Nodes below.', {
        id: `l1-hide:${key}`,
        action: {
          label: 'Undo',
          onClick: () => {
            chainOrderStore.getState().unhide(key);
            chainOrderStore.getState().setOrder(orderSnapshot);
          },
        },
      });
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

    toast.success(`Removed ${l1.chainName}`, 'You can re-add it from the Add Chain modal.', {
      id: `l1-remove:${l1.blockchainId}`,
      action: {
        label: 'Undo',
        onClick: () => {
          l1ListStore.getState().addL1(itemSnapshot);
          chainOrderStore.getState().setOrder(orderSnapshot);
        },
      },
    });
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
      (l1.evmChainId !== null ? selected.evmChainId === l1.evmChainId : selected.subnetId === l1.subnetId),
    walletIsHere: l1.evmChainId !== null && walletChainId === l1.evmChainId,
    // Primary Network stays gated because the wallet store reseeds it on
    // every page load, so even a "hide" would be reversed.
    isRemovable: !isPrimaryNetwork(l1),
  });

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader
        label="Switch chain"
        action={showSearch ? <ChainSearchInput value={query} onChange={setQuery} /> : undefined}
      />

      <div className="relative">
        {canScrollLeft && <ScrollArrow direction="left" onClick={() => scrollByDirection(-1)} />}
        {canScrollRight && <ScrollArrow direction="right" onClick={() => scrollByDirection(1)} />}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div
              ref={scrollRef}
              // Hide native scrollbar — the arrow buttons
              // already telegraph overflow. The vertical padding leaves room
              // for each chip's remove button, which overhangs the corner.
              className="flex gap-2 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filteredL1s.length === 0 ? (
                <div className="px-3 py-2.5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
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
        <button
          type="button"
          onClick={handleUnhideAll}
          className="w-fit px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          Show {hiddenL1s.length} hidden {hiddenL1s.length === 1 ? 'chain' : 'chains'}
        </button>
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

function ChainSearchInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="relative w-full max-w-[200px]">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter chains"
        aria-label="Filter chains by name or chain id"
        className="h-8 w-full border border-zinc-200 bg-white/80 pl-8 pr-2 font-mono text-[11px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-zinc-100"
      />
    </div>
  );
}

function ScrollArrow({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Scroll ${direction}`}
      className={cn(
        'absolute top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center',
        'border border-zinc-300 bg-white text-zinc-500 hover:border-zinc-900 hover:text-zinc-900',
        'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100',
        FOCUS,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

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
      {state.isRemovable && <RemoveButton chainName={l1.chainName} onRemove={onRemove} />}
    </div>
  );
}

function ChainPill({ l1, state, onSelect }: { l1: CombinedL1; state: PillState; onSelect: () => void }) {
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
            'relative flex h-10 items-center gap-2 border pl-1.5 pr-3 text-[13px] transition-colors duration-150',
            FOCUS,
            state.isActive
              ? 'border-zinc-900 bg-white text-zinc-900 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-50'
              : 'border-zinc-200 bg-white/80 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100',
          )}
        >
          {state.isActive && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 bg-[#E6212F]" />}
          {/* 28px logo / initials square with optional wallet-here dot. */}
          <div className="relative flex-shrink-0">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
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
                <span className="font-mono text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                  {chainInitials(l1.chainName)}
                </span>
              )}
            </div>
            {state.walletIsHere && (
              <span
                className="absolute -bottom-1 -right-1 flex h-2 w-2"
                title="Your wallet is currently on this L1"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50 [animation-duration:2.4s]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
              </span>
            )}
          </div>
          <span className={cn('whitespace-nowrap', state.isActive ? 'font-semibold' : 'font-medium')}>
            {l1.chainName}
          </span>
          {l1.source === 'managed' && l1.expiresAt && <ExpiryPip expiresAt={l1.expiresAt} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" sideOffset={6} className={TOOLTIP}>
        <div className="space-y-0.5">
          <div className="font-medium">{l1.chainName}</div>
          <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
            chain {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function RemoveButton({ chainName, onRemove }: { chainName: string; onRemove: () => void }) {
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
        'absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center',
        'border border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400',
        'opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/pill:opacity-100',
        'hover:border-red-500 hover:text-red-600 dark:hover:border-red-700 dark:hover:text-red-400',
        FOCUS,
      )}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

// Small expiry readout rendered inside managed chips. Counts down a minute
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
  const chip = 'inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums';
  if (ms <= 0) {
    return (
      <span className={cn(chip, 'text-red-600 dark:text-red-400')} aria-label="Managed nodes expired">
        <Clock className="h-2.5 w-2.5" aria-hidden="true" />
        expired
      </span>
    );
  }
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  const tone = totalHours < 6 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500';
  return (
    <span className={cn(chip, tone)} aria-label={`Expires in ${label}`}>
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
