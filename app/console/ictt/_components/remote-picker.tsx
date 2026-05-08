'use client';

import { ChevronDown } from 'lucide-react';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { chainColor } from './chain-color';

interface RemotePickerProps {
  remotes: { chain: L1ListItem; address: string }[];
  selected: L1ListItem;
  onChange: (chainId: string) => void;
}

/**
 * Compact dropdown for switching between deployed remotes when the user
 * has paired the same Home with multiple Remote chains. Renders as a
 * styled trigger pill (chain dot + name) on top of the shared `<Select>`
 * primitive so the dropdown menu inherits the project's design system
 * (animations, dark mode, focus states).
 *
 * Hidden by the parent when only one remote exists.
 */
export function RemotePicker({ remotes, selected, onChange }: RemotePickerProps) {
  return (
    <Select value={selected.id} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-7 px-2 gap-1.5 text-[11px] font-medium text-foreground/80 [&>svg]:hidden"
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: chainColor(selected.id) }} />
        <span className="truncate max-w-[8rem]">{selected.name}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </SelectTrigger>
      <SelectContent>
        {remotes.map((r) => (
          <SelectItem key={r.chain.id} value={r.chain.id}>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: chainColor(r.chain.id) }} />
              <span>{r.chain.name}</span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {r.address.slice(0, 6)}…{r.address.slice(-4)}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
