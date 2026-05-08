'use client';

import { Bell } from 'lucide-react';
import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { ActivityRail } from './ActivityRail';
import type { ActivityEvent } from '../types';

interface ActivityDrawerProps {
  events: ActivityEvent[];
  onClear?: () => void;
  className?: string;
}

export function ActivityDrawer({ events, onClear, className }: ActivityDrawerProps) {
  const [open, setOpen] = useState(false);
  const pendingCount = events.filter((e) => e.status === 'pending').length;
  const totalCount = events.length;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            'fixed bottom-4 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900',
            className,
          )}
          aria-label={`Bridge activity (${totalCount} events${pendingCount > 0 ? `, ${pendingCount} pending` : ''})`}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {totalCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
            >
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-zinc-100 dark:border-zinc-800/80">
          <DrawerTitle>Bridge activity</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">
          <ActivityRail events={events} onClear={onClear} variant="inline" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
