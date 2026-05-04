'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { isPrimaryNetwork, type CombinedL1 } from '../_lib/types';
import { chainKey, useChainOrderStore, useHiddenL1s } from '../_lib/chainOrderStore';

// Single horizontal row of L1 pills. Two layout modes share the same
// pill visuals + click/drag/remove semantics:
//
//   - Static rail (small / short-named fleet): existing flex row with
//     `overflow-x-auto`, drag-to-reorder, X-to-remove. Identical to the
//     pre-marquee behaviour so users with a small fleet keep their
//     familiar UX.
//   - Marquee mode (overflow detected): row scrolls itself slowly via
//     CSS keyframes (`@keyframes marquee` in `app/global.css`). Hovering
//     the rail pauses the animation; drag pauses too (state-driven).
//     Doubled content provides a seamless loop, with only the first copy
//     registered to dnd-kit's SortableContext so each L1 has exactly one
//     drag source despite appearing twice on screen.
//
// Mode selection — count threshold AND text-length heuristic:
//   - `MARQUEE_COUNT_THRESHOLD = 6` matches the empirical "fits on a
//     1280px viewport" budget: 6 short-name pills fit without horizontal
//     scroll; 7+ usually overflow. So count > 6 → marquee.
//   - `MARQUEE_CHAR_THRESHOLD` catches long-named fleets that overflow
//     before they hit 7 chains (e.g. five "Careful Nakamoto Chain"-style
//     entries blow past the rail width). Total characters across all
//     pill names + chain IDs is a cheap, SSR-safe proxy for rendered
//     width, no measurement pass required.
// Either condition switches the rail to marquee. Tuning the count or
// char numbers is a one-line change here.
//
// Pill interactions in both modes:
//   - Click           → select the L1
//   - Drag (≥8px)     → reorder; persisted via chainOrderStore. Works
//                        in both modes — in marquee, hovering pauses the
//                        animation so the user can grab any pill.
//   - X corner button → remove. Wallet L1s drop from `l1ListStore`
//                        (existing flow); managed L1s are hidden locally
//                        via `chainOrderStore.hide` (server-backed nodes
//                        keep running — destructive decommission lives
//                        in the L1 detail's Managed Nodes card).
const MARQUEE_COUNT_THRESHOLD = 6;
// Character budget across chain names + chain IDs. ~70 chars matches
// six "Careful Nakamoto" / "Rebel Werewolf"-length pills before the row
// starts wrapping at typical sidebar widths. Lower this if "Switch
// Chain" pills clip on common viewport sizes; raise it if short-named
// fleets get marqueed unnecessarily.
const MARQUEE_CHAR_THRESHOLD = 70;
const MARQUEE_DURATION_SECONDS = 60;

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
  const activeRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Marquee kicks in when EITHER too many pills OR the cumulative pill
  // text is wide enough to overflow at typical viewport widths.
  // Computing total chars here (not in a memo) is fine — the array is
  // tiny and the operation is O(n) with a string-length per item.
  const totalPillChars = l1s.reduce(
    (acc, l1) => acc + l1.chainName.length + String(l1.evmChainId ?? l1.subnetId.slice(0, 6)).length,
    0,
  );
  const useMarquee =
    l1s.length > MARQUEE_COUNT_THRESHOLD || totalPillChars > MARQUEE_CHAR_THRESHOLD;

  // PointerSensor's distance constraint is what lets click-to-select still
  // work alongside drag-to-reorder: a drag is only initiated after the
  // pointer travels 8px, so a still-mouse click never triggers a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-scroll the active pill into view when selection changes, but
  // only in static mode — marquee mode already cycles all chains past
  // the user, and forcing scrollIntoView on a transformed parent fights
  // the animation. The first mount is skipped so the rail doesn't yank
  // itself into a "smooth" scroll before the user has done anything.
  useEffect(() => {
    if (useMarquee) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selected?.subnetId, selected?.evmChainId, useMarquee]);

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const allKeys = l1s.map(chainKey);
    const oldIndex = allKeys.indexOf(active.id as string);
    const newIndex = allKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(allKeys, oldIndex, newIndex);
    chainOrderStore.getState().setOrder(newOrder);
  };
  const handleDragCancel = () => setIsDragging(false);

  // Removal branches on source. Managed L1s hide locally (reversible);
  // wallet L1s drop from `l1ListStore` (the existing pre-marquee path,
  // preserved verbatim so we don't regress its undo flow).
  const handleRemove = (l1: CombinedL1) => {
    const key = chainKey(l1);
    const orderSnapshot = l1s.map(chainKey);
    const orderStore = chainOrderStore.getState();

    if (l1.source === 'managed') {
      // Server-backed entries — removing from `l1ListStore` would be
      // undone on the next `useMyL1s` poll, so we hide locally instead.
      // The Managed Nodes card in L1 detail still owns the destructive
      // decommission path (DELETE /api/managed-testnet-nodes/...).
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

    // Wallet branch — unchanged behaviour from the pre-marquee version.
    if (l1.source !== 'wallet' || l1.evmChainId === null) return;
    const listStore = l1ListStore.getState() as {
      l1List: L1ListItem[];
      addL1: (item: L1ListItem) => void;
      removeL1: (id: string) => void;
    };
    const itemSnapshot = listStore.l1List.find((w) => w.id === l1.blockchainId);
    if (!itemSnapshot) return;

    // Drop the chain from the order store so the rail visibly shifts as
    // soon as the user clicks X — without this the pill would only
    // disappear once `setState` propagated through the wallet list, which
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

  const handleUnhideAll = () => {
    chainOrderStore.getState().unhideAll();
  };

  const showHiddenLink = hiddenL1s.length > 0;

  // Empty rail with nothing hidden → nothing to render. Empty rail with
  // hidden chains → show the unhide link so the user has a way back.
  if (l1s.length === 0 && !showHiddenLink) return null;

  const sortableIds = l1s.map(chainKey);

  // Marquee animation driver. Inline `animationPlayState` overrides the
  // CSS `:hover` pause when a drag is in flight, so the user can drop
  // a pill anywhere along the row without it sliding underneath them.
  const marqueeStyle: React.CSSProperties | undefined = useMarquee
    ? {
        animation: `marquee ${MARQUEE_DURATION_SECONDS}s linear infinite`,
        animationPlayState: isDragging ? 'paused' : undefined,
      }
    : undefined;

  const renderInteractivePill = (l1: CombinedL1, derived: PillState) => (
    <SortablePill
      key={chainKey(l1)}
      id={chainKey(l1)}
      l1={l1}
      isActive={derived.isActive}
      walletIsHere={derived.walletIsHere}
      isRemovable={derived.isRemovable}
      activeRef={derived.isActive ? activeRef : undefined}
      onSelect={() => onSelect(l1)}
      onRemove={() => handleRemove(l1)}
    />
  );

  const renderDuplicatePill = (l1: CombinedL1, derived: PillState) => (
    <StaticPill
      key={`${chainKey(l1)}-d`}
      l1={l1}
      isActive={derived.isActive}
      walletIsHere={derived.walletIsHere}
      isRemovable={derived.isRemovable}
      onSelect={() => onSelect(l1)}
      onRemove={() => handleRemove(l1)}
    />
  );

  const derive = (l1: CombinedL1): PillState => ({
    isActive:
      selected !== null &&
      (l1.evmChainId !== null
        ? selected.evmChainId === l1.evmChainId
        : selected.subnetId === l1.subnetId),
    walletIsHere: l1.evmChainId !== null && walletChainId === l1.evmChainId,
    // Drop the wallet-only restriction: managed L1s now route through
    // `handleRemove`'s hide-locally branch. C-Chain is still gated by
    // the primary-network check because the wallet store reseeds it on
    // every page load and even hiding it would be reversed.
    isRemovable: !isPrimaryNetwork(l1),
  });

  return (
    <div className="space-y-2">
      <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground px-1">
        Switch Chain
      </h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {useMarquee ? (
            // Marquee mode: container clips the off-screen pills and
            // hosts edge-fade gradients; the inner row gets the
            // marquee animation. Doubled content (first copy is the
            // dnd-kit-registered interactive set, second is a
            // visual-only duplicate) keeps the loop seamless.
            <div className="relative overflow-hidden pt-3 pb-1">
              <div
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-r from-background to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 bg-gradient-to-l from-background to-transparent"
                aria-hidden="true"
              />
              <div
                className="flex gap-2 w-max hover:[animation-play-state:paused]"
                style={marqueeStyle}
              >
                {l1s.map((l1) => renderInteractivePill(l1, derive(l1)))}
                {l1s.map((l1) => renderDuplicatePill(l1, derive(l1)))}
              </div>
            </div>
          ) : (
            // Static mode: existing horizontal flex with overflow scroll.
            // pt-3 (was py-1) gives the absolutely-positioned X corner
            // button vertical room — it sits 6px above the pill and
            // would otherwise clip against the rail's content edge.
            <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-1 px-1 [scrollbar-width:thin]">
              {l1s.map((l1) => renderInteractivePill(l1, derive(l1)))}
            </div>
          )}
        </SortableContext>
      </DndContext>

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

type PillState = {
  isActive: boolean;
  walletIsHere: boolean;
  isRemovable: boolean;
};

// Visible pill body — pure presentational. No dnd-kit hooks here, so it
// can be reused by both the interactive (drag-enabled) wrapper and the
// duplicate-copy (visual-only) wrapper used in marquee mode.
function PillContent({
  l1,
  isActive,
  walletIsHere,
  isRemovable,
  onSelect,
  onRemove,
  ariaHidden = false,
}: {
  l1: CombinedL1;
  isActive: boolean;
  walletIsHere: boolean;
  isRemovable: boolean;
  onSelect: () => void;
  onRemove: () => void;
  /** True for the marquee duplicate copy — keeps screen readers from
   *  announcing the chain twice and removes the duplicate from the tab
   *  order. Pointer interactions (click + X) still work. */
  ariaHidden?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        aria-hidden={ariaHidden || undefined}
        tabIndex={ariaHidden ? -1 : undefined}
        aria-label={`${l1.chainName} (chain ${l1.evmChainId ?? 'unknown'})${
          isActive ? ' — selected' : ''
        }${walletIsHere ? ' — wallet on this chain' : ''}`}
        className={cn(
          'group relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all duration-150',
          isActive
            ? 'border-emerald-500/60 bg-emerald-500/5 text-foreground shadow-[0_0_0_1px_rgba(16,185,129,0.15)]'
            : 'border-border bg-card hover:border-foreground/30 hover:-translate-y-px text-muted-foreground hover:text-foreground',
        )}
      >
        {/* The pulsing dot is reserved for "your wallet is on this
            chain" — the active selection is communicated by the
            emerald ring + foreground text alone. Showing the dot on
            both states made it ambiguous which chain the wallet was
            actually on when the user clicked through the rail. */}
        {walletIsHere && (
          <span
            className="relative flex w-1.5 h-1.5 shrink-0"
            title="Your wallet is currently on this L1"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping [animation-duration:2.4s]" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
        )}
        <span className="font-medium whitespace-nowrap">{l1.chainName}</span>
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground/70 group-hover:text-muted-foreground">
          {l1.evmChainId ?? l1.subnetId.slice(0, 6)}
        </span>
        {l1.source === 'managed' && l1.expiresAt && <ExpiryPip expiresAt={l1.expiresAt} />}
      </button>
      {/* Removal is a sibling button (not nested) so we don't have
          invalid HTML and the click event doesn't bubble into the
          pill's onSelect / dnd listeners. Hidden until the pill is
          hovered/focused. PointerDown stops dnd-kit from kicking off a
          drag when the user clicks the X. */}
      {isRemovable && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-hidden={ariaHidden || undefined}
          tabIndex={ariaHidden ? -1 : undefined}
          aria-label={`Remove ${l1.chainName} from the rail`}
          title={`Remove ${l1.chainName}`}
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
      )}
    </>
  );
}

function SortablePill({
  id,
  l1,
  isActive,
  walletIsHere,
  isRemovable,
  activeRef,
  onSelect,
  onRemove,
}: {
  id: string;
  l1: CombinedL1;
  isActive: boolean;
  walletIsHere: boolean;
  isRemovable: boolean;
  activeRef?: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  // Clamp y to 0 so the dragged pill stays on the rail axis even when the
  // user pulls vertically. Without this the original element follows the
  // cursor on both axes, which lets the user "drop" the pill below the
  // row — visually broken for a horizontal list.
  const horizontalTransform = transform ? { ...transform, y: 0 } : null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(horizontalTransform),
    transition,
    // Drag-during-translate gets a higher z-index so the pill rides over
    // its neighbours instead of being clipped by the next pill's border.
    zIndex: isDragging ? 10 : 0,
  };

  // Compose the local sortable ref with the parent's auto-scroll ref so
  // both work — dnd-kit needs the ref to track the draggable, and the
  // rail needs it to scroll the active pill into view on selection
  // change.
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (activeRef && 'current' in activeRef) {
      (activeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  return (
    <div
      ref={setRefs}
      style={style}
      // touch-none so dragging on touch devices doesn't scroll the page
      // mid-reorder. cursor-grab signals the drag affordance; flips to
      // grabbing while a drag is in flight.
      className={cn(
        'group/pill relative shrink-0 touch-none',
        isDragging ? 'cursor-grabbing opacity-80' : 'cursor-grab',
      )}
      {...attributes}
      {...listeners}
    >
      <PillContent
        l1={l1}
        isActive={isActive}
        walletIsHere={walletIsHere}
        isRemovable={isRemovable}
        onSelect={onSelect}
        onRemove={onRemove}
      />
    </div>
  );
}

// Marquee duplicate — same visuals as the interactive copy, but no
// dnd-kit registration. Drag therefore only works on the first
// (interactive) set; the duplicate still responds to click-to-select
// and the X button.
function StaticPill({
  l1,
  isActive,
  walletIsHere,
  isRemovable,
  onSelect,
  onRemove,
}: {
  l1: CombinedL1;
  isActive: boolean;
  walletIsHere: boolean;
  isRemovable: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group/pill relative shrink-0">
      <PillContent
        l1={l1}
        isActive={isActive}
        walletIsHere={walletIsHere}
        isRemovable={isRemovable}
        onSelect={onSelect}
        onRemove={onRemove}
        ariaHidden
      />
    </div>
  );
}

// Small expiry chip rendered inside managed pills. Counts down a minute at
// a time so the user catches expirations approaching without us spamming
// re-renders. Switches to amber when ≤6h remain, red when already expired.
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
        className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-400"
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
        'ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]',
        tone,
      )}
      aria-label={`Expires in ${label}`}
    >
      <Clock className="w-2.5 h-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
