'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
import { boardContainer, boardItem } from '@/components/console/motion';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { isPrimaryNetwork, type CombinedL1 } from '../_lib/types';
import { chainKey, useChainOrderStore } from '../_lib/chainOrderStore';

// Single horizontal scrollable row of L1 pills. Replaces the old two-section
// SwitcherBar (managed vs wallet) — the source distinction is folded into a
// pill chip rather than a section header so the row stays compact and the
// user can pan a long fleet without juggling two grids.
//
// Pills support three interactions:
//   - Click           → select the L1
//   - Drag (≥8px)     → reorder; persisted via chainOrderStore
//   - X corner button → remove a wallet-only L1, with Undo toast
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
  const activeRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  // PointerSensor's distance constraint is what lets click-to-select still
  // work alongside drag-to-reorder: a drag is only initiated after the
  // pointer travels 8px, so a still-mouse click never triggers a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Auto-scroll the active pill into view when selection changes — keeps
  // the highlighted pill visible after picking from a long list. The first
  // mount is skipped so the rail doesn't yank itself into a "smooth" scroll
  // before the user has done anything.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selected?.subnetId, selected?.evmChainId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const allKeys = l1s.map(chainKey);
    const oldIndex = allKeys.indexOf(active.id as string);
    const newIndex = allKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(allKeys, oldIndex, newIndex);
    chainOrderStore.getState().setOrder(newOrder);
  };

  // Remove a wallet-only L1 from the persisted list. Snapshot both the
  // L1ListItem AND the rail's current visible order so Undo restores the
  // exact pre-removal layout (chain re-appears in its original slot, not
  // pushed to the end).
  const handleRemove = (l1: CombinedL1) => {
    if (l1.source !== 'wallet' || l1.evmChainId === null) return;
    const listStore = l1ListStore.getState() as {
      l1List: L1ListItem[];
      addL1: (item: L1ListItem) => void;
      removeL1: (id: string) => void;
    };
    const itemSnapshot = listStore.l1List.find((w) => w.id === l1.blockchainId);
    if (!itemSnapshot) return;

    // Capture the rail order with the removed pill still in place. Setting
    // this on Undo brings the chain back to its original slot regardless
    // of where addL1 inserts in the underlying list.
    const orderSnapshot = l1s.map(chainKey);
    const orderStore = chainOrderStore.getState();

    // Drop the chain from the order store so the rail visibly shifts as
    // soon as the user clicks X — without this the pill would only
    // disappear once `setState` propagated through the wallet list, which
    // can lag a frame behind the explicit order update.
    orderStore.setOrder(orderSnapshot.filter((k) => k !== chainKey(l1)));
    listStore.removeL1(l1.blockchainId);

    toast.success(
      `Removed ${l1.chainName}`,
      'You can re-add it from the Add Chain modal.',
      {
        id: `l1-remove:${l1.blockchainId}`,
        action: {
          label: 'Undo',
          onClick: () => {
            // Re-add the chain to the wallet list and restore the rail
            // order from the snapshot captured before removal — that's
            // what makes the pill snap back in its original slot rather
            // than at the end where addL1 would otherwise place it.
            l1ListStore.getState().addL1(itemSnapshot);
            chainOrderStore.getState().setOrder(orderSnapshot);
          },
        },
      },
    );
  };

  if (l1s.length === 0) return null;

  const sortableIds = l1s.map(chainKey);

  return (
    <div className="space-y-2">
      <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground px-1">
        Switch Chain
      </h2>
      {/* `pt-3` (was `py-1`) gives the absolutely-positioned X corner
          button vertical room — it sits 6px above the pill and would
          otherwise clip against the rail's content edge. The rail is
          horizontally scrollable, so y-overflow stays visible. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          <motion.div
            variants={boardContainer}
            initial="hidden"
            animate="visible"
            className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-1 px-1 [scrollbar-width:thin]"
          >
            {l1s.map((l1) => {
              const key = chainKey(l1);
              const isActive =
                selected !== null &&
                (l1.evmChainId !== null
                  ? selected.evmChainId === l1.evmChainId
                  : selected.subnetId === l1.subnetId);
              const walletIsHere =
                l1.evmChainId !== null && walletChainId === l1.evmChainId;
              // Only wallet-source, non-primary entries can be removed.
              // Managed L1s are server-backed (removing the wallet copy
              // wouldn't make the pill go away) and C-Chain is seeded
              // into l1ListStore on every load — removing it just replays
              // on next page mount, so we don't expose the affordance.
              const isRemovable = l1.source === 'wallet' && !isPrimaryNetwork(l1);
              return (
                <SortablePill
                  key={key}
                  id={key}
                  l1={l1}
                  isActive={isActive}
                  walletIsHere={walletIsHere}
                  isRemovable={isRemovable}
                  activeRef={isActive ? activeRef : undefined}
                  onSelect={() => onSelect(l1)}
                  onRemove={() => handleRemove(l1)}
                />
              );
            })}
          </motion.div>
        </SortableContext>
      </DndContext>
    </div>
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
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
    <motion.div
      ref={setRefs}
      style={style}
      variants={boardItem}
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
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
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
          aria-label={`Remove ${l1.chainName} from wallet`}
          title={`Remove ${l1.chainName} from wallet`}
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
    </motion.div>
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
