'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * con-copy-confirm and con-tx-landed: a state icon that changes as one object. The icons sit stacked in one grid cell
 * (the parent has `grid`); the one shown is sharp, the others are faded, shrunk to 0.8 and blurred 2px. Out takes 100ms
 * on plain ease, in takes 180ms on the strong ease-out: a transition takes the timing of the state it goes to. Tailwind
 * 4's scale-* and blur-* set `scale` and `filter`, so the list names both. Reduce Motion: an opacity cross-fade only.
 * A slot that is not shown is inert as well as aria-hidden, so find in page never lands on its label.
 */
export function MorphSlot({ show, className, children }: { show: boolean; className?: string; children?: ReactNode }) {
  return (
    <span
      aria-hidden={show ? undefined : true}
      inert={!show}
      className={cn(
        'col-start-1 row-start-1 flex items-center justify-center transition-[opacity,scale,filter] motion-reduce:scale-100 motion-reduce:blur-none',
        show
          ? 'opacity-100 scale-100 blur-none duration-180 ease-out'
          : 'opacity-0 scale-80 blur-[2px] duration-100 ease-[ease]',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * con-tx-landed: lucide's check, whose stroke draws in when it shows (stroke-dashoffset 1 to 0, 240ms after 60ms): the
 * one confirmation in the console worth a beat, because the transaction is final. Hidden, it waits 100ms (the fade
 * out) before it undraws. Reduce Motion: the check is whole and only fades in with its slot.
 */
export function DrawnCheck({ drawn, className }: { drawn: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M20 6 9 17l-5-5"
        pathLength={1}
        className={cn(
          '[stroke-dasharray:1] transition-[stroke-dashoffset] motion-reduce:[stroke-dashoffset:0]',
          drawn ? '[stroke-dashoffset:0] duration-240 delay-60 ease-out' : '[stroke-dashoffset:1] duration-0 delay-100',
        )}
      />
    </svg>
  );
}
