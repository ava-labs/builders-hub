'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Layers, MessageSquare, ArrowLeftRight, Check, Circle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useIcmSetupStore } from '@/components/toolbox/stores/icmSetupStore';
import { useIcmContext } from './hooks/useIcmContext';
import type { IcmPhase } from './types';

/**
 * Adaptive ribbon above the inspector body. Three slots whose contents
 * vary by phase:
 *   - Messenger/Registry/Demo/Live: Active L1 · ICM Log · Network
 *   - Relayer: Sources · ICM Log · Destinations
 * Each pill opens a Sheet for richer interaction.
 */
export function IcmRibbon() {
  const ctx = useIcmContext();
  const isRelayer = ctx.phase === 'relayer';

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
        {isRelayer ? <SourcesPill /> : <ActiveL1Pill phase={ctx.phase} />}
        <CenterLogPill />
        {isRelayer ? <DestinationsPill /> : <NetworkPill />}
      </div>
    </div>
  );
}

function RibbonShell({
  eyebrow,
  title,
  subtitle,
  trailing,
  onOpen,
  open,
  setOpen,
  sheetTitle,
  sheetContent,
  accentClassName,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onOpen?: () => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  sheetTitle: string;
  sheetContent: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700',
            accentClassName,
          )}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {eyebrow}
            </span>
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
            {subtitle && <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-2">
            {trailing}
            <ChevronDown
              className="h-4 w-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">{sheetContent}</div>
      </SheetContent>
    </Sheet>
  );
}

function StatusDot({ tone }: { tone: 'idle' | 'done' | 'progress' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        tone === 'done' && 'bg-emerald-500',
        tone === 'progress' && 'bg-amber-500',
        tone === 'idle' && 'bg-zinc-300 dark:bg-zinc-600',
      )}
      aria-hidden
    />
  );
}

function ActiveL1Pill({ phase }: { phase: IcmPhase }) {
  const ctx = useIcmContext();
  const [open, setOpen] = useState(false);
  const status = ctx.activeL1Status;
  const messengerOk = Boolean(status?.messengerDeployedAt);
  const registryOk = Boolean(status?.registryAddress);
  const demoOk = Boolean(status?.demoAddress);

  const subtitle = useMemo(() => {
    const bits: string[] = [];
    if (messengerOk) bits.push('Messenger ✓');
    if (registryOk) bits.push('Registry ✓');
    if (demoOk) bits.push('Demo ✓');
    if (bits.length === 0) return 'No contracts deployed yet';
    return bits.join(' · ');
  }, [messengerOk, registryOk, demoOk]);

  return (
    <RibbonShell
      eyebrow="Active L1"
      title={ctx.activeL1?.name ?? 'No L1 selected'}
      subtitle={subtitle}
      open={open}
      setOpen={setOpen}
      sheetTitle="Active L1"
      sheetContent={<ActiveL1SheetBody phase={phase} onClose={() => setOpen(false)} />}
      trailing={<StatusDot tone={messengerOk && registryOk ? 'done' : messengerOk ? 'progress' : 'idle'} />}
    />
  );
}

