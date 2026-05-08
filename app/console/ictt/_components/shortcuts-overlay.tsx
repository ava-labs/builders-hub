'use client';

import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], description: 'Show this overlay' },
  { keys: ['←', '→'], description: 'Move between phases (skips blocked)' },
  { keys: ['⌘', 'Enter'], description: 'Submit the active inspector primary action (macOS)' },
  { keys: ['Ctrl', 'Enter'], description: 'Submit the active inspector primary action (others)' },
];

/**
 * Discoverability surface for the keyboard shortcuts. Opens via the
 * `?` keystroke (when not focused inside an editable field) or via the
 * trigger button in the top bar.
 *
 * Uses the project's `<Dialog>` primitive since this is informational
 * — `<AlertDialog>` is reserved for destructive confirmations like
 * Reset Bridge.
 */
export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  // `?` opens the overlay. Not bound when the user is inside an
  // editable field — let them type literal question marks normally.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts"
        className="hidden md:inline-flex items-center justify-center w-8 h-8 text-muted-foreground border border-border rounded-lg hover:bg-muted cursor-pointer"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Power-user shortcuts for the bridge console. None require Shift.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {SHORTCUTS.map((s) => (
              <div key={s.keys.join('+')} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground/80">{s.description}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded border border-border bg-background text-xs font-mono text-foreground/80"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
