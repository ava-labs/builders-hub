'use client';

import { Loader2 } from 'lucide-react';

interface FieldLoadingProps {
  label: string;
  className?: string;
}

/**
 * Tiny inline loading indicator for inspector fields that depend on
 * cross-chain RPC reads. Shows a small spinner + label so users know
 * the form isn't frozen — just waiting on a remote chain to respond.
 */
export function FieldLoading({ label, className }: FieldLoadingProps) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${className ?? ''}`}
    >
      <Loader2 className="w-3 h-3 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
