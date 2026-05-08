'use client';

import { ChevronDown } from 'lucide-react';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { chainColor } from './chain-color';

interface RemotePickerProps {
  remotes: { chain: L1ListItem; address: string }[];
  selected: L1ListItem;
  onChange: (chainId: string) => void;
}

/**
 * Compact dropdown for switching between deployed remotes when the user
 * has paired the same Home with multiple Remote chains. Renders inline
 * as a chip with the active chain's color + name + chevron. Hidden by
 * the parent when only one remote exists.
 */
export function RemotePicker({ remotes, selected, onChange }: RemotePickerProps) {
  return (
    <label className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:border-foreground/30 cursor-pointer transition-colors text-[11px] font-medium text-foreground/80">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: chainColor(selected.id) }} />
      <span className="truncate max-w-[8rem]">{selected.name}</span>
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <select
        value={selected.id}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Switch active remote"
      >
        {remotes.map((r) => (
          <option key={r.chain.id} value={r.chain.id}>
            {r.chain.name} — {r.address.slice(0, 6)}…{r.address.slice(-4)}
          </option>
        ))}
      </select>
    </label>
  );
}