function ActiveL1SheetBody({ phase, onClose }: { phase: IcmPhase; onClose: () => void }) {
  const ctx = useIcmContext();
  const l1List = useL1List();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The active L1 is the chain you are configuring during the {phase} phase.
      </p>
      <ul className="flex flex-col gap-1">
        {(l1List as L1ListItem[]).map((l1) => {
          const isActive = ctx.activeL1?.id === l1.id;
          return (
            <li key={l1.id}>
              <button
                type="button"
                onClick={() => {
                  ctx.setActiveL1(l1.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
                )}
              >
                <span className="truncate">{l1.name}</span>
                {isActive && <Check className="h-4 w-4 text-emerald-500" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CenterLogPill() {
  const events = useIcmSetupStore((s) => s.activityLog);
  const [open, setOpen] = useState(false);

  return (
    <RibbonShell
      eyebrow="ICM Log"
      title={events.length === 0 ? 'No activity yet' : `${events.length} event${events.length === 1 ? '' : 's'}`}
      subtitle={events[0] ? events[0].label : 'Events show up here when you deploy or send'}
      open={open}
      setOpen={setOpen}
      sheetTitle="ICM activity log"
      sheetContent={<LogSheetBody />}
      trailing={
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          {events.length}
        </span>
      }
    />
  );
}

function LogSheetBody() {
  const events = useIcmSetupStore((s) => s.activityLog);
  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No events yet. As you deploy contracts and send messages, they will appear here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {events.map((event) => (
        <li key={event.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{event.label}</span>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                event.status === 'confirmed' && 'text-emerald-600 dark:text-emerald-400',
                event.status === 'pending' && 'text-amber-600 dark:text-amber-400',
                event.status === 'delivered' && 'text-emerald-600 dark:text-emerald-400',
                event.status === 'failed' && 'text-red-600 dark:text-red-400',
              )}
            >
              {event.status}
            </span>
          </div>
          {event.sublabel && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{event.sublabel}</p>}
        </li>
      ))}
    </ul>
  );
}

function NetworkPill() {
  const ctx = useIcmContext();
  const [open, setOpen] = useState(false);
  const count = ctx.relayerNetworkL1s.length;
  const relayerMode = ctx.relayer.mode;
  const relayerSaved = Boolean(ctx.relayer.savedAt);
  return (
    <RibbonShell
      eyebrow="Network"
      title={count === 0 ? 'No chains yet' : `${count} chain${count === 1 ? '' : 's'}`}
      subtitle={
        relayerSaved
          ? `Relayer (${relayerMode}) configured`
          : relayerMode === 'managed'
            ? 'Managed relayer pending'
            : 'Relayer not configured'
      }
      open={open}
      setOpen={setOpen}
      sheetTitle="Your ICM network"
      sheetContent={<NetworkSheetBody />}
      trailing={
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {count}
        </span>
      }
    />
  );
}

function NetworkSheetBody() {
  const ctx = useIcmContext();
  const chains = ctx.relayerNetworkL1s;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Every L1 with an ICM contract deployed locally or referenced by the relayer config shows up here.
      </p>
      {chains.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Deploy the Messenger or pick chains in the Relayer phase to populate this list.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chains.map((l1) => (
            <li key={l1.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">{l1.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{l1.evmChainId}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcesPill() {
  const ctx = useIcmContext();
  const [open, setOpen] = useState(false);
  const count = ctx.relayerSourceL1s.length;
  const subtitle =
    count === 0 ? 'Pick chains the relayer watches' : ctx.relayerSourceL1s.map((l1) => l1.name).join(', ');

  return (
    <RibbonShell
      eyebrow="Sources"
      title={count === 0 ? 'No sources picked' : `${count} chain${count === 1 ? '' : 's'}`}
      subtitle={subtitle}
      open={open}
      setOpen={setOpen}
      sheetTitle="Source chains"
      sheetContent={<RelayerChainsSheetBody side="sources" onClose={() => setOpen(false)} />}
      trailing={<ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden />}
    />
  );
}

function DestinationsPill() {
  const ctx = useIcmContext();
  const [open, setOpen] = useState(false);
  const count = ctx.relayerDestinationL1s.length;
  const subtitle =
    count === 0 ? 'Pick chains the relayer delivers to' : ctx.relayerDestinationL1s.map((l1) => l1.name).join(', ');

  return (
    <RibbonShell
      eyebrow="Destinations"
      title={count === 0 ? 'No destinations picked' : `${count} chain${count === 1 ? '' : 's'}`}
      subtitle={subtitle}
      open={open}
      setOpen={setOpen}
      sheetTitle="Destination chains"
      sheetContent={<RelayerChainsSheetBody side="destinations" onClose={() => setOpen(false)} />}
      trailing={<ArrowLeftRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden />}
    />
  );
}

function RelayerChainsSheetBody({
  side,
  onClose: _onClose,
}: {
  side: 'sources' | 'destinations';
  onClose: () => void;
}) {
  const l1List = useL1List();
  const ctx = useIcmContext();
  const selectedIds = side === 'sources' ? ctx.relayer.sources : ctx.relayer.destinations;
  const toggleSource = useIcmSetupStore((s) => s.toggleRelayerSource);
  const toggleDestination = useIcmSetupStore((s) => s.toggleRelayerDestination);
  const onToggle = side === 'sources' ? toggleSource : toggleDestination;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {side === 'sources'
          ? 'The relayer subscribes to message events on each source chain.'
          : 'The relayer delivers messages to each destination chain using a funded signer.'}
      </p>
      <ul className="flex flex-col gap-1">
        {(l1List as L1ListItem[]).map((l1) => {
          const isSelected = selectedIds.includes(l1.id);
          return (
            <li key={l1.id}>
              <button
                type="button"
                onClick={() => onToggle(l1.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'border-zinc-900 bg-zinc-50 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="truncate font-medium">{l1.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Chain {l1.evmChainId}</span>
                </div>
                {isSelected ? (
                  <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 text-zinc-400" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
